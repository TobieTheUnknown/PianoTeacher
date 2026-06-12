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

// ─── Harmonic degree computation ─────────────────────────────────────────────

private val MAJOR_SCALE_MAP = mapOf(0 to 1, 2 to 2, 4 to 3, 5 to 4, 7 to 5, 9 to 6, 11 to 7)
private val MINOR_SCALE_MAP = mapOf(0 to 1, 2 to 2, 3 to 3, 5 to 4, 7 to 5, 8 to 6, 10 to 7)
private val ROMAN_NUMERALS = arrayOf("", "I", "II", "III", "IV", "V", "VI", "VII")

/**
 * Compute the harmonic degree (Roman numeral) of a chord in a given key.
 *
 * Inputs:
 *   - chord.rootPitchClass: pitch class of the chord root (0-11)
 *   - chord.quality: quality string (e.g. "min", "min7", "dim", "aug", "7", "Maj")
 *   - keySignature.root: tonic pitch class (0-11)
 *   - keySignature.isMinor: true for natural minor, false for major
 *
 * Returns Roman numeral string (e.g. "i", "V7", "♭VII", "ii7") or null
 * when key or chord is missing / unresolvable.
 *
 * Examples in Do mineur: Do m → "i"; Fa m → "iv"; Ré m7 → "ii7";
 *   Lab → "VI"; Mib → "III"; Sib → "VII"; Sol → "V".
 */
fun chordDegree(chord: ChordDetectionResult, keySignature: KeySignature?): String? {
    if (keySignature == null) return null
    val interval = ((chord.rootPitchClass - keySignature.root) + 12) % 12
    val scale = if (keySignature.isMinor) MINOR_SCALE_MAP else MAJOR_SCALE_MAP

    val quality = chord.quality
    val isLower = quality.startsWith("min") || quality.startsWith("dim")
    val dimSuffix  = if (quality.startsWith("dim")) "°" else ""
    val augSuffix  = if (quality.startsWith("aug")) "+" else ""
    val sevenSuffix = if (quality.contains("7")) "7" else ""
    val suffix = dimSuffix + augSuffix + sevenSuffix

    fun toRoman(deg: Int): String {
        val base = ROMAN_NUMERALS[deg]
        return if (isLower) base.lowercase() else base
    }

    scale[interval]?.let { return toRoman(it) + suffix }

    // Chromatic: try ♭(interval+1) then ♯(interval-1)
    scale[(interval + 1) % 12]?.let { return "♭${toRoman(it)}$suffix" }
    scale[(interval - 1 + 12) % 12]?.let { return "♯${toRoman(it)}$suffix" }

    return null
}

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
 * `chord` is the underlying identified chord, used to compute the harmonic degree.
 */
data class ArpeggioBadge(
    val label: String,
    val altered: Boolean,
    val alteredNoteName: String?,
    val cycleNotes: List<Int>,
    val chord: ChordDetectionResult? = null,
    // Chord label WITHOUT the composed " ×N" suffix, plus the literal
    // intra-measure repetition count — the unified Ostinato badge renders
    // them separately so the ×N can never be doubled or clipped.
    val bareLabel: String = label,
    val reps: Int = 1,
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
 * French note label for a pitch class, capitalized like a single note name
 * ("Fa", "Sib", "La") regardless of chord quality. Used for ostinato / pédale
 * motif labels. Mirrors web's noteLabelForPitchClass.
 */
fun noteLabelForPitchClass(pc: Int, keySignature: KeySignature?): String =
    capitalizeNote(arpeggioRootName(pc, keySignature))

/** Result of identifyChordWithTolerance — the chord plus alteration metadata. */
data class ToleratedChord(
    val chord: ChordDetectionResult,
    val altered: Boolean,
    val alteredNoteName: String?,
)

/**
 * Identify a chord from MIDI pitches with the two tolerances used across the
 * measure analysis (mirrors web's identifyChordWithTolerance):
 *   · EXACT pre-pass — prefer a template whose pitch classes EXACTLY equal the
 *     measure's set (no foreign, no missing tone), roots tried bass-first, the
 *     richest template winning (CHORD_TEMPLATES is most-specific first).
 *   · lax identifyChord + re-check: at most ONE foreign pitch class (a passing
 *     tone), instance-capped; the chord itself must still be fully present.
 *   · INCOMPLETE 4-note fallback: exactly 3 of a 4-tone template's pitch
 *     classes, no foreign tone (e.g. {Fa,Sib,La} = Sib Maj7 without the Ré).
 *
 * Roots resolved key-aware (enharmonic correction) like web's getRootName.
 */
fun identifyChordWithTolerance(
    pitches: List<Int>,
    keySignature: KeySignature?,
): ToleratedChord? {
    if (pitches.isEmpty()) return null
    val pitchClasses = pitches.map { it % 12 }.toSet().toList()
    if (pitchClasses.size < 3) return null

    fun makeChord(root: Int, quality: String): ChordDetectionResult {
        val rootName = arpeggioRootName(root, keySignature)
        return ChordDetectionResult(
            rootName = rootName,
            quality = quality,
            displayName = formatChordDisplayName(rootName, quality),
            rootPitchClass = root,
        )
    }

    // EXACT pre-pass: the first exact full match (richest, bass-first roots).
    val pcSet = pitchClasses.toSet()
    val bassPc = pitches[0] % 12
    val exactRoots = listOf(bassPc) + pitchClasses.filter { it != bassPc }
    for (template in CHORD_TEMPLATES) {
        if (template.intervals.size != pcSet.size) continue
        for (root in exactRoots) {
            val templatePcs = template.intervals.map { (root + it) % 12 }.toSet()
            if (templatePcs.size == pcSet.size && pcSet.all { it in templatePcs }) {
                return ToleratedChord(makeChord(root, template.quality), false, null)
            }
        }
    }

    val direct = identifyChord(pitches, keySignature?.useFlats ?: false)
    if (direct != null) {
        // identifyChord tolerates extra notes — re-check its template against ALL
        // pitch classes and count the foreign ones.
        val template = CHORD_TEMPLATES.firstOrNull { it.quality == direct.quality } ?: return null
        val allowed = template.intervals.toSet()
        val root = direct.rootPitchClass
        val foreignPcs = pitchClasses.filter { pc -> ((pc - root + 12) % 12) !in allowed }
        if (foreignPcs.size > 1) return null
        if (pitchClasses.size - foreignPcs.size < 3) return null

        var altered = false
        var alteredNoteName: String? = null
        if (foreignPcs.size == 1) {
            val foreignPc = foreignPcs[0]
            val foreignInstances = pitches.count { it % 12 == foreignPc }
            if (foreignInstances > max(1, floor(pitches.size / 4.0).toInt())) return null
            altered = true
            alteredNoteName = arpeggioRootName(foreignPc, keySignature)
        }
        // Re-resolve display root key-aware (identifyChord used useFlats only).
        val keyAwareRoot = arpeggioRootName(direct.rootPitchClass, keySignature)
        val keyAware = direct.copy(
            rootName = keyAwareRoot,
            displayName = formatChordDisplayName(keyAwareRoot, direct.quality),
        )
        return ToleratedChord(keyAware, altered, alteredNoteName)
    }

    // INCOMPLETE 4-note chord: exactly 3 of a 4-tone template, no foreign tone.
    val rootsToTry = listOf(bassPc) + pitchClasses.filter { it != bassPc }
    for (root in rootsToTry) {
        for (template in CHORD_TEMPLATES) {
            if (template.intervals.size != 4) continue
            val allowed = template.intervals.toSet()
            val intervals = pitchClasses.map { (it - root + 12) % 12 }
            if (pitchClasses.size == 3 && intervals.all { it in allowed }) {
                return ToleratedChord(makeChord(root, template.quality), true, null)
            }
        }
    }
    return null
}

/** Combined-harmony badge for a measure (BOTH hands together). */
data class MeasureHarmony(
    val chord: ChordDetectionResult,
    val altered: Boolean,
    val label: String,
    val degree: String?,
    val bassPitchClass: Int,
)

/**
 * Combined-harmony badge: identify the chord from ALL pitch classes of BOTH
 * hands via identifyChordWithTolerance. The bass is the LOWEST sounding pitch
 * of the whole measure (slash when ≠ chord root). Mirrors web getMeasureHarmony.
 */
fun getMeasureHarmony(allPitches: List<Int>, keySignature: KeySignature?): MeasureHarmony? {
    if (allPitches.isEmpty()) return null
    val identified = identifyChordWithTolerance(allPitches, keySignature) ?: return null
    val bassPitchClass = allPitches.min() % 12
    val label = formatArpeggioBadge(identified.chord, bassPitchClass, keySignature)
    val degree = chordDegree(identified.chord, keySignature)
    return MeasureHarmony(identified.chord, identified.altered, label, degree, bassPitchClass)
}

/** Result of qualifying a hand as an ostinato measure. */
data class OstinatoQualification(
    val motifPcs: List<Int>,
    val motifLabels: List<String>,
    val repetitions: Int,
    val rhythmSig: String,
)

/**
 * Measure-level OSTINATO qualifier: a single-line, regular-rhythm pattern whose
 * ORDERED pitch-class sequence is a motif of length 2..4 repeated ≥2 full times
 * (the LAST repetition may be a strict prefix). Shortest valid motif wins.
 * Mirrors web qualifyOstinatoMeasure.
 */
fun qualifyOstinatoMeasure(
    handNotes: List<NoteEvent>,
    keySignature: KeySignature?,
): OstinatoQualification? {
    if (handNotes.size < 4) return null
    val groups = handNotes.groupBy { it.startTime }.toSortedMap()
    if (groups.values.any { it.size != 1 }) return null

    val ordered = groups.values.map { it.first() }
    val pitches = ordered.map { it.pitch }
    val starts = ordered.map { it.startTime }
    val total = pitches.size
    if (total < 4) return null

    // Regular rhythm: evenly-spaced onsets.
    val eps = 0.06
    val firstGap = starts[1] - starts[0]
    if (firstGap <= 0) return null
    for (i in 1 until starts.size) {
        if (abs((starts[i] - starts[i - 1]) - firstGap) > eps) return null
    }

    val pcs = pitches.map { it % 12 }
    // Need ≥2 distinct pitch classes — a single repeated pitch is a pédale.
    if (pcs.toSet().size < 2) return null

    for (len in 2..4) {
        if (len >= total) break
        val fullReps = total / len
        if (fullReps < 2) continue
        val motif = pcs.take(len)
        if (motif.toSet().size < 2) continue
        var ok = true
        for (i in len until total) {
            if (pcs[i] != motif[i % len]) { ok = false; break }
        }
        if (!ok) continue
        return OstinatoQualification(
            motifPcs = motif,
            motifLabels = motif.map { noteLabelForPitchClass(it, keySignature) },
            repetitions = fullReps,
            rhythmSig = "$total@${"%.2f".format(firstGap)}",
        )
    }
    return null
}

/** Result of qualifying a hand as a pédale measure. */
data class PedalQualification(
    val label: String,
    val octave: Boolean,
)

/**
 * Measure-level PÉDALE qualifier: the hand has ≤2 distinct pitch classes AND its
 * notes are either HELD (duration ≥ half the measure) or simply repeated. Sets
 * the octave flag when two simultaneous pitches sit exactly an octave apart.
 * Mirrors web qualifyPedalMeasure.
 */
fun qualifyPedalMeasure(
    handNotes: List<NoteEvent>,
    unitsPerMeasure: Int,
    keySignature: KeySignature?,
): PedalQualification? {
    if (handNotes.isEmpty()) return null

    val span = if (unitsPerMeasure > 0) unitsPerMeasure else 4
    val groups = handNotes.groupBy { it.startTime }.toSortedMap()
    val allPitches = mutableListOf<Int>()
    var maxDuration = 0.0
    var octave = false
    for ((_, gNotes) in groups) {
        val groupPitches = gNotes.map { it.pitch }
        allPitches.addAll(groupPitches)
        gNotes.forEach { maxDuration = max(maxDuration, it.duration) }
        if (groupPitches.size >= 2) {
            for (i in groupPitches.indices) {
                for (j in i + 1 until groupPitches.size) {
                    if (abs(groupPitches[i] - groupPitches[j]) == 12) octave = true
                }
            }
        }
    }

    val pcs = allPitches.map { it % 12 }.toSet()
    if (pcs.size > 2) return null

    val held = maxDuration >= span / 2.0
    val repeated = groups.size >= 2
    if (!held && !repeated) return null

    val bassPc = allPitches.min() % 12
    return PedalQualification(
        label = noteLabelForPitchClass(bassPc, keySignature),
        octave = octave,
    )
}

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

    // (b) Pitch classes must form one identifiable chord, with the two
    // tolerances — delegated to identifyChordWithTolerance (EXACT pre-pass →
    // lax + 1-foreign tone → incomplete-4-note 3-of-4 fallback).
    val pitchClasses = pitches.map { it % 12 }.toSet().toList()
    if (pitchClasses.size < 3 || pitchClasses.size > 5) return null

    val identified = identifyChordWithTolerance(pitches, keySignature) ?: return null
    val chord = identified.chord

    val bassPitchClass = pitches[0] % 12
    return ArpeggioMeasureQualification(
        chord = chord,
        bassPitchClass = bassPitchClass,
        noteCount = pitches.size,
        altered = identified.altered,
        alteredNoteName = identified.alteredNoteName,
        badge = formatArpeggioBadge(chord, bassPitchClass, keySignature),
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
 * Display-cycle length for grouping note chips one row per occurrence
 * (mirrors the web's detectArpeggioMotifs "distinct chords per cycle"
 * branch, which yields rows of 4 on Departure's do-mib-sol-mib /
 * sol-mib-sol-mib halves):
 *   1. exact literal cycle (the ×N case) → that cycle length;
 *   2. else a cycle length 3..6 dividing the count where the BASS pitch
 *      class changes between cycles (distinct sub-figures);
 *   3. else null — caller falls back to a freely wrapped flow.
 */
fun displayCycleLen(orderedPitches: List<Int>): Int? {
    val n = orderedPitches.size
    if (n < 4) return null
    val (reps, cycle) = exactCycleReps(orderedPitches)
    if (reps > 1) return cycle.size
    for (cycleLen in 3..minOf(6, n / 2)) {
        if (n % cycleLen != 0) continue
        val basePc = orderedPitches[0] % 12
        for (i in 1 until n / cycleLen) {
            if (orderedPitches[i * cycleLen] % 12 != basePc) return cycleLen
        }
    }
    return null
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
                    chord = aq.chord,
                    bareLabel = aq.badge,
                    reps = validReps,
                )
            }
        }
        runStart = runEnd + 1
    }

    return badges.toList()
}

// ─── Per-hand role resolution (ported from web LiveLearning.jsx analysis) ─────
//
// A measure's two hands each resolve to at most one "role" badge. Priority
// mirrors the web: arpège (clean) → ostinato → pédale. A CLEAN (non-altered)
// arpège outranks an ostinato, but an ALTERED/incomplete arpège yields to an
// ostinato (a tight repeating motif is the better lesson). Pédale has no run
// requirement; arpège + ostinato need a RUN of ≥2 consecutive qualifying
// measures (ostinato runs additionally keyed by matching rhythm signature).

/** A resolved per-hand role badge for one measure. */
sealed class HandRole {
    /**
     * Ostinato badge — covers both the old "arpège" (chord-reducible figure) and the
     * "ostinato" (literal repeating motif) paths. When `chordLabel` is non-null the
     * figure is chord-reducible and the UI shows "Ostinato <chordLabel>" (+ altered
     * mention when `chordAltered`). Otherwise `ostinato` carries the motif and the UI
     * shows "Ostinato Fa·Sib·La ×N".
     *
     * `×N` is appended only for literal intra-measure cycle repetitions:
     *   · chord-reducible path: supplied via `chordReps` (from exactCycleReps on the
     *     arpeggio notes) — never fabricated.
     *   · motif path: from OstinatoQualification.repetitions (≥2 by construction).
     */
    data class Ostinato(
        val ostinato: OstinatoQualification?,
        // Chord-reducible fields — non-null only when the source was qualifyArpeggioMeasure.
        val chordLabel: String? = null,
        val chordAltered: Boolean = false,
        val chordAlteredNote: String? = null,
        val chordReps: Int = 1,
    ) : HandRole()
    data class Pedal(val pedal: PedalQualification) : HandRole()
}

/** Everything the card needs to render one measure's analysis. */
data class MeasureRoles(
    val harmony: MeasureHarmony?,
    val leftRole: HandRole?,
    val rightRole: HandRole?,
    // Kept for Détail-ON MotifRows grouping (note chips grouped by motif).
    val leftOstinato: OstinatoQualification?,
    val rightOstinato: OstinatoQualification?,
)

/**
 * Resolve per-hand roles + combined harmony for every measure, applying the
 * web's consecutive-measures run rules. `leftHandNotes` = chords (left hand),
 * `rightHandNotes` = melody (right hand); both in global measure order.
 *
 * Mirrors LiveLearning.jsx: arpeggio badge run (left), right-arpeggio run,
 * per-hand ostinato runs keyed by rhythm signature, per-measure pédale, then
 * the priority resolution (clean arpège > ostinato > altered arpège yields to
 * ostinato > pédale).
 */
fun computeMeasureRoles(
    leftHandNotes: List<List<NoteEvent>>,
    rightHandNotes: List<List<NoteEvent>>,
    unitsPerMeasure: Int,
    keySignature: KeySignature?,
): List<MeasureRoles> {
    val n = leftHandNotes.size

    // Left-hand arpeggio badges (run-gated ×N) — reuse the existing pass.
    val leftArpBadges = computeArpeggioBadges(leftHandNotes, keySignature)

    // Per-measure qualifiers.
    val rightArpQuals = rightHandNotes.map { qualifyArpeggioMeasure(it, keySignature) }
    val leftOstinato = leftHandNotes.map { qualifyOstinatoMeasure(it, keySignature) }
    val rightOstinato = rightHandNotes.map { qualifyOstinatoMeasure(it, keySignature) }
    val leftPedal = leftHandNotes.map { qualifyPedalMeasure(it, unitsPerMeasure, keySignature) }
    val rightPedal = rightHandNotes.map { qualifyPedalMeasure(it, unitsPerMeasure, keySignature) }
    val harmonies = (0 until n).map { i ->
        val all = (rightHandNotes[i] + leftHandNotes[i]).map { it.pitch }
        getMeasureHarmony(all, keySignature)
    }

    // Generic run-rule: flag every measure in a run of ≥2 where pick is non-null
    // AND (optionally) the neighbouring sameSig predicate holds.
    fun applyRunRule(
        pick: (Int) -> Boolean,
        sameSig: ((Int, Int) -> Boolean)? = null,
    ): BooleanArray {
        val active = BooleanArray(n)
        var s = 0
        while (s < n) {
            if (!pick(s)) { s++; continue }
            var e = s
            while (e + 1 < n && pick(e + 1) && (sameSig == null || sameSig(e, e + 1))) e++
            if (e - s + 1 >= 2) for (i in s..e) active[i] = true
            s = e + 1
        }
        return active
    }

    val rightArpActive = applyRunRule({ rightArpQuals[it] != null })
    val leftOstinatoActive = applyRunRule(
        { leftOstinato[it] != null },
        { a, b -> leftOstinato[a]!!.rhythmSig == leftOstinato[b]!!.rhythmSig },
    )
    val rightOstinatoActive = applyRunRule(
        { rightOstinato[it] != null },
        { a, b -> rightOstinato[a]!!.rhythmSig == rightOstinato[b]!!.rhythmSig },
    )

    return (0 until n).map { i ->
        // LEFT hand
        val leftBadge = leftArpBadges[i]
        val leftArpClean = leftBadge != null && !leftBadge.altered
        val leftRole: HandRole? = when {
            leftBadge != null && (leftArpClean || !leftOstinatoActive[i]) ->
                HandRole.Ostinato(
                    ostinato = null,
                    chordLabel = leftBadge.bareLabel,
                    chordAltered = leftBadge.altered,
                    chordAlteredNote = leftBadge.alteredNoteName,
                    chordReps = leftBadge.reps,
                )
            leftOstinatoActive[i] && leftOstinato[i] != null ->
                HandRole.Ostinato(leftOstinato[i]!!)
            leftPedal[i] != null -> HandRole.Pedal(leftPedal[i]!!)
            else -> null
        }

        // RIGHT hand
        val rightArp = if (rightArpActive[i]) rightArpQuals[i] else null
        val rightArpClean = rightArp != null && !rightArp.altered
        val rightRole: HandRole? = when {
            rightArp != null && (rightArpClean || !rightOstinatoActive[i]) ->
                HandRole.Ostinato(
                    ostinato = null,
                    chordLabel = rightArp.badge,
                    chordAltered = rightArp.altered,
                    chordAlteredNote = rightArp.alteredNoteName,
                    chordReps = 1,
                )
            rightOstinatoActive[i] && rightOstinato[i] != null ->
                HandRole.Ostinato(rightOstinato[i]!!)
            rightPedal[i] != null -> HandRole.Pedal(rightPedal[i]!!)
            else -> null
        }

        MeasureRoles(
            harmony = harmonies[i],
            leftRole = leftRole,
            rightRole = rightRole,
            leftOstinato = if (leftOstinatoActive[i]) leftOstinato[i] else null,
            rightOstinato = if (rightOstinatoActive[i]) rightOstinato[i] else null,
        )
    }
}
