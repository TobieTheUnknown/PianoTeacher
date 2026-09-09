package com.tobietheunknown.pianoteacher.audio

import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.model.Tracks
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class PlaybackTimelineTest {
    private fun note(id: Int, pitch: Int, start: Double, duration: Double, right: Boolean = true) =
        TimelineNote(id, NoteEvent("same-import-id", pitch, start, duration), right)

    @Test fun `clock keeps position through tempo changes and waiting`() {
        val clock = MonotonicBeatClock(4.0, 1_000_000_000L)
        assertEquals(6.0, clock.advance(2_000_000_000L, 2.0), 1e-9)
        assertEquals(7.0, clock.advance(3_000_000_000L, 1.0), 1e-9)
        clock.seek(7.0, 20_000_000_000L)
        assertEquals(7.5, clock.advance(20_500_000_000L, 1.0), 1e-9)
    }

    @Test fun `jitter drains every event including short notes outside a viewport`() {
        val events = timelineEvents(listOf(note(0, 60, 0.0, 0.1), note(1, 64, 0.15, 0.1), note(2, 67, 0.3, 0.1)))
        val cursor = TimelineCursor(events, 0.0)
        assertEquals(events, cursor.drainThrough(10.0))
        assertTrue(cursor.drainThrough(11.0).isEmpty())
    }

    @Test fun `equal pitches and imported ids keep separate occurrence lifetimes`() {
        val events = timelineEvents(listOf(note(0, 60, 0.0, 3.0), note(1, 60, 1.0, 0.5, false), note(2, 60, 1.5, 0.5)))
        assertEquals(listOf(0, 1, 1, 2, 2, 0), events.map { it.note.occurrence })
        assertEquals(listOf(true, true, false, true, false, false), events.map { it.isOn })
    }

    @Test fun `phrase and bar boundaries preserve long notes and silence`() {
        val song = Song("s", "Test", phrases = listOf(
            Phrase("a", "A", 2, Tracks(melody = listOf(NoteEvent("a", 60, 3.5, 3.0)))),
            Phrase("b", "B", 1, Tracks(chords = listOf(NoteEvent("b", 48, 0.0, 1.0)))),
        ))
        val notes = songTimeline(song)
        assertEquals(listOf(3.5, 8.0), notes.map { it.note.startTime })
        assertEquals(6.5, timelineEvents(notes).first { !it.isOn }.beat, 1e-9)
    }

    @Test fun `scrub attacks work in both directions without reauditioning boundary`() {
        val notes = listOf(note(0, 60, 1.0, 1.0), note(1, 64, 2.0, 1.0), note(2, 67, 3.0, 1.0))
        assertEquals(listOf(1, 2), crossedNotes(notes, 1.0, 3.0).map { it.occurrence })
        assertEquals(listOf(1, 0), crossedNotes(notes, 3.0, 1.0).map { it.occurrence })
        assertTrue(crossedNotes(notes, 2.0, 2.0).isEmpty())
    }

    @Test fun `scrub previews both hands and respects mute and previous auditions`() {
        val notes = listOf(note(0, 60, 1.0, 1.0, true), note(1, 48, 1.0, 1.0, false))
        assertEquals(setOf(0, 1), scrubAuditionNotes(notes, 0.0, 1.0, true, emptySet()).map { it.occurrence }.toSet())
        assertEquals(setOf(0, 1), scrubAuditionNotes(notes, 2.0, 1.0, true, emptySet()).map { it.occurrence }.toSet())
        assertTrue(scrubAuditionNotes(notes, 0.0, 1.0, false, emptySet()).isEmpty())
        assertTrue(scrubAuditionNotes(notes, 0.0, 1.0, true, setOf(0, 1)).isEmpty())
    }

    private class FakeAudio : PlaybackAudio {
        val events = mutableListOf<Pair<String, Long>>()
        var nextId = 1L
        override suspend fun awaitReady() = true
        override fun playVoice(pitch: Int, velocity: Int): Long = nextId++.also { events += "on" to it }
        override fun stopVoice(id: Long) { events += "off" to id }
        override fun playClick(isAccent: Boolean, amplitude: Float) = Unit
    }

    @Test fun `transport does not release a long note when another equal pitch ends`() = runBlocking {
        val audio = FakeAudio()
        withTimeout(2000) {
            TimelineTransport(audio, listOf(note(0, 60, 0.0, 0.6), note(1, 60, 0.1, 0.1)), 0.25).run(
                0.0, { TransportSettings(10.0, 0.0, 0.7) }, { true }, { emptySet() }, { _, _ -> },
            )
        }
        assertEquals(listOf("on" to 1L, "on" to 2L, "off" to 2L, "off" to 1L), audio.events)
    }

    @Test fun `wait mode gates user attacks even with no backing notes`() = runBlocking {
        val audio = FakeAudio()
        var pressed = emptySet<Int>()
        var waitingBeat: Double? = null
        val job = launch {
            TimelineTransport(audio, listOf(note(0, 60, 0.1, 0.1)), 4.0).run(
                0.0, { TransportSettings(10.0, 0.0, 0.3, wait = true) }, { false }, { pressed },
                { beat, waiting -> if (waiting) waitingBeat = beat },
            )
        }
        withTimeout(2000) { while (waitingBeat == null) delay(2) }
        assertEquals(0.1, waitingBeat!!, 1e-9)
        delay(30)
        assertTrue(job.isActive)
        pressed = setOf(60)
        withTimeout(2000) { job.join() }
        assertTrue(audio.events.isEmpty())
    }

    @Test fun `seek restores held notes and cancellation releases only owned voices`() = runBlocking {
        val audio = FakeAudio()
        val job = launch {
            TimelineTransport(audio, listOf(note(0, 60, 0.0, 4.0)), 4.0).run(
                2.0, { TransportSettings(1.0, 0.0, 4.0) }, { true }, { emptySet() }, { _, _ -> },
            )
        }
        withTimeout(2000) { while (audio.events.isEmpty()) delay(2) }
        job.cancelAndJoin()
        assertEquals(listOf("on" to 1L, "off" to 1L), audio.events)
    }

    @Test fun `loading finishes before the score clock starts`() = runBlocking {
        val ready = CompletableDeferred<Boolean>()
        val audio = FakeAudio()
        val delayedAudio = object : PlaybackAudio by audio {
            override suspend fun awaitReady() = ready.await()
        }
        val job = launch {
            TimelineTransport(delayedAudio, listOf(note(0, 60, 0.0, 0.1)), 4.0).run(
                0.0, { TransportSettings(10.0, 0.0, 0.2) }, { true }, { emptySet() }, { _, _ -> },
            )
        }
        delay(40)
        assertTrue(audio.events.isEmpty())
        assertTrue(job.isActive)
        ready.complete(true)
        withTimeout(2000) { job.join() }
        assertEquals(listOf("on" to 1L, "off" to 1L), audio.events)
    }

    @Test fun `loop attacks repeat with separate voice ownership and no orphan release`() = runBlocking {
        val audio = FakeAudio()
        withTimeout(2000) {
            TimelineTransport(audio, listOf(note(0, 60, 0.0, 0.1)), 4.0).run(
                0.0,
                { TransportSettings(10.0, 0.0, 0.2, loop = audio.nextId < 4) },
                { true }, { emptySet() }, { _, _ -> },
            )
        }
        assertEquals(listOf("on" to 1L, "off" to 1L, "on" to 2L, "off" to 2L, "on" to 3L, "off" to 3L), audio.events)
    }
}
