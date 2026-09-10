package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.NoteEvent

fun keySignatureAccidentalCount(key: KeySignature?): Int {
    if (key == null) return 0
    val majorRoot = if (key.isMinor) (key.root + 3) % 12 else key.root
    return if (key.useFlats) {
        mapOf(5 to 1, 10 to 2, 3 to 3, 8 to 4, 1 to 5, 6 to 6, 11 to 7)[majorRoot] ?: 0
    } else {
        mapOf(7 to 1, 2 to 2, 9 to 3, 4 to 4, 11 to 5, 6 to 6, 1 to 7)[majorRoot] ?: 0
    }
}

data class SpelledPitch(val name: String, val diatonic: Int, val accidental: Int)

fun spellMidiForStaff(midi: Int, key: KeySignature?, useFlats: Boolean): SpelledPitch {
    val natural = mapOf('C' to 0, 'D' to 2, 'E' to 4, 'F' to 5, 'G' to 7, 'A' to 9, 'B' to 11)
    fun offset(name: String) = natural.getValue(name[0]) + when {
        '#' in name -> 1; 'b' in name -> -1; else -> 0
    }
    val names = if (useFlats) listOf("C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B")
        else listOf("C","C#","D","D#","E","F","F#","G","G#","A","A#","B")
    val name = KEY_SCALE_NOTES[key?.keyName]?.firstOrNull { (offset(it) + 12) % 12 == midi % 12 } ?: names[midi % 12]
    val octave = (midi - offset(name)) / 12
    return SpelledPitch(name, octave * 7 + "CDEFGAB".indexOf(name[0]), when {
        '#' in name -> 1; 'b' in name -> -1; else -> 0
    })
}

class AccidentalState(key: KeySignature?) {
    private val defaults = (if (key?.useFlats == true) "BEADGCF" else "FCGDAEB")
        .take(keySignatureAccidentalCount(key)).associateWith { if (key?.useFlats == true) -1 else 1 }
    private val state = mutableMapOf<Int, Int>()
    fun next(note: SpelledPitch): String? {
        val previous = state[note.diatonic] ?: defaults[note.name[0]] ?: 0
        state[note.diatonic] = note.accidental
        return if (previous == note.accidental) null else when (note.accidental) { 0 -> "♮"; 1 -> "♯"; else -> "♭" }
    }
}

data class BeamItem(val startBeat: Double, val durationBeats: Double, val flags: Int, val voice: Int = 0)

data class StaffDisplayNote(
    val note: NoteEvent,
    val tieFromPrevious: Boolean,
    val tieToNext: Boolean,
)

data class StaffChord(val startTime: Double, val duration: Double, val notes: List<StaffDisplayNote>)
data class StaffRest(val startTime: Double, val duration: Double, val fullMeasure: Boolean)
data class StaffVoice(val index: Int, val chords: List<StaffChord>, val rests: List<StaffRest>)
data class NotatedStaffRest(val startTime: Double, val duration: Double, val fullMeasure: Boolean, val notatable: Boolean)

/** Standard rests within each pulse; expressive residual timing is flagged
 * instead of being silently rounded. Tuplets require source rhythm metadata.
 */
fun splitStaffRests(rests: List<StaffRest>, numerator: Int = 4, denominator: Int = 4): List<NotatedStaffRest> {
    val safeDenominator = denominator.takeIf { it > 0 } ?: 4
    val compound = safeDenominator == 8 && numerator > 3 && numerator % 3 == 0
    val pulse = 4.0 / safeDenominator * if (compound) 3 else 1
    val values = listOf(4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125)
        .flatMap { listOf(it, it * 1.5) }.sortedDescending()
    return rests.flatMap { rest ->
        if (rest.fullMeasure) return@flatMap listOf(NotatedStaffRest(rest.startTime, rest.duration, true, true))
        val result = mutableListOf<NotatedStaffRest>()
        var cursor = rest.startTime
        val end = cursor + rest.duration
        while (cursor < end - MEASURE_EPSILON) {
            val nextPulse = (kotlin.math.floor((cursor + MEASURE_EPSILON) / pulse) + 1) * pulse
            val available = minOf(end, nextPulse) - cursor
            val value = values.firstOrNull { it <= available + MEASURE_EPSILON }
            val duration = value ?: available
            result.add(NotatedStaffRest(cursor, duration, false, value != null))
            cursor += duration
        }
        result
    }
}

/** Infer non-overlapping engraving voices; the source model has no voice metadata.
 * Input fragments are measure-relative, as returned by sliceNotesForStaff.
 * Only equal onsets AND durations share a stem. Rest spans retain exact timing.
 */
fun buildStaffVoices(notes: List<StaffDisplayNote>, beatsPerMeasure: Double): List<StaffVoice> {
    if (!beatsPerMeasure.isFinite() || beatsPerMeasure <= 0) return emptyList()
    val sorted = notes.filter { it.note.startTime.isFinite() && it.note.duration.isFinite() &&
        it.note.duration > MEASURE_EPSILON && it.note.startTime >= -MEASURE_EPSILON &&
        it.note.startTime + it.note.duration <= beatsPerMeasure + MEASURE_EPSILON }
        .sortedWith(compareBy<StaffDisplayNote> { it.note.startTime }.thenByDescending { it.note.pitch }.thenByDescending { it.note.duration })
    val chords = mutableListOf<MutableList<StaffDisplayNote>>()
    var onsetChords = mutableListOf<MutableList<StaffDisplayNote>>()
    var onset = Double.NEGATIVE_INFINITY
    for (display in sorted) {
        val note = display.note
        if (kotlin.math.abs(note.startTime - onset) > MEASURE_EPSILON) {
            onset = note.startTime
            onsetChords = mutableListOf()
        }
        var chord = onsetChords.firstOrNull { kotlin.math.abs(it.first().note.duration - note.duration) <= MEASURE_EPSILON }
        if (chord == null) {
            chord = mutableListOf()
            onsetChords.add(chord)
            chords.add(chord)
        }
        chord.add(display)
    }
    data class VoiceBuilder(val index: Int, val chords: MutableList<StaffChord> = mutableListOf(), var end: Double = 0.0, var center: Double = 0.0)
    val voices = mutableListOf<VoiceBuilder>()
    for (notesInChord in chords) {
        val first = notesInChord.first().note
        val chord = StaffChord(first.startTime, first.duration, notesInChord.toList())
        val center = notesInChord.map { it.note.pitch }.average()
        val voice = voices.filter { it.end <= chord.startTime + MEASURE_EPSILON }
            .minWithOrNull(compareBy<VoiceBuilder> { kotlin.math.abs(it.center - center) }.thenBy { it.index })
            ?: VoiceBuilder(voices.size).also { voices.add(it) }
        voice.chords.add(chord)
        voice.end = chord.startTime + chord.duration
        voice.center = center
    }
    if (voices.isEmpty()) voices.add(VoiceBuilder(0))
    // The higher voice can enter after the bass; entry order is not stem order.
    fun averagePitch(voice: VoiceBuilder): Double {
        val voiceNotes = voice.chords.flatMap { it.notes }.map { it.note }
        val weight = voiceNotes.sumOf { it.duration }
        return if (weight > 0) voiceNotes.sumOf { it.pitch * it.duration } / weight else 0.0
    }
    return voices.sortedWith(compareByDescending<VoiceBuilder> { averagePitch(it) }.thenBy { it.index }).mapIndexed { index, voice ->
        val rests = mutableListOf<StaffRest>()
        var cursor = 0.0
        for (chord in voice.chords) {
            if (chord.startTime > cursor + MEASURE_EPSILON) rests.add(StaffRest(cursor, chord.startTime - cursor, false))
            cursor = maxOf(cursor, chord.startTime + chord.duration)
        }
        if (cursor < beatsPerMeasure - MEASURE_EPSILON) rests.add(StaffRest(cursor, beatsPerMeasure - cursor, voice.chords.isEmpty()))
        StaffVoice(index, voice.chords.toList(), rests)
    }
}

fun sliceNotesForStaff(
    notes: List<NoteEvent>,
    measureStart: Double,
    measureEnd: Double,
): List<StaffDisplayNote> = notes.mapNotNull { note ->
    val noteEnd = note.startTime + note.duration
    val visibleStart = maxOf(note.startTime, measureStart)
    val visibleEnd = minOf(noteEnd, measureEnd)
    if (visibleEnd - visibleStart <= MEASURE_EPSILON) return@mapNotNull null
    StaffDisplayNote(
        note = note.copy(
            startTime = visibleStart - measureStart,
            duration = visibleEnd - visibleStart,
        ),
        tieFromPrevious = note.startTime < measureStart - MEASURE_EPSILON,
        tieToNext = noteEnd > measureEnd + MEASURE_EPSILON,
    )
}

fun computeBeamGroups(
    items: List<BeamItem>,
    numerator: Int = 4,
    denominator: Int = 4,
): List<List<Int>> {
    val groups = mutableListOf<List<Int>>()
    val denominatorBeat = 4.0 / denominator.coerceAtLeast(1)
    val compound = denominator == 8 && numerator > 3 && numerator % 3 == 0
    val beatUnit = if (compound) denominatorBeat * 3 else denominatorBeat
    for (indices in items.indices.groupBy { items[it].voice }.values) {
      var current = mutableListOf<Int>()
      for (index in indices) {
        if (current.isEmpty()) { current.add(index); continue }
        val previous = items[current.last()]
        val item = items[index]
        val gap = item.startBeat > previous.startBeat + previous.durationBeats + 0.03
        val overlap = item.startBeat < previous.startBeat + previous.durationBeats - MEASURE_EPSILON
        val crossedBeat = kotlin.math.floor(item.startBeat / beatUnit) !=
            kotlin.math.floor(previous.startBeat / beatUnit)
        if (gap || overlap || crossedBeat) {
            groups.add(current)
            current = mutableListOf(index)
        } else current.add(index)
      }
      if (current.isNotEmpty()) groups.add(current)
    }
    return groups.sortedBy { it.first() }
}
