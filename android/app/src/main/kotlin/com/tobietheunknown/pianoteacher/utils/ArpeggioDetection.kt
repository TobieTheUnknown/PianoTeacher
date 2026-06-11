package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max

// ─── Measure-level arpeggio qualifier (ported from web chordDetection.js) ─────
//
// Mirrors web/src/utils/chordDetection.js exactly:
//   · qualifyArpeggioMeasure   — the ≥4-note regular-rhythm + anti-melody guard
//                                + altered-tolerance qualifier
//   · formatArpeggioBadge      — DO / do m / fa m/do casing rules
//   · the "Consecutive-measures arpeggio trigger" run pass (applyArpeggioRun)
//
// These build on the already-ported identifyChord / CHORD_TEMPLATES /
// formatChordDisplayName helpers in MusicUtils.kt.

/** Result of qualifying a single measure as an arpeggio measure. */
data class ArpeggioMeasureQualification(
    val chord: ChordDetectionResult,
    val bassPitchClass: Int,
    val noteCount: Int,
    val altered: Boolean,
    val alteredNoteName: String?,
    val badge: String,
)

/**
 * The activated arpeggio badge for a measure, decided by the consecutive-run
 * pass. `label` already carries the optional " ×N". `cycleNotes` are the MIDI
 * pitches of ONE cycle when exact ×N, else the full ordered sequence (capped).
 */
data class ArpeggioBadge(
    val label: String,
    val altered: Boolean,
    val alteredNoteName: String?,
    val cycleNotes: List<Int>,
)

/**
 * French root name for a pitch class, key-aware (mirrors web's getRootName,
 * which applies enharmonic correction from the key signature).
 */
private fun arpeggioRootName(pitchClass: Int, keySignature: KeySignature?): String {
    return if (keySignature != null) getEnharmonicNote(pitchClass, keySignature)
    else getNoteNameForKey(pitchClass, false)
}

/**
 * Build the arpeggio-badge label for a measure.
 *
 * Every note starts with a capital; the CASING alone carries the quality:
 * "Do" = Do mineur, "DO" = DO majeur — no "m" suffix. Extensions keep their
 * digits: min7 → "Do 7", dominant 7 → "DO 7". Slash bass is appended (and
 * capitalized) when the bass pitch class differs from the root ("Fa/Do").
 */
fun formatArpeggioBadge(
    chord: ChordDetectionResult,
    bassPitchClass: Int,
    keySignature: KeySignature?,
): String {
    val isMinor = chord.quality.startsWith("min")
    val root = if (isMinor) capitalizeNote(chord.rootName) else chord.rootName.uppercase()

    var label = when {
        chord.quality == "Maj" || chord.quality == "min" -> root
        isMinor -> {
            val suffix = chord.quality.removePrefix("min")
            if (suffix.isEmpty()) root else "$root $suffix"
        }
        else -> "$root ${chord.quality}"
    }

    if (chord.rootPitchClass != bassPitchClass) {
        val bassName = capitalizeNote(arpeggioRootName(bassPitchClass, keySignature))
        label += "/$bassName"
    }
    return label
}

/** Capitalize the first letter only: "mib"/"MIB" → "Mib". */
private fun capitalizeNote(name: String): String =
    if (name.isEmpty()) name
    else name.first().uppercaseChar() + name.drop(1).lowercase()

/**
 * Measure-level arpeggio qualifier. A measure qualifies when:
 *   (a) ≥4 notes played one-at-a-time with a REGULAR rhythm
 *       (evenly-spaced onsets + uniform duration), AND
 *   (b) ≥60% of consecutive intervals are leaps (≥3 semitones) — anti-melody
 *       guard, AND
 *   (c) the pitch classes form exactly one identifiable chord, tolerating
 *       EITHER one foreign pitch class (instance-capped) OR exactly 3 pcs of a
 *       4-note template (one missing tone) — both flagged `altered`.
 *
 * @param chordNotes the left-hand notes of one measure (flat list)
 * @param keySignature for enharmonic root naming; may be null
 */
fun qualifyArpeggioMeasure(
    chordNotes: List<NoteEvent>,
    keySignature: KeySignature?,
): ArpeggioMeasureQualification? {
    if (chordNotes.size < 4) return null

    // Group simultaneous notes by onset; a true single-line arpeggio has exactly
    // one note per onset group.
    val groups = chordNotes
        .groupBy { it.startTime }
        .toSortedMap()
    if (groups.values.any { it.size != 1 }) return null

    val ordered = groups.values.map { it.first() }
    val pitches = ordered.map { it.pitch }
    val starts = ordered.map { it.startTime }
    val durations = ordered.map { it.duration }

    if (pitches.size < 4) return null

    // (a) Regular rhythm: evenly-spaced onsets and uniform duration.
    val eps = 0.06
    val firstGap = starts[1] - starts[0]
    if (firstGap <= 0) return null
    for (i in 1 until starts.size) {
        if (abs((starts[i] - starts[i - 1]) - firstGap) > eps) return null
    }
    val d0 = durations[0]
    if (durations.any { abs(it - d0) > eps }) return null

    // Anti-melody guard: require ≥60% leaps (≥3 semitones) between consecutive
    // notes.
    var leaps = 0
    for (i in 1 until pitches.size) {
        if (abs(pitches[i] - pitches[i - 1]) >= 3) leaps++
    }
    if (leaps.toDouble() / (pitches.size - 1) < 0.6) return null

    // (b) Pitch classes must form one identifiable chord, with tolerances.
    val pitchClasses = pitches.map { it % 12 }.toSet().toList()
    if (pitchClasses.size < 3 || pitchClasses.size > 5) return null

    var chord: ChordDetectionResult? = identifyChord(pitches, keySignature?.useFlats ?: false)
    var altered = false
    var alteredNoteName: String? = null

    if (chord != null) {
        // Re-check the identified chord's template against ALL pitch classes and
        // count the foreign ones.
        val template = CHORD_TEMPLATES.firstOrNull { it.quality == chord!!.quality } ?: return null
        val allowed = template.intervals.toSet()
        val root = chord.rootPitchClass
        val foreignPcs = pitchClasses.filter { pc -> ((pc - root + 12) % 12) !in allowed }
        if (foreignPcs.size > 1) return null
        if (pitchClasses.size - foreignPcs.size < 3) return null

        if (foreignPcs.size == 1) {
            val foreignPc = foreignPcs[0]
            val foreignInstances = pitches.count { it % 12 == foreignPc }
            if (foreignInstances > max(1, floor(pitches.size / 4.0).toInt())) return null
            altered = true
            alteredNoteName = arpeggioRootName(foreignPc, keySignature)
        }
    } else {
        // No direct match: try an INCOMPLETE 4-note chord — exactly 3 of a
        // 4-tone template's pitch classes, no foreign tone. Bass-first roots.
        val rootsToTry = listOf(pitches[0] % 12) +
            pitchClasses.filter { it != pitches[0] % 12 }
        outer@ for (rootCandidate in rootsToTry) {
            for (template in CHORD_TEMPLATES) {
                if (template.intervals.size != 4) continue
                val allowed = template.intervals.toSet()
                val intervals = pitchClasses.map { (it - rootCandidate + 12) % 12 }
                if (pitchClasses.size == 3 && intervals.all { it in allowed }) {
                    val rootName = arpeggioRootName(rootCandidate, keySignature)
                    chord = ChordDetectionResult(
                        rootName = rootName,
                        quality = template.quality,
                        displayName = formatChordDisplayName(rootName, template.quality),
                        rootPitchClass = rootCandidate,
                    )
                    altered = true
                    break@outer
                }
            }
        }
        if (chord == null) return null
    }

    val resolved = chord!!
    // The web's getRootName applies enharmonic correction; identifyChord here
    // used useFlats only. Re-resolve the display root key-aware so the badge
    // reads "MIB" not "RÉ#" in flat keys.
    val keyAwareRoot = arpeggioRootName(resolved.rootPitchClass, keySignature)
    val keyAwareChord = resolved.copy(
        rootName = keyAwareRoot,
        displayName = formatChordDisplayName(keyAwareRoot, resolved.quality),
    )

    val bassPitchClass = pitches[0] % 12
    return ArpeggioMeasureQualification(
        chord = keyAwareChord,
        bassPitchClass = bassPitchClass,
        noteCount = pitches.size,
        altered = altered,
        alteredNoteName = alteredNoteName,
        badge = formatArpeggioBadge(keyAwareChord, bassPitchClass, keySignature),
    )
}

/**
 * Detect whether the EXACT ordered pitch-class sequence repeats N times across
 * the measure's notes. Returns the repetition count (N ≥ 1) and the notes of
 * ONE cycle. Mirrors detectArpeggioMotifs' `exactCycle` branch: a ×N only when
 * the motif LITERALLY repeats (pitch classes, ordered).
 */
private fun exactCycleReps(pitches: List<Int>): Pair<Int, List<Int>> {
    val total = pitches.size
    if (total < 4) return 1 to pitches
    val pcs = pitches.map { it % 12 }
    val uniqueCount = pcs.toSet().size
    for (cycleLen in max(3, uniqueCount)..total / 2) {
        if (total % cycleLen != 0) continue
        var matches = true
        for (i in cycleLen until total) {
            if (pcs[i] != pcs[i - cycleLen]) { matches = false; break }
        }
        if (matches) return (total / cycleLen) to pitches.take(cycleLen)
    }
    return 1 to pitches
}

/**
 * Consecutive-measures arpeggio trigger.
 *
 * Given the per-measure left-hand notes (flat lists, in global measure order),
 * returns one ArpeggioBadge per measure index (null = no badge). The badge only
 * activates across a RUN of ≥2 consecutive qualifying measures; chords may
 * differ between measures. ×N is appended only when the exact ordered
 * pitch-class sequence repeats N times within that measure.
 *
 * @param measureChordNotes left-hand notes per measure, in global order
 * @param keySignature for enharmonic naming; may be null
 * @return list of nullable badges, same length / order as the input
 */
fun computeArpeggioBadges(
    measureChordNotes: List<List<NoteEvent>>,
    keySignature: KeySignature?,
): List<ArpeggioBadge?> {
    val n = measureChordNotes.size
    val quals = measureChordNotes.map { qualifyArpeggioMeasure(it, keySignature) }
    val badges = arrayOfNulls<ArpeggioBadge>(n)

    var runStart = 0
    while (runStart < n) {
        if (quals[runStart] == null) { runStart++; continue }
        var runEnd = runStart
        while (runEnd + 1 < n && quals[runEnd + 1] != null) runEnd++

        if (runEnd - runStart + 1 >= 2) {
            for (i in runStart..runEnd) {
                val aq = quals[i]!!
                // ×N only when the EXACT ordered note sequence repeats N times
                // and the cycle math accounts for every note in the measure.
                val ordered = measureChordNotes[i]
                    .groupBy { it.startTime }
                    .toSortedMap()
                    .values
                    .map { it.first().pitch }
                val (reps, cycleNotes) = exactCycleReps(ordered)
                val validReps = if (reps > 1 && cycleNotes.size * reps == aq.noteCount) reps else 1
                val label = if (validReps > 1) "${aq.badge} ×$validReps" else aq.badge
                badges[i] = ArpeggioBadge(
                    label = label,
                    altered = aq.altered,
                    alteredNoteName = aq.alteredNoteName,
                    cycleNotes = if (validReps > 1) cycleNotes else ordered.take(12),
                )
            }
        }
        runStart = runEnd + 1
    }

    return badges.toList()
}
