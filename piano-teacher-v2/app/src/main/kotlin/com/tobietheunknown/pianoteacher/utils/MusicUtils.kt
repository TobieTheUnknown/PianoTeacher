package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.NoteEvent

// ─── Note names ───────────────────────────────────────────────────────────────

private val NOTE_NAMES_FR = arrayOf(
    "Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"
)

/** Returns French note name, e.g. "Do#4", "La3" */
fun midiToFrench(midi: Int, showOctave: Boolean = true): String {
    val name = NOTE_NAMES_FR[midi % 12]
    return if (showOctave) "$name${midi / 12 - 1}" else name
}

// ─── Chord detection ──────────────────────────────────────────────────────────

data class ChordInfo(
    val name: String,       // "RÉm", "DO", "SOL7"…
    val bassNote: String? = null,
    val isArpeggio: Boolean = false
)

/** Detects chord name from a set of MIDI pitches. Returns null if unrecognised. */
fun detectChord(pitches: Collection<Int>): ChordInfo? {
    if (pitches.size < 2) return null
    val pcs = pitches.map { it % 12 }.toSet()
    if (pcs.size < 2) return null

    // Try each pitch class as potential root
    for (root in pcs.sorted()) {
        val intervals = pcs.map { ((it - root + 12) % 12) }.sorted()
        val result = matchChord(intervals, root) ?: continue
        // Determine bass note (lowest pitch)
        val lowestPitch = pitches.min()
        val lowestPc = lowestPitch % 12
        val bassNote = if (lowestPc != root) midiToFrench(lowestPitch, false) else null
        return ChordInfo(name = result, bassNote = bassNote)
    }
    return null
}

private fun matchChord(intervals: List<Int>, root: Int): String? {
    val n = NOTE_NAMES_FR[root]
    val upper = n.uppercase()
    val lower = n.lowercase()
    return when {
        intervals.containsAll(listOf(0, 4, 7, 10)) -> "${upper}7"
        intervals.containsAll(listOf(0, 3, 7, 10)) -> "${lower}7"
        intervals.containsAll(listOf(0, 4, 7, 11)) -> "${upper}M7"
        intervals.containsAll(listOf(0, 3, 7))     -> lower
        intervals.containsAll(listOf(0, 4, 7))     -> upper
        intervals.containsAll(listOf(0, 3, 6))     -> "${lower}dim"
        intervals.containsAll(listOf(0, 4, 8))     -> "${upper}aug"
        intervals.containsAll(listOf(0, 5, 7))     -> "${upper}sus4"
        intervals.containsAll(listOf(0, 2, 7))     -> "${upper}sus2"
        else -> null
    }
}

/**
 * Find the first cycle of an arpeggio pattern by pitch-class set repetition.
 * If the notes are short enough (<=4), returns all of them.
 * Otherwise, finds the smallest cycle length where every cycle has the same pitch-class set.
 */
fun firstArpeggioCycle(notes: List<NoteEvent>): List<NoteEvent> {
    val total = notes.size
    if (total <= 4) return notes // Short enough to show all

    val pitchClasses = notes.map { it.pitch % 12 }
    val uniqueCount = pitchClasses.toSet().size

    for (cycleLen in maxOf(3, uniqueCount)..total / 2) {
        if (total % cycleLen != 0) continue
        val patternSet = pitchClasses.take(cycleLen).toSet()
        val patternSorted = patternSet.sorted().joinToString(",")
        var matches = true
        for (rep in 1 until total / cycleLen) {
            val repSet = mutableSetOf<Int>()
            for (j in 0 until cycleLen) repSet.add(pitchClasses[rep * cycleLen + j])
            if (repSet.sorted().joinToString(",") != patternSorted) { matches = false; break }
        }
        if (matches) return notes.take(cycleLen)
    }
    return notes // No repeating pattern found
}

/**
 * Detects chord from a sequence of notes, treating them as an arpeggio
 * if the time spread is > [arpeggioThreshold] beats.
 */
fun detectChordOrArpeggio(
    pitches: List<Int>,
    startTimes: List<Double>,
    arpeggioThreshold: Double = 0.4
): ChordInfo? {
    if (pitches.isEmpty()) return null
    val chord = detectChord(pitches) ?: return null
    val isArp = if (startTimes.size >= 2) {
        (startTimes.max() - startTimes.min()) > arpeggioThreshold
    } else false
    return chord.copy(isArpeggio = isArp)
}
