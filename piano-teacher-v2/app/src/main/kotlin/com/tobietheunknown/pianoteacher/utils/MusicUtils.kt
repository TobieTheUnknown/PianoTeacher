package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.NoteEvent

// ─── Note names ───────────────────────────────────────────────────────────────

private val SHARP_NAMES_FR = arrayOf(
    "Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"
)

private val FLAT_NAMES_FR = arrayOf(
    "Do", "Réb", "Ré", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"
)

/** Returns French note name, e.g. "Do#4", "Sib3" */
fun midiToFrench(midi: Int, showOctave: Boolean = true, useFlats: Boolean = false): String {
    val names = if (useFlats) FLAT_NAMES_FR else SHARP_NAMES_FR
    val name = names[midi % 12]
    return if (showOctave) "$name${midi / 12 - 1}" else name
}

// ─── Key detection (Krumhansl-Schmuckler) ────────────────────────────────────

private val MAJOR_PROFILE = doubleArrayOf(6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88)
private val MINOR_PROFILE = doubleArrayOf(6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17)

data class KeySignature(val root: Int, val isMinor: Boolean, val useFlats: Boolean) {
    val name: String get() {
        val names = if (useFlats) FLAT_NAMES_FR else SHARP_NAMES_FR
        return "${names[root]} ${if (isMinor) "mineur" else "majeur"}"
    }
}

fun detectKeySignature(pitches: List<Int>, durations: List<Double>): KeySignature {
    val distribution = DoubleArray(12)
    for (i in pitches.indices) {
        distribution[pitches[i] % 12] += durations.getOrElse(i) { 1.0 }
    }
    val sum = distribution.sum()
    if (sum > 0) for (i in 0..11) distribution[i] /= sum

    var bestCorr = -2.0
    var bestRoot = 0
    var bestMinor = false

    for (root in 0..11) {
        val rotated = DoubleArray(12) { distribution[(it + root) % 12] }
        val majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE)
        val minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE)
        if (majorCorr > bestCorr) { bestCorr = majorCorr; bestRoot = root; bestMinor = false }
        if (minorCorr > bestCorr) { bestCorr = minorCorr; bestRoot = root; bestMinor = true }
    }

    // Use flats for flat keys (F, Bb, Eb, Ab, Db, Gb and their relative minors)
    val flatRoots = setOf(5, 10, 3, 8, 1, 6) // F, Bb, Eb, Ab, Db, Gb
    val useFlats = bestRoot in flatRoots || (bestMinor && (bestRoot + 3) % 12 in flatRoots)

    return KeySignature(bestRoot, bestMinor, useFlats)
}

private fun pearsonCorrelation(a: DoubleArray, b: DoubleArray): Double {
    val n = a.size
    val meanA = a.average()
    val meanB = b.average()
    var num = 0.0; var denA = 0.0; var denB = 0.0
    for (i in 0 until n) {
        val da = a[i] - meanA; val db = b[i] - meanB
        num += da * db; denA += da * da; denB += db * db
    }
    val den = kotlin.math.sqrt(denA * denB)
    return if (den == 0.0) 0.0 else num / den
}

// ─── Chord detection ──────────────────────────────────────────────────────────

data class ChordInfo(
    val name: String,       // "RÉm", "DO", "SOL7"…
    val bassNote: String? = null,
    val isArpeggio: Boolean = false
)

/** Detects chord name from a set of MIDI pitches. Returns null if unrecognised. */
fun detectChord(pitches: Collection<Int>, useFlats: Boolean = false): ChordInfo? {
    if (pitches.size < 2) return null
    val pcs = pitches.map { it % 12 }.toSet()
    if (pcs.size < 2) return null

    // Try each pitch class as potential root
    for (root in pcs.sorted()) {
        val intervals = pcs.map { ((it - root + 12) % 12) }.sorted()
        val result = matchChord(intervals, root, useFlats) ?: continue
        // Determine bass note (lowest pitch)
        val lowestPitch = pitches.min()
        val lowestPc = lowestPitch % 12
        val bassNote = if (lowestPc != root) midiToFrench(lowestPitch, false, useFlats) else null
        return ChordInfo(name = result, bassNote = bassNote)
    }
    return null
}

private fun matchChord(intervals: List<Int>, root: Int, useFlats: Boolean = false): String? {
    val names = if (useFlats) FLAT_NAMES_FR else SHARP_NAMES_FR
    val n = names[root]
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
    arpeggioThreshold: Double = 0.4,
    useFlats: Boolean = false
): ChordInfo? {
    if (pitches.isEmpty()) return null
    val chord = detectChord(pitches, useFlats) ?: return null
    val isArp = if (startTimes.size >= 2) {
        (startTimes.max() - startTimes.min()) > arpeggioThreshold
    } else false
    return chord.copy(isArpeggio = isArp)
}

// ─── Arpeggio motif detection ────────────────────────────────────────────────

data class ChordWithReps(
    val name: String,       // "sol" or "SOL"
    val suffix: String,     // "sus2", "min7", ""
    val bassNote: String?,  // "Sib" or null
    val repetitions: Int,   // 1, 3, 4
    val cycleNotes: List<Int> // MIDI pitches in one cycle
)

data class ArpeggioMotifResult(
    val chords: List<ChordWithReps>,
    val totalNotes: Int,
    val notesPerCycle: Int,
    val isArpeggio: Boolean,
    val header: String // "Accords (arpège de 16 notes, 4x4)" or "Accords"
)

/**
 * Detects arpeggio motifs from a list of chord notes.
 * Finds repeating cycles, identifies chords per cycle, groups consecutive identical chords.
 */
fun detectArpeggioMotifs(notes: List<NoteEvent>, useFlats: Boolean = false): ArpeggioMotifResult {
    val totalNotes = notes.size
    if (totalNotes == 0) return ArpeggioMotifResult(emptyList(), 0, 0, false, "Accords")

    val pitches = notes.map { it.pitch }

    // For 3 or fewer notes, treat as a single chord
    if (totalNotes <= 3) {
        val chord = detectChord(pitches, useFlats)
        val chordWithReps = if (chord != null) {
            parseChordToWithReps(chord, pitches, 1)
        } else {
            ChordWithReps(
                name = pitches.joinToString(" ") { midiToFrench(it, false, useFlats) },
                suffix = "", bassNote = null, repetitions = 1, cycleNotes = pitches
            )
        }
        return ArpeggioMotifResult(listOf(chordWithReps), totalNotes, totalNotes, false, "Accords")
    }

    // Find smallest repeating cycle by pitch-class set
    val pitchClasses = pitches.map { it % 12 }
    val uniqueCount = pitchClasses.toSet().size
    var cycleLen = totalNotes
    var numReps = 1

    for (tryLen in maxOf(2, uniqueCount)..totalNotes / 2) {
        if (totalNotes % tryLen != 0) continue
        val patternSorted = pitchClasses.take(tryLen).toSet().sorted().joinToString(",")
        var allMatch = true
        for (rep in 1 until totalNotes / tryLen) {
            val repSet = mutableSetOf<Int>()
            for (j in 0 until tryLen) repSet.add(pitchClasses[rep * tryLen + j])
            if (repSet.sorted().joinToString(",") != patternSorted) { allMatch = false; break }
        }
        if (allMatch) {
            cycleLen = tryLen
            numReps = totalNotes / tryLen
            break
        }
    }

    val isArpeggio = numReps > 1

    // For each cycle, identify chord + bass note
    data class CycleChord(val chordInfo: ChordInfo?, val cyclePitches: List<Int>)
    val cycles = (0 until numReps).map { rep ->
        val cyclePitches = pitches.subList(rep * cycleLen, (rep + 1) * cycleLen)
        val chord = detectChord(cyclePitches, useFlats)
        CycleChord(chord, cyclePitches)
    }

    // Group consecutive identical chords by name+bass
    val grouped = mutableListOf<ChordWithReps>()
    var i = 0
    while (i < cycles.size) {
        val current = cycles[i]
        val key = "${current.chordInfo?.name}/${current.chordInfo?.bassNote}"
        var count = 1
        while (i + count < cycles.size) {
            val next = cycles[i + count]
            val nextKey = "${next.chordInfo?.name}/${next.chordInfo?.bassNote}"
            if (nextKey == key) count++ else break
        }
        val cwr = if (current.chordInfo != null) {
            parseChordToWithReps(current.chordInfo, current.cyclePitches, count)
        } else {
            ChordWithReps(
                name = current.cyclePitches.joinToString(" ") { midiToFrench(it, false, useFlats) },
                suffix = "", bassNote = current.chordInfo?.bassNote,
                repetitions = count, cycleNotes = current.cyclePitches
            )
        }
        grouped.add(cwr)
        i += count
    }

    val header = if (isArpeggio) {
        "Accords (arp. ${totalNotes} notes, ${numReps}x$cycleLen)"
    } else {
        "Accords"
    }

    return ArpeggioMotifResult(grouped, totalNotes, cycleLen, isArpeggio, header)
}

/**
 * Parse a ChordInfo into a ChordWithReps, extracting suffix from name.
 */
private fun parseChordToWithReps(chord: ChordInfo, cyclePitches: List<Int>, repetitions: Int): ChordWithReps {
    // Extract suffix: "7", "M7", "sus2", "sus4", "dim", "aug" from chord name
    val name = chord.name
    val suffixes = listOf("M7", "sus4", "sus2", "dim", "aug", "7")
    var baseName = name
    var suffix = ""
    for (s in suffixes) {
        if (name.endsWith(s)) {
            baseName = name.dropLast(s.length)
            suffix = s
            break
        }
    }
    return ChordWithReps(
        name = baseName,
        suffix = suffix,
        bassNote = chord.bassNote,
        repetitions = repetitions,
        cycleNotes = cyclePitches
    )
}
