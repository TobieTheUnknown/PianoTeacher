package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.NoteEvent

// ─── Note names ───────────────────────────────────────────────────────────────

private val SHARP_NAMES_FR = arrayOf(
    "Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"
)

private val FLAT_NAMES_FR = arrayOf(
    "Do", "Réb", "Ré", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"
)

// English note names (for key lookup)
private val SHARP_NAMES_EN = arrayOf("C","C#","D","D#","E","F","F#","G","G#","A","A#","B")

// French names mapping from English
private val EN_TO_FR = mapOf(
    "C" to "Do", "C#" to "Do#", "Db" to "Réb",
    "D" to "Ré", "D#" to "Ré#", "Eb" to "Mib",
    "E" to "Mi", "F" to "Fa", "F#" to "Fa#", "Gb" to "Solb",
    "G" to "Sol", "G#" to "Sol#", "Ab" to "Lab",
    "A" to "La", "A#" to "La#", "Bb" to "Sib",
    "B" to "Si",
    "E#" to "Mi#", "Fb" to "Fab", "B#" to "Si#", "Cb" to "Dob"
)

val KEY_SCALE_NOTES = mapOf(
    // Major keys
    "C-major" to listOf("C","D","E","F","G","A","B"),
    "G-major" to listOf("G","A","B","C","D","E","F#"),
    "D-major" to listOf("D","E","F#","G","A","B","C#"),
    "A-major" to listOf("A","B","C#","D","E","F#","G#"),
    "E-major" to listOf("E","F#","G#","A","B","C#","D#"),
    "B-major" to listOf("B","C#","D#","E","F#","G#","A#"),
    "F#-major" to listOf("F#","G#","A#","B","C#","D#","E#"),
    "C#-major" to listOf("C#","D#","E#","F#","G#","A#","B#"),
    "F-major" to listOf("F","G","A","Bb","C","D","E"),
    "Bb-major" to listOf("Bb","C","D","Eb","F","G","A"),
    "Eb-major" to listOf("Eb","F","G","Ab","Bb","C","D"),
    "Ab-major" to listOf("Ab","Bb","C","Db","Eb","F","G"),
    "Db-major" to listOf("Db","Eb","F","Gb","Ab","Bb","C"),
    "Gb-major" to listOf("Gb","Ab","Bb","Cb","Db","Eb","F"),
    "Cb-major" to listOf("Cb","Db","Eb","Fb","Gb","Ab","Bb"),
    // Minor keys
    "A-minor" to listOf("A","B","C","D","E","F","G"),
    "E-minor" to listOf("E","F#","G","A","B","C","D"),
    "B-minor" to listOf("B","C#","D","E","F#","G","A"),
    "F#-minor" to listOf("F#","G#","A","B","C#","D","E"),
    "C#-minor" to listOf("C#","D#","E","F#","G#","A","B"),
    "G#-minor" to listOf("G#","A#","B","C#","D#","E","F#"),
    "D#-minor" to listOf("D#","E#","F#","G#","A#","B","C#"),
    "A#-minor" to listOf("A#","B#","C#","D#","E#","F#","G#"),
    "D-minor" to listOf("D","E","F","G","A","Bb","C"),
    "G-minor" to listOf("G","A","Bb","C","D","Eb","F"),
    "C-minor" to listOf("C","D","Eb","F","G","Ab","Bb"),
    "F-minor" to listOf("F","G","Ab","Bb","C","Db","Eb"),
    "Bb-minor" to listOf("Bb","C","Db","Eb","F","Gb","Ab"),
    "Eb-minor" to listOf("Eb","F","Gb","Ab","Bb","Cb","Db"),
    "Ab-minor" to listOf("Ab","Bb","Cb","Db","Eb","Fb","Gb"),
)

private val ENHARMONIC_PAIRS = mapOf(
    "C#" to "Db", "Db" to "C#",
    "D#" to "Eb", "Eb" to "D#",
    "F#" to "Gb", "Gb" to "F#",
    "G#" to "Ab", "Ab" to "G#",
    "A#" to "Bb", "Bb" to "A#",
    "E#" to "Fb", "Fb" to "E#",
    "B#" to "Cb", "Cb" to "B#"
)

private val FLAT_NAMES_EN = arrayOf("C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B")

private fun getEnharmonicPair(note: String): String? = ENHARMONIC_PAIRS[note]

/** Returns the correct enharmonic note name for a pitch class given the key signature. */
fun getEnharmonicNote(pitchClass: Int, keySignature: KeySignature): String {
    val rawName = SHARP_NAMES_EN[pitchClass]
    val keyName = keySignature.keyName
    val scaleNotes = KEY_SCALE_NOTES[keyName]

    if (scaleNotes != null) {
        // Check if raw name is in the scale
        if (rawName in scaleNotes) return EN_TO_FR[rawName] ?: rawName
        // Check enharmonic
        val enharmonic = getEnharmonicPair(rawName)
        if (enharmonic != null && enharmonic in scaleNotes) return EN_TO_FR[enharmonic] ?: enharmonic
        // Chromatic: use flat preference from scale
        val usesFlats = scaleNotes.any { it.contains("b") }
        return if (usesFlats) EN_TO_FR[FLAT_NAMES_EN[pitchClass]] ?: rawName
        else EN_TO_FR[rawName] ?: rawName
    }

    // Fallback
    return if (keySignature.useFlats) FLAT_NAMES_FR[pitchClass] else SHARP_NAMES_FR[pitchClass]
}

/** Returns French note name, e.g. "Do#4", "Sib3" */
fun midiToFrench(midi: Int, showOctave: Boolean = true, useFlats: Boolean = false, keySignature: KeySignature? = null): String {
    val name = if (keySignature != null) {
        getEnharmonicNote(midi % 12, keySignature)
    } else {
        val names = if (useFlats) FLAT_NAMES_FR else SHARP_NAMES_FR
        names[midi % 12]
    }
    return if (showOctave) "$name${midi / 12 - 1}" else name
}

/** Returns French note name for a pitch class (0-11) given useFlats flag. */
fun getNoteNameForKey(pitchClass: Int, useFlats: Boolean): String {
    return if (useFlats) FLAT_NAMES_FR[pitchClass] else SHARP_NAMES_FR[pitchClass]
}

// ─── Key detection (Krumhansl-Schmuckler) ────────────────────────────────────

private val MAJOR_PROFILE = doubleArrayOf(6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88)
private val MINOR_PROFILE = doubleArrayOf(6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17)

data class KeySignature(val root: Int, val isMinor: Boolean, val useFlats: Boolean) {
    /** Key name for scale lookup, e.g. "Bb-major", "C#-minor" */
    val keyName: String get() {
        val enName = if (useFlats) FLAT_NAMES_EN[root] else SHARP_NAMES_EN[root]
        return "$enName-${if (isMinor) "minor" else "major"}"
    }
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

// ─── Chord detection (template-based, ported from web app) ───────────────────

data class ChordTemplate(val intervals: List<Int>, val quality: String)

val CHORD_TEMPLATES = listOf(
    // 4-note chords first (more specific = higher priority)
    ChordTemplate(listOf(0,4,5,11), "Maj7add11"),
    ChordTemplate(listOf(0,4,7,11), "Maj7"),
    ChordTemplate(listOf(0,4,7,10), "7"),
    ChordTemplate(listOf(0,3,7,10), "min7"),
    ChordTemplate(listOf(0,3,6,10), "min7b5"),
    ChordTemplate(listOf(0,3,6,9), "dim7"),
    ChordTemplate(listOf(0,5,7,10), "7sus4"),
    ChordTemplate(listOf(0,5,7,11), "Maj7sus4"),
    ChordTemplate(listOf(0,4,7,9), "6"),
    ChordTemplate(listOf(0,3,7,9), "min6"),
    ChordTemplate(listOf(0,2,4,7), "add9"),
    ChordTemplate(listOf(0,2,3,7), "minadd9"),
    // Triads
    ChordTemplate(listOf(0,4,7), "Maj"),
    ChordTemplate(listOf(0,3,7), "min"),
    ChordTemplate(listOf(0,3,6), "dim"),
    ChordTemplate(listOf(0,4,8), "aug"),
    ChordTemplate(listOf(0,2,7), "sus2"),
    ChordTemplate(listOf(0,5,7), "sus4"),
)

/** Check if a set of intervals matches a template (allows extra intervals). */
fun intervalsMatch(intervals: List<Int>, template: List<Int>): Boolean {
    return template.all { t -> t in intervals }
}

data class ChordDetectionResult(
    val rootName: String,
    val quality: String,
    val displayName: String,
    val rootPitchClass: Int
)

/**
 * Identify a chord from an array of MIDI pitches.
 * Prefers the lowest note as root, then tries other pitch classes.
 */
fun identifyChord(midiPitches: List<Int>, useFlats: Boolean = false): ChordDetectionResult? {
    if (midiPitches.isEmpty()) return null
    val pitchClasses = midiPitches.map { it % 12 }.toSet().toList()
    if (pitchClasses.size < 3) return null

    val lowestPitchClass = midiPitches.min() % 12
    val orderedRoots = listOf(lowestPitchClass) + pitchClasses.filter { it != lowestPitchClass }

    for (root in orderedRoots) {
        val intervals = pitchClasses.map { ((it - root + 12) % 12) }.sorted()
        for (template in CHORD_TEMPLATES) {
            if (intervalsMatch(intervals, template.intervals)) {
                val rootName = getNoteNameForKey(root, useFlats)
                val displayName = formatChordDisplayName(rootName, template.quality)
                return ChordDetectionResult(rootName, template.quality, displayName, root)
            }
        }
    }
    return null
}

/**
 * Format chord display name with major/minor casing convention.
 * Minor chords -> lowercase root, Major chords -> UPPERCASE root.
 */
fun formatChordDisplayName(rootName: String, quality: String): String {
    val isMinor = quality.startsWith("min")
    val root = if (isMinor) rootName.lowercase() else rootName.uppercase()
    return when {
        quality == "Maj" -> root
        quality == "min" -> root
        isMinor -> {
            val suffix = quality.removePrefix("min")
            "$root min$suffix"
        }
        else -> "$root $quality"
    }
}

// ─── Legacy ChordInfo adapter (keeps existing callers working) ───────────────

data class ChordInfo(
    val name: String,       // "ré", "SOL", "SOL 7"…
    val bassNote: String? = null,
    val isArpeggio: Boolean = false
)

/** Detects chord name from a set of MIDI pitches. Returns null if unrecognised. */
fun detectChord(pitches: Collection<Int>, useFlats: Boolean = false): ChordInfo? {
    if (pitches.size < 2) return null
    val pitchList = pitches.toList()
    val result = identifyChord(pitchList, useFlats) ?: return null

    // Determine bass note (lowest pitch)
    val lowestPitch = pitchList.min()
    val lowestPc = lowestPitch % 12
    val bassNote = if (lowestPc != result.rootPitchClass) {
        getNoteNameForKey(lowestPc, useFlats)
    } else null

    return ChordInfo(name = result.displayName, bassNote = bassNote)
}

/**
 * Find the first cycle of an arpeggio pattern by pitch-class set repetition.
 */
fun firstArpeggioCycle(notes: List<NoteEvent>): List<NoteEvent> {
    val total = notes.size
    if (total <= 4) return notes

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
    return notes
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

// ─── Arpeggio motif detection (ported from web app) ──────────────────────────

data class ChordWithReps(
    val name: String,       // "sol" or "SOL"
    val suffix: String,     // "7", "min7", ""
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
 * Full port of web app's detectArpeggioMotifs logic:
 * 1. Extract all MIDI pitches in order
 * 2. Try identifyChord(ALL pitches) -> singleChord
 * 3. If <=3 notes: return singleChord
 * 4. Find smallest homogeneous cycle (same pitch-class set per cycle)
 * 5. If homogeneous + singleChord: return singleChord x N with per-cycle bass
 * 6. If NOT homogeneous: try per-cycle distinct chords
 * 7. Fallback: singleChord with bass from first note
 */
fun detectArpeggioMotifs(notes: List<NoteEvent>, useFlats: Boolean = false): ArpeggioMotifResult {
    val totalNotes = notes.size
    if (totalNotes == 0) return ArpeggioMotifResult(emptyList(), 0, 0, false, "Accords")

    val midiPitches = notes.map { it.pitch }

    // Try to identify a single chord from all notes
    val singleChord = identifyChord(midiPitches, useFlats)

    // For 3 or fewer notes, return single chord
    if (totalNotes <= 3) {
        if (singleChord == null) return ArpeggioMotifResult(emptyList(), totalNotes, totalNotes, false, "Accords")
        val cwr = chordDetectionToWithReps(singleChord, midiPitches, 1, useFlats)
        return ArpeggioMotifResult(listOf(cwr), totalNotes, totalNotes, false, "Accords")
    }

    // Find the smallest homogeneous cycle
    val uniqueCount = midiPitches.map { it % 12 }.toSet().size
    var bestHomogeneousCycle: Int? = null

    for (cycleLen in maxOf(3, uniqueCount)..totalNotes / 2) {
        if (totalNotes % cycleLen != 0) continue
        val patternSet = midiPitches.take(cycleLen).map { it % 12 }.toSet()
        val patternSorted = patternSet.sorted().joinToString(",")
        var matches = true
        for (rep in 1 until totalNotes / cycleLen) {
            val repSet = mutableSetOf<Int>()
            for (j in 0 until cycleLen) {
                repSet.add(midiPitches[rep * cycleLen + j] % 12)
            }
            if (repSet.sorted().joinToString(",") != patternSorted) {
                matches = false
                break
            }
        }
        if (matches) {
            bestHomogeneousCycle = cycleLen
            break
        }
    }

    // If homogeneous repeating cycle found + singleChord: return single chord x N with per-cycle bass
    if (bestHomogeneousCycle != null && singleChord != null) {
        val reps = totalNotes / bestHomogeneousCycle
        val chords = mutableListOf<ChordWithReps>()
        for (i in 0 until reps) {
            val cyclePitches = midiPitches.subList(i * bestHomogeneousCycle, (i + 1) * bestHomogeneousCycle)
            val bassPitchClass = midiPitches[i * bestHomogeneousCycle] % 12
            val bassNote = if (singleChord.rootPitchClass != bassPitchClass) {
                getNoteNameForKey(bassPitchClass, useFlats)
            } else null
            chords.add(ChordWithReps(
                name = singleChord.displayName,
                suffix = "",
                bassNote = bassNote,
                repetitions = 1,
                cycleNotes = cyclePitches
            ))
        }
        // Group consecutive identical chords
        val grouped = groupConsecutiveChords(chords)
        val header = "Accords (arp. ${totalNotes} notes, ${reps}x$bestHomogeneousCycle)"
        return ArpeggioMotifResult(grouped, totalNotes, bestHomogeneousCycle, true, header)
    }

    // No homogeneous cycle -- try to detect distinct chords per group
    for (cycleLen in 3..minOf(6, totalNotes / 2)) {
        if (totalNotes % cycleLen != 0) continue
        val numChords = totalNotes / cycleLen

        // Check if groups actually differ (different first note = different bass)
        var hasDistinctGroups = false
        for (i in 1 until numChords) {
            if (midiPitches[i * cycleLen] % 12 != midiPitches[0] % 12) {
                hasDistinctGroups = true
                break
            }
        }

        if (hasDistinctGroups && numChords > 1) {
            // Identify a chord per cycle
            val chords = mutableListOf<ChordWithReps>()
            for (i in 0 until numChords) {
                val cyclePitches = midiPitches.subList(i * cycleLen, (i + 1) * cycleLen)
                val bassPitchClass = cyclePitches[0] % 12
                val bassName = getNoteNameForKey(bassPitchClass, useFlats)

                // Try identifying from this cycle's pitches, or fall back to singleChord
                val chord = identifyChord(cyclePitches, useFlats) ?: singleChord

                if (chord != null) {
                    chords.add(ChordWithReps(
                        name = chord.displayName,
                        suffix = "",
                        bassNote = if (chord.rootPitchClass != bassPitchClass) bassName else null,
                        repetitions = 1,
                        cycleNotes = cyclePitches
                    ))
                } else {
                    chords.add(ChordWithReps(
                        name = "$bassName...",
                        suffix = "",
                        bassNote = null,
                        repetitions = 1,
                        cycleNotes = cyclePitches
                    ))
                }
            }

            val header = "Accords (arp. ${totalNotes} notes, ${numChords}x$cycleLen)"
            return ArpeggioMotifResult(chords, totalNotes, cycleLen, true, header)
        }

        // Check for identical sub-chords (homogeneous but missed above)
        val subChords = mutableListOf<ChordDetectionResult>()
        for (i in 0 until numChords) {
            val cyclePitches = midiPitches.subList(i * cycleLen, (i + 1) * cycleLen)
            val chord = identifyChord(cyclePitches, useFlats) ?: break
            subChords.add(chord)
        }
        if (subChords.size == numChords && subChords.all { it.displayName == subChords[0].displayName }) {
            val cwr = chordDetectionToWithReps(subChords[0], midiPitches.take(cycleLen), 1, useFlats)
            val grouped = listOf(cwr.copy(repetitions = numChords))
            val header = "Accords (arp. ${totalNotes} notes, ${numChords}x$cycleLen)"
            return ArpeggioMotifResult(grouped, totalNotes, cycleLen, true, header)
        }
    }

    // Fallback: single chord from all notes, with slash bass if needed
    if (singleChord != null) {
        val bassPitchClass = midiPitches[0] % 12
        val bassNote = if (singleChord.rootPitchClass != bassPitchClass) {
            getNoteNameForKey(bassPitchClass, useFlats)
        } else null
        val cwr = ChordWithReps(
            name = singleChord.displayName,
            suffix = "",
            bassNote = bassNote,
            repetitions = 1,
            cycleNotes = midiPitches
        )
        return ArpeggioMotifResult(listOf(cwr), totalNotes, totalNotes, false, "Accords")
    }

    return ArpeggioMotifResult(emptyList(), totalNotes, totalNotes, false, "Accords")
}

/** Convert a ChordDetectionResult to a ChordWithReps. */
private fun chordDetectionToWithReps(
    chord: ChordDetectionResult,
    cyclePitches: List<Int>,
    repetitions: Int,
    useFlats: Boolean
): ChordWithReps {
    return ChordWithReps(
        name = chord.displayName,
        suffix = if (chord.quality == "Maj" || chord.quality == "min") "" else chord.quality,
        bassNote = null,
        repetitions = repetitions,
        cycleNotes = cyclePitches
    )
}

/** Group consecutive ChordWithReps that have the same name+bassNote. */
private fun groupConsecutiveChords(chords: List<ChordWithReps>): List<ChordWithReps> {
    if (chords.isEmpty()) return emptyList()
    val grouped = mutableListOf<ChordWithReps>()
    var i = 0
    while (i < chords.size) {
        val current = chords[i]
        val key = "${current.name}/${current.bassNote}"
        var count = 1
        while (i + count < chords.size) {
            val next = chords[i + count]
            val nextKey = "${next.name}/${next.bassNote}"
            if (nextKey == key) count++ else break
        }
        grouped.add(current.copy(repetitions = count))
        i += count
    }
    return grouped
}
