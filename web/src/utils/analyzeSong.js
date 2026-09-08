import { segmentRepeatedMotifs } from './repeatedMotifs.js';
import { getMidiNumber, getNoteNameFromMidi } from '../models/song.js';
import { detectArpeggioMotifs, qualifyArpeggioMeasure, qualifyOstinatoMeasure, qualifyPedalMeasure, getMeasureHarmony } from './chordDetection.js';
import { getMeasuresFromPhrase, groupNotesByTime } from './measureUtils.js';

export function analyzeSong(song) {
    if (!song || !song.phrases || song.phrases.length === 0) {
        return null;
    }

    const measures = [];
    const allNotes = new Set();
    const phraseBreaks = [];
    const beatsPerMeasure = song.timeSignature?.numerator || 4;

    const getRawNoteName = (pitch) => {
        const name = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;
        return name ? name.slice(0, -1) : '';
    };

    // Pitch → MIDI number (notes may store pitch as a number or a name).
    const toMidi = getMidiNumber;

    song.phrases.forEach((phrase, phraseIndex) => {
        if (phraseIndex > 0) {
            phraseBreaks.push({
                measureIndex: measures.length,
                phraseName: phrase.name
            });
        }

        const phraseMeasures = getMeasuresFromPhrase(phrase, song.timeSignature);

        phraseMeasures.forEach(measure => {
            measure.melody.forEach(n => allNotes.add(getRawNoteName(n.pitch)));
            measure.chords.forEach(n => allNotes.add(getRawNoteName(n.pitch)));

            const chordGroups = groupNotesByTime(measure.chords);
            const melodyGroups = groupNotesByTime(measure.melody);
            const isArpeggio = chordGroups.length >= 2 && chordGroups.every(g => g.notes.length === 1);
            const motifInfo = isArpeggio ? detectArpeggioMotifs(chordGroups, song.key) : null;
            const detectedChord = motifInfo ? motifInfo.chord : null;

            const unitsPerMeasure = measure.unitsPerMeasure || 4;

            // Measure-level arpeggio qualifier (regular rhythm + all
            // pitch classes form exactly one chord). This is a superset
            // of the clean-cycle motif logic — it also catches irregular
            // patterns like Departure's do-mib-sol-mib… that have no
            // homogeneous cycle. Activation (badge) is decided AFTER all
            // measures exist, by the consecutive-measures pass below.
            const arpeggioMeasure = qualifyArpeggioMeasure(chordGroups, song.key);

            // Per-hand role qualifiers. Arpège + ostinato need the
            // consecutive-measures run rule (decided below); pédale does
            // not. We pre-compute the candidates per hand here.
            const leftOstinato = qualifyOstinatoMeasure(chordGroups, song.key);
            const rightOstinato = qualifyOstinatoMeasure(melodyGroups, song.key);
            const rightArpeggio = qualifyArpeggioMeasure(melodyGroups, song.key);
            const rightMotifInfo = detectArpeggioMotifs(melodyGroups, song.key);
            const leftPedal = qualifyPedalMeasure(chordGroups, unitsPerMeasure, song.key);
            const rightPedal = qualifyPedalMeasure(melodyGroups, unitsPerMeasure, song.key);

            // Combined harmony across BOTH hands.
            const allPitches = [...measure.melody, ...measure.chords]
                .map(n => toMidi(n.pitch))
                .filter(p => p !== null);
            const harmony = getMeasureHarmony(allPitches, song.key);

            measures.push({
                number: measures.length + 1,
                phraseIndex,
                chordGroups,
            leftSegments: segmentRepeatedMotifs(chordGroups),
            rightSegments: segmentRepeatedMotifs(melodyGroups),
                melodyGroups,
                melodyCount: measure.melody.length,
                hasChord: chordGroups.length > 0,
                melody: measure.melody,
                sortedMelody: [...measure.melody].sort((a, b) => a.startTime - b.startTime),
                chords: measure.chords,
                beatsPerMeasure: measure.beatsPerMeasure || beatsPerMeasure,
                unitsPerMeasure,
                measureStartUnits: measure.measureStartUnits,
                isArpeggio,
                detectedChord,
                motifInfo,
                arpeggioMeasure,
                harmony,
                // Per-hand role candidates (run-rule applied in the pass below).
                leftOstinato, rightOstinato, rightArpeggio, rightMotifInfo, leftPedal, rightPedal,
                // Filled in by the consecutive-measures pass below.
                arpeggioBadge: null,
                leftRole: null,
                rightRole: null,
            });
        });
    });

    // ── Consecutive-measures arpeggio trigger ──────────────────────────
    // The arpeggio badge only activates across a RUN of ≥2 consecutive
    // qualifying measures. Chords may differ between measures (m1 = do m,
    // m2 = fa m/do still counts); each measure then shows its OWN badge.
    let runStart = 0;
    while (runStart < measures.length) {
        if (!measures[runStart].arpeggioMeasure) { runStart++; continue; }
        let runEnd = runStart;
        while (runEnd + 1 < measures.length
            && measures[runEnd + 1].phraseIndex === measures[runEnd].phraseIndex
            && measures[runEnd + 1].arpeggioMeasure) {
            runEnd++;
        }
        if (runEnd - runStart + 1 >= 2) {
            for (let i = runStart; i <= runEnd; i++) {
                const m = measures[i];
                const aq = m.arpeggioMeasure;
                // Append ×N only when the existing clean-cycle motif logic
                // found a homogeneous repeating cycle (repetitions > 1).
                // The irregular fallback path shows no ×N.
                // ×N only when the EXACT ordered note sequence repeats N
                // times (motifInfo.exactCycle): the motif must literally
                // repeat. The "distinct chords per cycle" branch also
                // reports repetitions>1 but those are NOT motif repeats.
                const reps = (m.motifInfo && m.motifInfo.exactCycle
                    && m.motifInfo.repetitions > 1
                    && m.motifInfo.notesPerCycle * m.motifInfo.repetitions === aq.noteCount)
                    ? m.motifInfo.repetitions : 1;
                const label = reps > 1 ? `${aq.badge} ×${reps}` : aq.badge;
                m.arpeggioBadge = {
                    label, bareLabel: aq.badge, chord: aq.chord, reps,
                    altered: aq.altered, alteredNoteName: aq.alteredNoteName,
                };
            }
        }
        runStart = runEnd + 1;
    }

    // ── Run-rule helper ────────────────────────────────────────────────
    // Marks `flagKey=true` on every measure that belongs to a run of ≥2
    // consecutive measures where `pick(m)` is truthy AND (optionally) the
    // `sameSig(a,b)` predicate holds between neighbours.
    const applyRunRule = (pick, flagKey, sameSig) => {
        let s = 0;
        while (s < measures.length) {
            if (!pick(measures[s])) { s++; continue; }
            let e = s;
            while (e + 1 < measures.length
                && measures[e + 1].phraseIndex === measures[e].phraseIndex
                && pick(measures[e + 1])
                && (!sameSig || sameSig(measures[e], measures[e + 1]))) {
                e++;
            }
            if (e - s + 1 >= 2) {
                for (let i = s; i <= e; i++) measures[i][flagKey] = true;
            }
            s = e + 1;
        }
    };

    // Right-hand arpeggio run rule (left hand already handled above via
    // arpeggioBadge). Ostinato run rules per hand keyed by rhythm signature.
    applyRunRule(m => m.rightArpeggio, 'rightArpeggioActive');
    applyRunRule(
        m => m.leftOstinato, 'leftOstinatoActive',
        (a, b) => a.leftOstinato.runSig === b.leftOstinato.runSig,
    );
    applyRunRule(
        m => m.rightOstinato, 'rightOstinatoActive',
        (a, b) => a.rightOstinato.runSig === b.rightOstinato.runSig,
    );

    // ── Per-hand role resolution ───────────────────────────────────────
    // Priority: arpège → ostinato → pédale → (accords plaqués / fallback
    // resolved at render time). Pédale has no run requirement.
    //
    // Exception: a CLEAN (non-altered) arpège outranks an ostinato, but an
    // ALTERED/incomplete arpège (a weak guess on a 3-note set, e.g.
    // {Fa,Sib,La}) does NOT — a tight repeating motif is the better lesson,
    // so the ostinato wins. A genuine chord arpeggio (Departure's clean
    // Do min) keeps priority.
    for (const m of measures) {
        // LEFT hand
        const leftArpClean = m.arpeggioBadge && !m.arpeggioBadge.altered;
        if (m.arpeggioBadge && (leftArpClean || !m.leftOstinatoActive)) {
            m.leftRole = { kind: 'arpeggio', badge: m.arpeggioBadge };
        } else if (m.leftOstinatoActive) {
            m.leftRole = { kind: 'ostinato', ostinato: m.leftOstinato };
        } else if (m.leftPedal) {
            m.leftRole = { kind: 'pedal', pedal: m.leftPedal };
        }
        // RIGHT hand
        const rightArp = m.rightArpeggioActive && m.rightArpeggio ? m.rightArpeggio : null;
        const rightArpClean = rightArp && !rightArp.altered;
        if (rightArp && (rightArpClean || !m.rightOstinatoActive)) {
            const reps = m.rightMotifInfo?.exactCycle ? m.rightMotifInfo.repetitions : 1;
            m.rightRole = {
                kind: 'arpeggio',
                badge: {
                    label: reps > 1 ? `${rightArp.badge} ×${reps}` : rightArp.badge, bareLabel: rightArp.badge,
                    chord: rightArp.chord, reps,
                    altered: rightArp.altered, alteredNoteName: rightArp.alteredNoteName,
                },
            };
        } else if (m.rightOstinatoActive) {
            m.rightRole = { kind: 'ostinato', ostinato: m.rightOstinato };
        } else if (m.rightPedal) {
            m.rightRole = { kind: 'pedal', pedal: m.rightPedal };
        }
    }

    return {
        measures,
        phraseBreaks,
        totalMeasures: measures.length,
        key: song.key,
        tempo: song.tempo,
        uniqueNotes: Array.from(allNotes).sort()
    };
}
