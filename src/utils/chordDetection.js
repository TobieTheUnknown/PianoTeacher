import { getEnharmonicNote, NOTE_NAMES } from '../models/song';

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
                return { rootName, quality, displayName };
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

/**
 * Format chord display name with major/minor casing convention.
 * Minor chords → lowercase root (sol min7), Major chords → UPPERCASE root (SOL Maj7)
 * Plain major triad → just "SOL", plain minor triad → just "sol"
 */
function formatChordDisplayName(rootName, quality) {
    const isMinor = quality.startsWith('min');
    const root = isMinor ? rootName.toLowerCase() : rootName.toUpperCase();

    if (quality === 'Maj') return root;
    if (quality === 'min') return root;

    // Strip leading "min" for minor qualities to avoid "sol min7" → keep suffix only
    const suffix = isMinor ? quality.slice(3) : quality;
    const qualityLabel = isMinor ? (suffix ? `min${suffix}` : 'min') : quality;
    return `${root} ${qualityLabel}`;
}

/**
 * Detect repeated arpeggio motifs within a measure's chord groups.
 * If the arpeggio repeats the same pitch-class pattern N times,
 * returns { chord, repetitions, notesPerCycle }.
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

    const chord = identifyChord(midiPitches, keySignature);
    if (!chord) return null;

    const total = midiPitches.length;
    if (total <= 3) return { chord, repetitions: 1, notesPerCycle: total };

    // Find the smallest cycle length that repeats exactly
    // Try cycle sizes from the number of unique pitch classes up to half the total
    const uniqueCount = new Set(midiPitches.map(p => p % 12)).size;
    let bestCycle = total; // fallback: no repetition

    for (let cycleLen = uniqueCount; cycleLen <= total / 2; cycleLen++) {
        if (total % cycleLen !== 0) continue;

        // Check if this cycle repeats: compare pitch classes
        const pattern = midiPitches.slice(0, cycleLen).map(p => p % 12);
        let matches = true;
        for (let rep = 1; rep < total / cycleLen; rep++) {
            for (let j = 0; j < cycleLen; j++) {
                if (midiPitches[rep * cycleLen + j] % 12 !== pattern[j]) {
                    matches = false;
                    break;
                }
            }
            if (!matches) break;
        }

        if (matches) {
            bestCycle = cycleLen;
            break; // smallest cycle found
        }
    }

    const repetitions = Math.floor(total / bestCycle);

    return {
        chord,
        repetitions: repetitions >= 1 ? repetitions : 1,
        notesPerCycle: bestCycle
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
