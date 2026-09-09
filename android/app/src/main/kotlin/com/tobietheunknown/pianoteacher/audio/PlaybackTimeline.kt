package com.tobietheunknown.pianoteacher.audio

import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Song
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.asCoroutineDispatcher

/** Shared process-wide timing thread, isolated from rendering and sample decoding. */
val audioPlaybackDispatcher = java.util.concurrent.Executors.newSingleThreadExecutor { task ->
    Thread(task, "PianoPlayback").apply { isDaemon = true; priority = Thread.MAX_PRIORITY }
}.asCoroutineDispatcher()

/** Identity is the occurrence in the score, never its pitch or imported MIDI id. */
data class TimelineNote(val occurrence: Int, val note: NoteEvent, val rightHand: Boolean)

fun songTimeline(song: Song): List<TimelineNote> {
    var offset = 0.0
    var occurrence = 0
    return song.phrases.flatMap { phrase ->
        val notes = phrase.tracks.melody.map { TimelineNote(occurrence++, it.copy(startTime = it.startTime + offset), true) } +
            phrase.tracks.chords.map { TimelineNote(occurrence++, it.copy(startTime = it.startTime + offset), false) }
        offset += phrase.length * song.beatsPerMeasure
        notes
    }.sortedBy { it.note.startTime }
}

data class TimelineEvent(val beat: Double, val note: TimelineNote, val isOn: Boolean)

/** Off-before-on ordering preserves a reattack at exactly the previous release. */
fun timelineEvents(notes: List<TimelineNote>): List<TimelineEvent> = notes
    .filter { it.note.duration > 0 && it.note.pitch in 0..127 }
    .flatMap { listOf(TimelineEvent(it.note.startTime, it, true), TimelineEvent(it.note.startTime + it.note.duration, it, false)) }
    .sortedWith(compareBy<TimelineEvent> { it.beat }.thenBy { it.isOn }.thenBy { it.note.occurrence })

/** Delta integration allows tempo changes and waiting without wall-clock jumps. */
class MonotonicBeatClock(startBeat: Double, nowNanos: Long) {
    var beat: Double = startBeat
        private set
    private var previousNanos = nowNanos
    fun advance(nowNanos: Long, beatsPerSecond: Double): Double {
        beat += (nowNanos - previousNanos).coerceAtLeast(0) / 1_000_000_000.0 * beatsPerSecond
        previousNanos = nowNanos
        return beat
    }
    fun seek(beat: Double, nowNanos: Long) {
        this.beat = beat
        previousNanos = nowNanos
    }
}

/** A cursor over the entire score; its result is independent of viewport and frame rate. */
class TimelineCursor(private val events: List<TimelineEvent>, startBeat: Double) {
    private var index = events.indexOfFirst { it.beat >= startBeat }.let { if (it < 0) events.size else it }
    fun peek(): TimelineEvent? = events.getOrNull(index)
    fun pop(): TimelineEvent = events[index++]
    fun drainThrough(beat: Double): List<TimelineEvent> {
        val result = mutableListOf<TimelineEvent>()
        while (peek()?.let { it.beat <= beat } == true) result += pop()
        return result
    }
}

data class TransportSettings(
    val beatsPerSecond: Double,
    val startBeat: Double,
    val endBeat: Double,
    val loop: Boolean = false,
    val wait: Boolean = false,
    val metronomeSubdivision: Int = 0,
    val metronomeAmplitude: Float = 0.45f,
)

/**
 * Runs on a dedicated dispatcher. Audio consumes the score first; Compose receives
 * throttled position snapshots. No measure rebuilding or scrolling can hold its clock.
 */
interface PlaybackAudio {
    suspend fun awaitReady(): Boolean
    fun playVoice(pitch: Int, velocity: Int = 80): Long
    fun stopVoice(id: Long)
    fun playClick(isAccent: Boolean, amplitude: Float = 0.45f)
}

class TimelineTransport(
    private val audio: PlaybackAudio,
    private val notes: List<TimelineNote>,
    private val beatsPerMeasure: Double,
) {
    suspend fun run(
        initialBeat: Double,
        settings: () -> TransportSettings,
        autoPlay: (TimelineNote) -> Boolean,
        pressedKeys: () -> Set<Int>,
        publish: (Double, Boolean) -> Unit,
        preroll: Boolean = false,
    ) {
        if (!audio.awaitReady()) return
        val voices = mutableMapOf<Int, Long>()
        fun silence() { voices.values.forEach(audio::stopVoice); voices.clear() }
        val events = timelineEvents(notes)
        var cursor = TimelineCursor(events, initialBeat)
        val clock = MonotonicBeatClock(initialBeat, System.nanoTime())
        var lastPublish = 0L
        var lastClick = -1L
        fun resumeHeld(beat: Double) {
            notes.filter { it.note.startTime < beat && it.note.startTime + it.note.duration > beat && autoPlay(it) }
                .forEach { voices[it.occurrence] = audio.playVoice(it.note.pitch, 80) }
        }
        fun expectedAt(beat: Double) = notes.asSequence()
            .filter { kotlin.math.abs(it.note.startTime - beat) < 0.000001 && !autoPlay(it) }
            .map { it.note.pitch }.toSet()
        try {
            if (preroll && settings().metronomeSubdivision > 0) {
                val countIn = MonotonicBeatClock(0.0, System.nanoTime())
                var previousTick = -1L
                while (currentCoroutineContext().isActive) {
                    val config = settings()
                    val beat = countIn.advance(System.nanoTime(), config.beatsPerSecond)
                    if (beat >= beatsPerMeasure) break
                    val tick = kotlin.math.floor(beat * config.metronomeSubdivision.coerceAtLeast(1)).toLong()
                    if (tick != previousTick) {
                        audio.playClick(tick == 0L, config.metronomeAmplitude)
                        previousTick = tick
                    }
                    delay(4)
                }
            }
            clock.seek(initialBeat, System.nanoTime())
            resumeHeld(initialBeat)
            while (currentCoroutineContext().isActive) {
                val config = settings()
                if (config.endBeat <= config.startBeat) break
                if (config.loop && clock.beat < config.startBeat) {
                    silence()
                    clock.seek(config.startBeat, System.nanoTime())
                    cursor = TimelineCursor(events, config.startBeat)
                    resumeHeld(config.startBeat)
                    lastClick = -1
                }
                var beat = clock.advance(System.nanoTime(), config.beatsPerSecond).coerceAtMost(config.endBeat)
                while (cursor.peek()?.let { it.beat <= beat && (!it.isOn || it.beat < config.endBeat) } == true) {
                    val event = cursor.peek()!!
                    if (event.isOn && settings().wait) {
                        val expected = expectedAt(event.beat)
                        if (expected.isNotEmpty() && !pressedKeys().containsAll(expected)) {
                            // Freeze at the attack, including accompaniment/metronome.
                            clock.seek(event.beat, System.nanoTime())
                            publish(event.beat, true)
                            while (settings().wait && !pressedKeys().containsAll(expectedAt(event.beat))) delay(4)
                            clock.seek(event.beat, System.nanoTime())
                            beat = event.beat
                            publish(beat, false)
                        }
                    }
                    cursor.pop()
                    if (event.isOn) {
                        if (autoPlay(event.note)) voices[event.note.occurrence] = audio.playVoice(event.note.note.pitch, 80)
                    } else voices.remove(event.note.occurrence)?.let(audio::stopVoice)
                }
                val subdivision = settings().metronomeSubdivision
                if (subdivision > 0) {
                    val tick = kotlin.math.floor(beat * subdivision).toLong()
                    if (tick != lastClick && beat < config.endBeat) {
                        lastClick = tick
                        val bar = beatsPerMeasure * subdivision
                        audio.playClick(kotlin.math.abs(tick.toDouble() % bar) < 0.000001, settings().metronomeAmplitude)
                    }
                }
                val now = System.nanoTime()
                if (now - lastPublish >= 16_000_000 || beat >= config.endBeat) {
                    publish(beat, false)
                    lastPublish = now
                }
                if (beat >= config.endBeat) {
                    silence()
                    if (!config.loop) break
                    // Carry scheduler overshoot into the next lap instead of accumulating drift.
                    val overflow = (clock.beat - config.endBeat).coerceAtLeast(0.0)
                    val length = config.endBeat - config.startBeat
                    clock.seek(config.startBeat + overflow % length, System.nanoTime())
                    cursor = TimelineCursor(events, config.startBeat)
                    resumeHeld(config.startBeat)
                    lastClick = -1
                }
                delay(4)
            }
        } finally {
            // Release only this transport's occurrences, never MIDI or a newer session.
            silence()
        }
    }
}

/** Scrubbing uses crossed attacks in either direction, not currently visible notes. */
fun crossedNotes(notes: List<TimelineNote>, from: Double, to: Double): List<TimelineNote> =
    if (to >= from) notes.filter { it.note.startTime > from && it.note.startTime <= to }
    else notes.filter { it.note.startTime >= to && it.note.startTime < from }.asReversed()

/** Track preview always includes both hands, regardless of the practice/backing mode. */
fun scrubAuditionNotes(
    notes: List<TimelineNote>,
    from: Double,
    to: Double,
    audioEnabled: Boolean,
    alreadyAuditioned: Set<Int>,
): List<TimelineNote> {
    if (!audioEnabled) return emptyList()
    val crossed = crossedNotes(notes, from, to).filter { it.occurrence !in alreadyAuditioned }
    // A large drag previews its final crossed chord without a backlog of attacks.
    val lastAttack = crossed.lastOrNull()?.note?.startTime ?: return emptyList()
    return crossed.filter { it.note.startTime == lastAttack }.take(24)
}
