package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import org.junit.Assert.*
import org.junit.Test

class StaffVoicesTest {
    private fun note(pitch: Int, start: Double, duration: Double) =
        StaffDisplayNote(NoteEvent("$pitch-$start", pitch, start, duration), false, false)

    @Test fun heldBassAndMovingMelodyKeepIndependentDurations() {
        val voices = buildStaffVoices(listOf(note(48, 0.0, 2.0), note(72, 0.0, 0.5), note(74, 0.5, 0.5), note(76, 1.0, 0.5)), 4.0)
        assertEquals(2, voices.size)
        assertEquals(listOf(72, 74, 76), voices[0].chords.flatMap { it.notes }.map { it.note.pitch })
        assertEquals(listOf(2.0), voices[1].chords.map { it.duration })
        assertEquals(listOf(StaffRest(1.5, 2.5, false)), voices[0].rests)
        assertEquals(listOf(StaffRest(2.0, 2.0, false)), voices[1].rests)
    }

    @Test fun onlyEqualStartsAndDurationsShareStemsRegardlessOfZoom() {
        val voices = buildStaffVoices(listOf(note(60, 0.0, 1.0), note(64, 0.0, 1.0), note(67, 0.0001, 1.0)), 4.0)
        assertEquals(2, voices.size)
        assertEquals(listOf(1, 2), voices.flatMap { it.chords }.map { it.notes.size })
    }

    @Test fun restsFillInitialAndInternalGapsAndAnEmptyCompoundMeasure() {
        val voice = buildStaffVoices(listOf(note(60, 1.0, 0.5), note(62, 2.0, 1.0)), 3.0).single()
        assertEquals(listOf(StaffRest(0.0, 1.0, false), StaffRest(1.5, 0.5, false)), voice.rests)
        assertEquals(listOf(StaffRest(0.0, 3.0, true)), buildStaffVoices(emptyList(), 3.0).single().rests)
    }

    @Test fun tiedFragmentsRetainTiesAndEveryVoiceCoversTheMeasure() {
        val source = listOf(NoteEvent("held", 60, 3.0, 3.0), NoteEvent("moving", 72, 4.0, 0.5))
        val voices = buildStaffVoices(sliceNotesForStaff(source, 4.0, 8.0), 4.0)
        val held = voices.flatMap { it.chords }.flatMap { it.notes }.first { it.note.pitch == 60 }
        assertTrue(held.tieFromPrevious)
        assertEquals(2.0, held.note.duration, 0.0)
        assertEquals(3.0, source.first().duration, 0.0)
        for (voice in voices) {
            val spans = (voice.chords.map { it.startTime to it.duration } + voice.rests.map { it.startTime to it.duration }).sortedBy { it.first }
            var cursor = 0.0
            for ((start, duration) in spans) {
                assertEquals(cursor, start, 0.0)
                cursor += duration
            }
            assertEquals(4.0, cursor, 0.0)
        }
    }

    @Test fun beamsNeverMixInterleavedVoicesOrSimultaneousDurations() {
        val items = listOf(BeamItem(0.0, 0.25, 2, 0), BeamItem(0.0, 0.5, 1, 1), BeamItem(0.25, 0.25, 2, 0), BeamItem(0.5, 0.5, 1, 1))
        assertEquals(listOf(listOf(0, 2), listOf(1, 3)), computeBeamGroups(items))
        assertEquals(listOf(listOf(0), listOf(1)), computeBeamGroups(items.take(2).map { it.copy(voice = 0) }))
    }

    @Test fun restSpellingRespectsPulsesWithoutRoundingExpressiveTiming() {
        val rest = listOf(StaffRest(0.5, 2.5, false))
        assertEquals(listOf(0.5, 1.0, 1.0), splitStaffRests(rest).map { it.duration })
        assertEquals(listOf(1.0, 1.5), splitStaffRests(rest, 6, 8).map { it.duration })
        val expressive = splitStaffRests(listOf(StaffRest(0.0, 0.26, false)))
        assertEquals(0.26, expressive.sumOf { it.duration }, 1e-9)
        assertFalse(expressive.last().notatable)
        assertEquals(1, splitStaffRests(listOf(StaffRest(0.0, 3.0, true))).size)
    }

    @Test fun lateUpperVoiceIsRankedAboveBassRegardlessOfInputOrder() {
        val notes = listOf(note(48, 0.0, 4.0), note(72, 1.0, 1.0), note(74, 2.0, 1.0))
        val voices = buildStaffVoices(notes, 4.0)
        assertEquals(listOf(72, 74), voices[0].chords.flatMap { it.notes }.map { it.note.pitch })
        assertEquals(voices, buildStaffVoices(notes.reversed(), 4.0))
        assertEquals(48, voices[1].chords.single().notes.single().note.pitch)
    }
}
