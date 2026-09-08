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

data class BeamItem(val startBeat: Double, val durationBeats: Double, val flags: Int)

data class StaffDisplayNote(
    val note: NoteEvent,
    val tieFromPrevious: Boolean,
    val tieToNext: Boolean,
)

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
    var current = mutableListOf<Int>()
    val denominatorBeat = 4.0 / denominator.coerceAtLeast(1)
    val compound = denominator == 8 && numerator > 3 && numerator % 3 == 0
    val beatUnit = if (compound) denominatorBeat * 3 else denominatorBeat
    for (index in items.indices) {
        if (current.isEmpty()) { current.add(index); continue }
        val previous = items[current.last()]
        val item = items[index]
        val gap = item.startBeat > previous.startBeat + previous.durationBeats + 0.03
        val crossedBeat = kotlin.math.floor(item.startBeat / beatUnit) !=
            kotlin.math.floor(previous.startBeat / beatUnit)
        if (gap || crossedBeat) {
            groups.add(current)
            current = mutableListOf(index)
        } else current.add(index)
    }
    if (current.isNotEmpty()) groups.add(current)
    return groups
}
