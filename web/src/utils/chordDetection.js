import { getEnharmonicNote, NOTE_NAMES } from '../models/song';

// English note name → pitch class (used by getChordDegree)
const EN_NOTE_TO_PC = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

const MAJOR_SCALE = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 };
const MINOR_SCALE = { 0: 1, 2: 2, 3: 3, 5: 4, 7: 5, 8: 6, 10: 7 };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Compute the harmonic degree (Roman numeral) of a chord in a given key.
 *
 * @param {{ rootPitchClass: number, quality: string }} chord
 * @param {{ note: string, mode: 'major'|'minor' }} keySignature
 * @returns {string|null}  e.g. "i", "iv", "ii7", "VI", "V7", "♭VII"
 */
export function getChordDegree(chord, keySignature) {
    if (!chord || !keySignature) return null;
    const tonicPc = EN_NOTE_TO_PC[keySignature.note];
    if (tonicPc === undefined || chord.rootPitchClass === undefined) return null;

    const interval = ((chord.rootPitchClass - tonicPc) + 12) % 12;
    const scale = keySignature.mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;

    const quality = chord.quality || '';
    const isLower = quality.startsWith('min') || quality.startsWith('dim');
    const dimSuffix = quality.startsWith('dim') ? '°' : '';
    const augSuffix = quality.startsWith('aug') ? '+' : '';
    const sevenSuffix = quality.includes('7') ? '7' : '';
    const suffix = dimSuffix + augSuffix + sevenSuffix;

    const toRoman = (deg) => {
        const base = ROMAN[deg];
        return isLower ? base.toLowerCase() : base;
    };

    if (scale[interval] !== undefined) {
        return toRoman(scale[interval]) + suffix;
    }

    // Chromatic: try ♭(interval+1) then ♯(interval-1)
    const flatTarget = (interval + 1) % 12;
    if (scale[flatTarget] !== undefined) {
        return '♭' + toRoman(scale[flatTarget]) + suffix;
    }
    const sharpTarget = (interval - 1 + 12) % 12;
    if (scale[sharpTarget] !== undefined) {
        return '♯' + toRoman(scale[sharpTarget]) + suffix;
    }

    return null;
}

// Chord templates: intervals from root
// 4-note chords first (more specific = higher priority)
const CHORD_TEMPLATES = [
    { intervals: [0, 4, 5, 11], quality: 'Maj7add11' },
    { intervals: [0, 4, 7, 11], quality: 'Maj7' },
    { intervals: [0, 4, 7, 10], quality: '7' },
    { intervals: [0, 3, 7, 10], quality: 'min7' },
    { intervals: [0, 3, 6, 10], quality: 'min7b5' },
    { intervals: [0, 3, 6, 9],  quality: 'dim7' },
    { intervals: [0, 5, 7, 10], quality: '7sus4' },
    { intervals: [0, 5, 7, 11], quality: 'Maj7sus4' },
    { intervals: [0, 4, 7, 9],  quality: '6' },
    { intervals: [0, 3, 7, 9],  quality: 'min6' },
    { intervals: [0, 2, 4, 7],  quality: 'add9' },
    { intervals: [0, 2, 3, 7],  quality: 'minadd9' },
    // Triads
    { intervals: [0, 4, 7],     quality: 'Maj' },
    { intervals: [0, 3, 7],     quality: 'min' },
    { intervals: [0, 3, 6],     quality: 'dim' },
    { intervals: [0, 4, 8],     quality: 'aug' },
    { intervals: [0, 2, 7],     quality: 'sus2' },
    { intervals: [0, 5, 7],     quality: 'sus4' },
];

/**
 * Identify a chord from an array of MIDI pitches.
 * @param {number[]} midiPitches - Array of MIDI note numbers
 * @param {object} keySignature - Key signature { note, mode }
 * @returns {{ rootName: string, quality: string, displayName: string } | null}
 */
export function identifyChord(midiPitches, keySignature) {
    if (!midiPitches || midiPitches.length === 0) return null;

    // Extract unique pitch classes
    const pitchClasses = [...new Set(midiPitches.map(p => p % 12))];

    if (pitchClasses.length < 3) return null;

    // Find the lowest pitch to prefer as root
    const lowestPitch = Math.min(...midiPitches);
    const lowestPitchClass = lowestPitch % 12;

    let bestMatch = null;

    // Try each pitch class as potential root, but prefer the lowest note
    const orderedRoots = [lowestPitchClass, ...pitchClasses.filter(pc => pc !== lowestPitchClass)];

    for (const root of orderedRoots) {
        const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b);

        for (const template of CHORD_TEMPLATES) {
            if (intervalsMatch(intervals, template.intervals)) {
                const rootName = getRootName(root, keySignature);
                const quality = template.quality;
                const displayName = formatChordDisplayName(rootName, quality);
                return { rootName, quality, displayName, rootPitchClass: root };
            }
        }

        // If lowest note already matched, we'd have returned above.
        // Only continue to other roots if lowest didn't match.
        if (root === lowestPitchClass && bestMatch) break;
    }

    return bestMatch;
}

/**
 * Check if a set of intervals matches a template.
 * The intervals set may have extra notes (e.g. doubled octaves).
 */
function intervalsMatch(intervals, template) {
    // Every template interval must be present in the actual intervals
    return template.every(t => intervals.includes(t));
}

/**
 * Get the French root name from a pitch class (0-11).
 */
function getRootName(pitchClass, keySignature) {
    // Map pitch class to a note name using sharps by default
    const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rawName = sharpNames[pitchClass];

    // Apply enharmonic correction based on key signature
    const correctedName = keySignature ? getEnharmonicNote(rawName, keySignature) : rawName;

    return NOTE_NAMES[correctedName] || correctedName;
}

/**
 * Wrapper: extract MIDI pitches from chord groups and identify the chord.
 * @param {Array<{notes: Array<{pitch: number|string}>}>} chordGroups
 * @param {object} keySignature
 * @returns {{ rootName: string, quality: string, displayName: string } | null}
 */
export function arpeggioToChord(chordGroups, keySignature) {
    if (!chordGroups || chordGroups.length === 0) return null;

    const midiPitches = [];
    for (const group of chordGroups) {
        for (const note of group.notes) {
            const pitch = typeof note.pitch === 'number'
                ? note.pitch
                : getMidiFromName(note.pitch);
            if (pitch !== null) midiPitches.push(pitch);
        }
    }

    return identifyChord(midiPitches, keySignature);
}

/** Capitalize the first letter only: "mib"/"MIB" → "Mib". */
function capitalizeNote(name) {
    if (!name) return name;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Format chord display name with the major/minor casing convention:
 * every note starts with a capital — minor → Capitalized root ("Do"),
 * Major → UPPERCASE root ("DO"). The casing alone carries the quality,
 * so plain triads need no suffix. Extensions keep their digits:
 * min7 → "Do 7", Maj7 → "DO Maj7", dominant 7 → "DO 7"…
 */
function formatChordDisplayName(rootName, quality) {
    const isMinor = quality.startsWith('min');
    const root = isMinor ? capitalizeNote(rootName) : rootName.toUpperCase();

    if (quality === 'Maj' || quality === 'min') return root;

    const suffix = isMinor ? quality.slice(3) : quality;
    return suffix ? `${root} ${suffix}` : root;
}

/**
 * Detect repeated arpeggio motifs within a measure's chord groups.
 *
 * Strategy:
 * 1. Try to find a repeating cycle of identical pitch-class sets → single chord × N reps
 * 2. If cycles differ, try to identify a chord per cycle → multiple distinct chords
 * 3. Fallback: identify one chord from all notes together
 */
export function detectArpeggioMotifs(chordGroups, keySignature) {
    if (!chordGroups || chordGroups.length === 0) return null;

    // Extract all MIDI pitches in order
    const midiPitches = [];
    for (const group of chordGroups) {
        for (const note of group.notes) {
            const pitch = typeof note.pitch === 'number'
                ? note.pitch
                : getMidiFromName(note.pitch);
            if (pitch !== null) midiPitches.push(pitch);
        }
    }

    const total = midiPitches.length;
    if (total === 0) return null;

    // Try to identify a single chord from all notes
    const singleChord = identifyChord(midiPitches, keySignature);

    if (total <= 3) {
        return singleChord ? { chord: singleChord, chords: [singleChord], repetitions: 1, notesPerCycle: total } : null;
    }

    // Find the smallest cycle length where the EXACT ordered note sequence
    // repeats (pitch classes, so octave displacement still counts as the
    // same motif). Set-based matching is NOT enough: do-mib-sol-mib +
    // sol-mib-sol-mib share a pitch-class set but are ONE motif, not two —
    // a ×N must mean the motif literally repeats N times.
    const uniqueCount = new Set(midiPitches.map(p => p % 12)).size;
    const pcs = midiPitches.map(p => p % 12);
    let bestHomogeneousCycle = null;

    for (let cycleLen = Math.max(3, uniqueCount); cycleLen <= total / 2; cycleLen++) {
        if (total % cycleLen !== 0) continue;

        let matches = true;
        for (let i = cycleLen; i < total; i++) {
            if (pcs[i] !== pcs[i - cycleLen]) {
                matches = false;
                break;
            }
        }

        if (matches) {
            bestHomogeneousCycle = cycleLen;
            break;
        }
    }

    // If we found a homogeneous repeating cycle, return single chord × N
    // Add slash bass notation per cycle when bass differs from chord root
    if (bestHomogeneousCycle && singleChord) {
        const reps = total / bestHomogeneousCycle;
        const chords = [];
        for (let i = 0; i < reps; i++) {
            const bassPitchClass = midiPitches[i * bestHomogeneousCycle] % 12;
            if (singleChord.rootPitchClass !== undefined && singleChord.rootPitchClass !== bassPitchClass) {
                const bassName = getRootName(bassPitchClass, keySignature);
                chords.push({ ...singleChord, displayName: `${singleChord.displayName}/${bassName}` });
            } else {
                chords.push(singleChord);
            }
        }
        return {
            chord: chords[0],
            chords,
            repetitions: reps,
            notesPerCycle: bestHomogeneousCycle,
            // The ONLY ×N-worthy case: the ordered motif literally repeats.
            exactCycle: true
        };
    }

    // No homogeneous cycle — try to detect distinct chords per group
    // Try cycle sizes (3, 4, etc.) that divide evenly
    for (let cycleLen = 3; cycleLen <= Math.min(6, total / 2); cycleLen++) {
        if (total % cycleLen !== 0) continue;

        const numChords = total / cycleLen;
        let hasDistinctGroups = false;

        // Check if groups actually differ (different first note = different bass)
        for (let i = 1; i < numChords; i++) {
            if (midiPitches[i * cycleLen] % 12 !== midiPitches[0] % 12) {
                hasDistinctGroups = true;
                break;
            }
        }

        if (hasDistinctGroups && numChords > 1) {
            // Identify a chord per cycle, adding slash bass when bass != root
            const chords = [];
            for (let i = 0; i < numChords; i++) {
                const cyclePitches = midiPitches.slice(i * cycleLen, (i + 1) * cycleLen);
                const bassPitchClass = cyclePitches[0] % 12;
                const bassName = getRootName(bassPitchClass, keySignature);

                // Try identifying from this cycle's pitches, or from all pitches
                const chord = identifyChord(cyclePitches, keySignature) || singleChord;

                if (chord) {
                    // Add slash bass if bass note differs from chord root
                    if (chord.rootPitchClass !== undefined && chord.rootPitchClass !== bassPitchClass) {
                        chords.push({
                            ...chord,
                            displayName: `${chord.displayName}/${bassName}`
                        });
                    } else if (chord.rootPitchClass === undefined) {
                        // singleChord fallback — always add bass since groups differ
                        chords.push({
                            ...chord,
                            displayName: `${chord.displayName}/${bassName}`
                        });
                    } else {
                        chords.push(chord);
                    }
                } else {
                    chords.push({ rootName: bassName, quality: '?', displayName: `${bassName}...` });
                }
            }

            return {
                chord: chords[0],
                chords,
                repetitions: numChords,
                notesPerCycle: cycleLen
            };
        }

        // Check for identical sub-chords (homogeneous but missed above)
        const subChords = [];
        for (let i = 0; i < numChords; i++) {
            const cyclePitches = midiPitches.slice(i * cycleLen, (i + 1) * cycleLen);
            const chord = identifyChord(cyclePitches, keySignature);
            if (!chord) break;
            subChords.push(chord);
        }
        if (subChords.length === numChords && subChords.every(c => c.displayName === subChords[0].displayName)) {
            return {
                chord: subChords[0],
                chords: subChords,
                repetitions: numChords,
                notesPerCycle: cycleLen
            };
        }
    }

    // Fallback: single chord from all notes, with slash bass if needed
    if (singleChord) {
        const bassPitchClass = midiPitches[0] % 12;
        let chord = singleChord;
        if (singleChord.rootPitchClass !== undefined && singleChord.rootPitchClass !== bassPitchClass) {
            const bassName = getRootName(bassPitchClass, keySignature);
            chord = { ...singleChord, displayName: `${singleChord.displayName}/${bassName}` };
        }
        return { chord, chords: [chord], repetitions: 1, notesPerCycle: total };
    }

    return null;
}

/**
 * Build the arpeggio-badge label for a measure.
 *
 * Casing encodes quality: MAJOR → uppercase root ("DO", "FA"),
 * minor → lowercase root ("do m", "fa m"). We reuse the French quality
 * suffixes from `formatChordDisplayName` but force the ROOT casing so the
 * arpeggio badge reads differently from the simultaneous-chord badge.
 *
 * Slash bass is appended when the measure's bass pitch class differs from
 * the chord root ("fa m/do"). An optional ×N is appended by the caller.
 *
 * @param {{rootName:string, quality:string, rootPitchClass?:number}} chord
 * @param {number} bassPitchClass - pitch class (0-11) of the measure's bass note
 * @param {object} keySignature
 * @returns {string}
 */
export function formatArpeggioBadge(chord, bassPitchClass, keySignature) {
    if (!chord) return '';
    // Every note starts with a capital; the CASING carries the quality:
    // "Do" = Do mineur, "DO" = DO majeur. No "m" suffix needed.
    let label = formatChordDisplayName(chord.rootName, chord.quality);

    // Slash bass when bass note differs from the chord root.
    if (chord.rootPitchClass !== undefined &&
        bassPitchClass !== undefined &&
        chord.rootPitchClass !== bassPitchClass) {
        const bassName = capitalizeNote(getRootName(bassPitchClass, keySignature));
        label += `/${bassName}`;
    }
    return label;
}

/**
 * Identify a chord from a set of MIDI pitches with the two tolerances used
 * across the measure analysis (arpeggio + combined-harmony badges):
 *   · the exact `identifyChord` match (lax — extra octave doublings allowed);
 *     then re-check the matched template against ALL pitch classes and tolerate
 *     at most ONE foreign pitch class (a passing tone / small alteration).
 *   · if no direct match, an INCOMPLETE 4-note chord: exactly 3 of a 4-tone
 *     template's pitch classes, no foreign tone (e.g. {Fa,Sib,La} = Sib Maj7
 *     without the Ré). Roots are tried bass-first so the most grounded
 *     reading wins.
 *
 * @param {number[]} pitches  MIDI note numbers (order matters only for bass).
 * @param {object} keySignature  { note, mode }
 * @returns {{ chord: {rootName,quality,displayName,rootPitchClass}, altered: boolean, alteredNoteName: string|null } | null}
 */
export function identifyChordWithTolerance(pitches, keySignature) {
    if (!pitches || pitches.length === 0) return null;
    const pitchClasses = [...new Set(pitches.map(p => p % 12))];
    if (pitchClasses.length < 3) return null;

    // EXACT pre-pass: prefer the reading whose template pitch classes EXACTLY
    // equal the measure's set (no foreign, no missing tone). `identifyChord`
    // is lax — it accepts a triad that is a strict subset of a richer set
    // (e.g. {Ré,Fa,La,Sib} → Ré min because [0,3,7] ⊂ {0,3,7,8}), which hides
    // the true Sib Maj7. CHORD_TEMPLATES is ordered most-specific first, so
    // the first exact full match is the richest one. Roots are tried
    // bass-first so a grounded reading wins ties.
    const pcSet = new Set(pitchClasses);
    const exactRoots = [pitches[0] % 12, ...pitchClasses.filter(pc => pc !== pitches[0] % 12)];
    for (const template of CHORD_TEMPLATES) {
        if (template.intervals.length !== pcSet.size) continue;
        for (const root of exactRoots) {
            const templatePcs = new Set(template.intervals.map(iv => (root + iv) % 12));
            if (templatePcs.size === pcSet.size
                && [...pcSet].every(pc => templatePcs.has(pc))) {
                const rootName = getRootName(root, keySignature);
                return {
                    chord: {
                        rootName,
                        quality: template.quality,
                        displayName: formatChordDisplayName(rootName, template.quality),
                        rootPitchClass: root,
                    },
                    altered: false,
                    alteredNoteName: null,
                };
            }
        }
    }

    let chord = identifyChord(pitches, keySignature);
    let altered = false;
    let alteredNoteName = null;

    if (chord && chord.rootPitchClass !== undefined) {
        // identifyChord tolerates extra notes, so re-check the identified
        // chord's interval template against ALL pitch classes and count the
        // foreign ones.
        const template = CHORD_TEMPLATES.find(t => t.quality === chord.quality);
        if (!template) return null;
        const allowed = new Set(template.intervals);
        const foreignPcs = pitchClasses.filter(
            pc => !allowed.has((pc - chord.rootPitchClass + 12) % 12)
        );
        if (foreignPcs.length > 1) return null; // too many foreign notes
        // The chord itself must still be fully present (≥3 chord tones).
        if (pitchClasses.length - foreignPcs.length < 3) return null;

        // The foreign tone must stay a passing event, not a structural
        // voice: cap its occurrences at 1 (or more in longer measures).
        if (foreignPcs.length === 1) {
            const foreignPc = foreignPcs[0];
            const foreignInstances = pitches.filter(p => p % 12 === foreignPc).length;
            if (foreignInstances > Math.max(1, Math.floor(pitches.length / 4))) return null;
            altered = true;
            alteredNoteName = getRootName(foreignPc, keySignature);
        }
        return { chord, altered, alteredNoteName };
    }

    // No direct match: try an INCOMPLETE 4-note chord — exactly 3 of a
    // 4-tone template's pitch classes, no foreign tone. Roots are tried
    // bass-first so the most grounded reading wins.
    const rootsToTry = [pitches[0] % 12, ...pitchClasses.filter(pc => pc !== pitches[0] % 12)];
    for (const root of rootsToTry) {
        for (const template of CHORD_TEMPLATES) {
            if (template.intervals.length !== 4) continue;
            const allowed = new Set(template.intervals);
            const intervals = pitchClasses.map(pc => (pc - root + 12) % 12);
            if (pitchClasses.length === 3 && intervals.every(iv => allowed.has(iv))) {
                const rootName = getRootName(root, keySignature);
                return {
                    chord: {
                        rootName,
                        quality: template.quality,
                        displayName: formatChordDisplayName(rootName, template.quality),
                        rootPitchClass: root,
                    },
                    altered: true, // incomplete chord → flagged
                    alteredNoteName: null,
                };
            }
        }
    }
    return null;
}

/**
 * French note label for a pitch class, capitalized like a single note name
 * ("Fa", "Sib", "La") regardless of chord quality. Used for ostinato/pédale
 * motif labels.
 * @param {number} pc  pitch class 0-11
 * @param {object} keySignature
 * @returns {string}
 */
export function noteLabelForPitchClass(pc, keySignature) {
    return capitalizeNote(getRootName(pc, keySignature));
}

/**
 * Combined-harmony badge for a measure: identify the chord from ALL pitch
 * classes of BOTH hands together, using identifyChordWithTolerance. The bass
 * is the LOWEST sounding pitch of the whole measure (slash when ≠ chord root).
 *
 * @param {number[]} allPitches  MIDI pitches of both hands in this measure.
 * @param {object} keySignature  { note, mode }
 * @returns {{ chord, altered, label, degree, bassPitchClass } | null}
 */
export function getMeasureHarmony(allPitches, keySignature) {
    if (!allPitches || allPitches.length === 0) return null;
    const identified = identifyChordWithTolerance(allPitches, keySignature);
    if (!identified) return null;
    const { chord, altered } = identified;

    const bassPitchClass = Math.min(...allPitches) % 12;
    // formatArpeggioBadge already applies the casing convention + slash bass.
    const label = formatArpeggioBadge(chord, bassPitchClass, keySignature);
    const degree = getChordDegree(chord, keySignature);
    return { chord, altered, label, degree, bassPitchClass };
}

/**
 * Measure-level OSTINATO qualifier.
 *
 * A measure is an ostinato when it is a single-line, regular-rhythm pattern
 * whose ORDERED pitch-class sequence is a motif of length 2..4 repeated ≥2
 * full times (the LAST repetition may be a strict prefix of the motif).
 * Among all valid motif lengths the SHORTEST wins.
 *
 * @param {Array<{startTime:number, notes:Array<{pitch:number|string, startTime?:number, duration?:number}>}>} chordGroups
 * @param {object} keySignature
 * @returns {{ motifPcs:number[], motifLabels:string[], repetitions:number, rhythmSig:string } | null}
 */
export function qualifyOstinatoMeasure(chordGroups, keySignature) {
    if (!chordGroups || chordGroups.length < 4) return null;
    if (!chordGroups.every(g => g.notes.length === 1)) return null;

    const groups = [...chordGroups].sort((a, b) => a.startTime - b.startTime);
    const pitches = [];
    const starts = [];
    for (const g of groups) {
        const note = g.notes[0];
        const pitch = typeof note.pitch === 'number' ? note.pitch : getMidiFromName(note.pitch);
        if (pitch === null) return null;
        pitches.push(pitch);
        starts.push(note.startTime ?? g.startTime);
    }
    const total = pitches.length;
    if (total < 4) return null;

    // Regular rhythm: evenly-spaced onsets (same check as arpeggios).
    const EPS = 0.06;
    const firstGap = starts[1] - starts[0];
    if (firstGap <= 0) return null;
    for (let i = 1; i < starts.length; i++) {
        if (Math.abs((starts[i] - starts[i - 1]) - firstGap) > EPS) return null;
    }

    const pcs = pitches.map(p => p % 12);

    // Need at least 2 distinct pitch classes — a single repeated pitch is a
    // pédale, not an ostinato.
    if (new Set(pcs).size < 2) return null;

    // Shortest motif length 2..4 that tiles the sequence with ≥2 full reps,
    // last rep allowed to be a strict prefix.
    for (let len = 2; len <= 4; len++) {
        if (len >= total) break;
        const fullReps = Math.floor(total / len);
        if (fullReps < 2) continue;
        const motif = pcs.slice(0, len);
        // The motif itself must not be a single repeated pitch.
        if (new Set(motif).size < 2) continue;
        let ok = true;
        for (let i = len; i < total; i++) {
            if (pcs[i] !== motif[i % len]) { ok = false; break; }
        }
        if (!ok) continue;
        return {
            motifPcs: motif,
            motifLabels: motif.map(pc => noteLabelForPitchClass(pc, keySignature)),
            repetitions: fullReps,
            // Rhythm signature for the consecutive-run rule: note count + gap.
            rhythmSig: `${total}@${firstGap.toFixed(2)}`,
        };
    }
    return null;
}

/**
 * Measure-level PÉDALE qualifier.
 *
 * The hand has ≤2 distinct pitch classes AND its notes are either HELD
 * (duration ≥ half the measure) or simply repeated on the same pitch(es).
 * Returns the held/repeated note label, plus an "8va" flag when two
 * simultaneous pitches sit exactly an octave apart.
 *
 * @param {Array<{startTime:number, notes:Array}>} chordGroups
 * @param {number} unitsPerMeasure  duration units that span one full measure (default 4)
 * @param {object} keySignature
 * @returns {{ label:string, octave:boolean } | null}
 */
export function qualifyPedalMeasure(chordGroups, unitsPerMeasure, keySignature) {
    if (!chordGroups || chordGroups.length === 0) return null;

    const span = unitsPerMeasure || 4;
    const allPitches = [];
    let maxDuration = 0;
    let octave = false;
    for (const g of chordGroups) {
        const groupPitches = [];
        for (const note of g.notes) {
            const pitch = typeof note.pitch === 'number' ? note.pitch : getMidiFromName(note.pitch);
            if (pitch === null) return null;
            allPitches.push(pitch);
            groupPitches.push(pitch);
            if (note.duration !== undefined) maxDuration = Math.max(maxDuration, note.duration);
        }
        // Two simultaneous pitches an octave apart → 8va pédale.
        if (groupPitches.length >= 2) {
            for (let i = 0; i < groupPitches.length; i++) {
                for (let j = i + 1; j < groupPitches.length; j++) {
                    if (Math.abs(groupPitches[i] - groupPitches[j]) === 12) octave = true;
                }
            }
        }
    }

    const pcs = [...new Set(allPitches.map(p => p % 12))];
    if (pcs.length > 2) return null;

    // Held (long duration) OR simply repeated on the same pitch(es).
    const held = maxDuration >= span / 2;
    const repeated = chordGroups.length >= 2;
    if (!held && !repeated) return null;

    // Label = the lowest sounding pitch class (the pedal tone).
    const bassPc = Math.min(...allPitches) % 12;
    return {
        label: noteLabelForPitchClass(bassPc, keySignature),
        octave,
    };
}

/**
 * Measure-level arpeggio qualifier (spec — Departure fix).
 *
 * A measure qualifies as an "arpeggio measure" when BOTH hold:
 *   (a) it has ≥4 notes played one-at-a-time with a REGULAR rhythm
 *       (same duration, evenly spaced — e.g. all eighths), AND
 *   (b) the set of pitch classes of ALL its notes is EXACTLY the notes of
 *       one identifiable chord (3–4 distinct pitch classes via identifyChord).
 *       STRICT: a single foreign/passing note disqualifies the measure.
 *
 * This is a SUPERSET of the clean-cycle motif logic: patterns like
 * do-mib-sol-mib-sol-mib-sol-mib (8 eighths, all C minor) have no
 * homogeneous cycle dividing 8, yet still form exactly one C-minor chord
 * with a regular rhythm — so they qualify here even though
 * `detectArpeggioMotifs` finds no clean ×N cycle.
 *
 * @param {Array<{startTime:number, notes:Array<{pitch:number|string, startTime?:number, duration?:number}>}>} chordGroups
 * @param {object} keySignature
 * @returns {{ chord, badge, bassPitchClass, noteCount } | null}
 */
export function qualifyArpeggioMeasure(chordGroups, keySignature) {
    if (!chordGroups || chordGroups.length < 4) return null;

    // One note per group (a true single-line arpeggio, not block chords).
    if (!chordGroups.every(g => g.notes.length === 1)) return null;

    // Collect notes in time order.
    const groups = [...chordGroups].sort((a, b) => a.startTime - b.startTime);
    const pitches = [];
    const starts = [];
    const durations = [];
    for (const g of groups) {
        const note = g.notes[0];
        const pitch = typeof note.pitch === 'number' ? note.pitch : getMidiFromName(note.pitch);
        if (pitch === null) return null;
        pitches.push(pitch);
        starts.push(note.startTime ?? g.startTime);
        if (note.duration !== undefined) durations.push(note.duration);
    }

    if (pitches.length < 4) return null;

    // (a) Regular rhythm: evenly-spaced onsets and uniform duration.
    const EPS = 0.06; // ~quantization slack in our 4-units-per-measure grid
    const firstGap = starts[1] - starts[0];
    if (firstGap <= 0) return null;
    for (let i = 1; i < starts.length; i++) {
        if (Math.abs((starts[i] - starts[i - 1]) - firstGap) > EPS) return null;
    }
    if (durations.length === starts.length) {
        const d0 = durations[0];
        if (durations.some(d => Math.abs(d - d0) > EPS)) return null;
    }

    // Anti-melody guard: an arpeggio moves by LEAPS (≥3 semitones); a
    // melodic/scale line is mostly stepwise. Without this, a regular-rhythm
    // melody whose notes happen to fit "chord + 1 foreign tone" would get a
    // badge invented for it. Require ≥60% leaps between consecutive notes.
    let leaps = 0;
    for (let i = 1; i < pitches.length; i++) {
        if (Math.abs(pitches[i] - pitches[i - 1]) >= 3) leaps++;
    }
    if (leaps / (pitches.length - 1) < 0.6) return null;

    // (b) The pitch classes must form one identifiable chord, with two
    // tolerated deviations (see identifyChordWithTolerance):
    //   · ONE extra foreign pitch class (a passing tone / small alteration)
    //   · ONE missing tone from a 4-note chord (e.g. do-ré-fa = ré m7
    //     without the la). Anything looser → detailed display.
    const pitchClasses = [...new Set(pitches.map(p => p % 12))];
    if (pitchClasses.length < 3 || pitchClasses.length > 5) return null;

    const identified = identifyChordWithTolerance(pitches, keySignature);
    if (!identified) return null;
    const { chord, altered, alteredNoteName } = identified;

    const bassPitchClass = pitches[0] % 12;
    return {
        chord,
        bassPitchClass,
        noteCount: pitches.length,
        altered,
        alteredNoteName,
        badge: formatArpeggioBadge(chord, bassPitchClass, keySignature),
    };
}

/**
 * Simple note name to MIDI conversion for string pitches.
 */
function getMidiFromName(name) {
    if (!name) return null;
    const noteToOffset = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    let note, octave;
    if (name.length >= 2 && isNaN(name[1])) {
        note = name.slice(0, 2);
        octave = parseInt(name.slice(2));
    } else {
        note = name[0];
        octave = parseInt(name.slice(1));
    }
    if (noteToOffset[note] !== undefined && !isNaN(octave)) {
        return 12 + (octave * 12) + noteToOffset[note];
    }
    return null;
}
