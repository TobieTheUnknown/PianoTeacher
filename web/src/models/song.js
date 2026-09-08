// Factory functions for our data models

// Helper for ID generation (robust fallback)
const generateId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {
        console.warn("crypto.randomUUID failed, using fallback", e);
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const createSong = (title = 'Nouveau Morceau') => ({
    id: generateId(),
    title,
    artist: '',
    key: { note: 'C', mode: 'major' }, // Key signature with note and mode
    tempo: 120,
    timeSignature: { numerator: 4, denominator: 4 }, // Time signature (e.g., 4/4, 3/4, 6/8)
    phrases: [],
    highlightedMeasures: [], // Array of measure numbers that are highlighted
    createdAt: new Date().toISOString(),
});

export const createPhrase = (name = 'Phrase A', length = 4) => ({
    id: generateId(),
    name,
    length, // in measures
    tracks: {
        melody: [], // Right hand: Array of NoteEvents
        chords: [], // Left hand: Array of NoteEvents
    },
    handSeparators: [] // Array of { fromMeasure: number, pitch: string } for manual MG/MD separation
});

export const createNoteEvent = (pitch, startTime, duration) => ({
    id: generateId(),
    pitch, // e.g., 'C4', 'G3'
    startTime, // in beats (float)
    duration, // in beats (float)
});

// Helpers & Constants

// French Notation Mapping
export const NOTE_NAMES = {
    'C': 'Do',
    'C#': 'Do#',
    'Db': 'Réb',
    'D': 'Ré',
    'D#': 'Ré#',
    'Eb': 'Mib',
    'E': 'Mi',
    'F': 'Fa',
    'F#': 'Fa#',
    'Gb': 'Solb',
    'G': 'Sol',
    'G#': 'Sol#',
    'Ab': 'Lab',
    'A': 'La',
    'A#': 'La#',
    'Bb': 'Sib',
    'B': 'Si',
    'Cb': 'Dob', 'Fb': 'Fab', 'E#': 'Mi#', 'B#': 'Si#'
};

export const KEY_MODE_NAMES = {
    'major': 'Majeur',
    'minor': 'mineur'
};

const DEFAULT_KEY_SIGNATURE = Object.freeze({ note: 'C', mode: 'major' });

/**
 * Normalize every supported key-signature representation to the persisted
 * object shape used by both the web and native Android models.
 *
 * Legacy songs may contain a compact string ("Bb", "Bbm", "F#m"). Keeping
 * that representation alive beyond the storage boundary is dangerous: newer
 * harmony and engraving helpers expect `{ note, mode }` and may otherwise
 * silently lose the mode or even throw when inspecting object fields.
 *
 * @param {unknown} keySignature
 * @param {{note:string,mode:'major'|'minor'}|null} fallback
 * @returns {{note:string,mode:'major'|'minor'}|null}
 */
export const normalizeKeySignature = (keySignature, fallback = DEFAULT_KEY_SIGNATURE) => {
    let rawNote = null;
    let rawMode = null;

    if (typeof keySignature === 'string') {
        const compact = keySignature.trim();
        const match = compact.match(/^([A-Ga-g])([#b]?)(m)?$/);
        if (match) {
            rawNote = `${match[1].toUpperCase()}${match[2] || ''}`;
            rawMode = match[3] ? 'minor' : 'major';
        }
    } else if (keySignature && typeof keySignature === 'object') {
        rawNote = keySignature.note;
        rawMode = keySignature.mode;

        // Be forgiving with an object produced by an old adapter such as
        // `{ note: "Bbm" }`, while still returning the canonical shape.
        if (typeof rawNote === 'string') {
            const compactNote = rawNote.trim().match(/^([A-Ga-g])([#b]?)(m)?$/);
            if (compactNote) {
                rawNote = `${compactNote[1].toUpperCase()}${compactNote[2] || ''}`;
                if (!rawMode && compactNote[3]) rawMode = 'minor';
            }
        }
    }

    const validNote = typeof rawNote === 'string' && /^[A-G](?:#|b)?$/.test(rawNote);
    if (!validNote) {
        return fallback ? { note: fallback.note, mode: fallback.mode } : null;
    }

    return {
        note: rawNote,
        mode: rawMode === 'minor' ? 'minor' : 'major',
    };
};

// Convert key object to French notation
export const getFrenchKeyName = (key) => {
    const normalized = normalizeKeySignature(key);
    if (normalized) {
        const noteName = NOTE_NAMES[normalized.note] || normalized.note;
        const modeName = KEY_MODE_NAMES[normalized.mode] || normalized.mode;
        return `${noteName} ${modeName}`;
    }
    return 'Do Majeur'; // Default
};

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const OCTAVES = [2, 3, 4, 5];

// Get the correct enharmonic spelling for a note based on key signature
export const getEnharmonicNote = (note, keySignature) => {
    const normalizedKey = normalizeKeySignature(keySignature, null);
    if (!normalizedKey) return note;

    const { note: tonic, mode } = normalizedKey;

    // Define the scale notes for each key (with proper sharps/flats)
    const keySignatures = {
        // Major keys
        'C-major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        'G-major': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
        'D-major': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
        'A-major': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
        'E-major': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
        'B-major': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
        'F#-major': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
        'C#-major': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
        'F-major': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
        'Bb-major': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
        'Eb-major': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
        'Ab-major': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
        'Db-major': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
        'Gb-major': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
        'Cb-major': ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],

        // Minor keys (natural minor)
        'A-minor': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        'E-minor': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
        'B-minor': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
        'F#-minor': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
        'C#-minor': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
        'G#-minor': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
        'D#-minor': ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#'],
        'A#-minor': ['A#', 'B#', 'C#', 'D#', 'E#', 'F#', 'G#'],
        'D-minor': ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],
        'G-minor': ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],
        'C-minor': ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
        'F-minor': ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'],
        'Bb-minor': ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab'],
        'Eb-minor': ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db'],
        'Ab-minor': ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb']
    };

    const keyName = `${tonic}-${mode}`;
    const scaleNotes = keySignatures[keyName];

    if (!scaleNotes) {
        // Fallback to simple sharp/flat rule
        const flatKeys = {
            major: ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
            minor: ['D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab']
        };
        const usesFlats = flatKeys[mode]?.includes(tonic);

        const enharmonicMap = {
            'C#': usesFlats ? 'Db' : 'C#',
            'Db': usesFlats ? 'Db' : 'C#',
            'D#': usesFlats ? 'Eb' : 'D#',
            'Eb': usesFlats ? 'Eb' : 'D#',
            'F#': usesFlats ? 'Gb' : 'F#',
            'Gb': usesFlats ? 'Gb' : 'F#',
            'G#': usesFlats ? 'Ab' : 'G#',
            'Ab': usesFlats ? 'Ab' : 'G#',
            'A#': usesFlats ? 'Bb' : 'A#',
            'Bb': usesFlats ? 'Bb' : 'A#'
        };

        return enharmonicMap[note] || note;
    }

    // Match by sound, preserving the scale spelling (F becomes E# in F# major).
    const midi = getMidiNumber(`${note}4`);
    const diatonic = scaleNotes.find(n => getMidiNumber(`${n}4`) % 12 === midi % 12);
    if (midi !== null && diatonic) return diatonic;

    // For chromatic notes, determine preferred enharmonic
    // Check if this key uses sharps or flats
    const usesFlats = scaleNotes.some(n => n.includes('b'));

    const enharmonicMap = {
        'C#': usesFlats ? 'Db' : 'C#',
        'Db': usesFlats ? 'Db' : 'C#',
        'D#': usesFlats ? 'Eb' : 'D#',
        'Eb': usesFlats ? 'Eb' : 'D#',
        'F#': usesFlats ? 'Gb' : 'F#',
        'Gb': usesFlats ? 'Gb' : 'F#',
        'G#': usesFlats ? 'Ab' : 'G#',
        'Ab': usesFlats ? 'Ab' : 'G#',
        'A#': usesFlats ? 'Bb' : 'A#',
        'Bb': usesFlats ? 'Bb' : 'A#'
    };

    return enharmonicMap[note] || note;
};

// Helper to convert note name to MIDI number
export const getMidiNumber = (noteName) => {
    if (typeof noteName === 'number') return noteName;
    if (!noteName) return null;

    if (typeof noteName !== 'string') return null;
    const match = noteName.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) return null;
    const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const offset = natural[match[1].toUpperCase()] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
    const midi = (Number(match[3]) + 1) * 12 + offset;
    return Number.isInteger(midi) && midi >= 0 && midi <= 127 ? midi : null;
};

// Helper to convert MIDI number to note name (e.g., 60 -> "C4")
export const getNoteNameFromMidi = (midiNumber) => {
    if (typeof midiNumber !== 'number') return midiNumber;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;

    return `${noteNames[noteIndex]}${octave}`;
};

export const getFrenchNoteName = (pitch, keySignature = null, includeOctave = true) => {
    if (pitch === null || pitch === undefined) return '';

    // Normalize to string format for display logic if it's a number
    let noteName = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;

    // Robustly split note and octave using regex
    // Matches: Note (A-G, optional # or b) + Octave (integer, optional -)
    const match = noteName.match(/^([A-Ga-g][#b]?)(-?[0-9]+)$/);

    let note, octave;
    if (match) {
        note = match[1];
        octave = match[2];
    } else {
        // Fallback for weird formats, though unlikely with getNoteNameFromMidi
        note = noteName;
        octave = '';
    }

    // Get the correct enharmonic spelling
    const correctNote = keySignature ? getEnharmonicNote(note, keySignature) : note;

    if (octave !== '' && correctNote !== note) {
        const midi = getMidiNumber(noteName);
        const spelled = getMidiNumber(`${correctNote}${octave}`);
        if (midi !== null && spelled !== null) octave = Number(octave) + (midi - spelled) / 12;
    }
    return `${NOTE_NAMES[correctNote] || correctNote}${includeOctave ? octave : ''}`;
};

// Helper to generate a scale or chromatic list for the Piano Roll Y-axis
// Now returns MIDI numbers instead of strings
export const getPianoRollKeys = (startOctave = 3, endOctave = 5) => {
    const keys = [];
    // Calculate MIDI numbers for the range
    const startMidi = 12 + (startOctave * 12); // C3 -> 48
    const endMidi = 12 + (endOctave * 12) + 11; // B5 -> 83

    for (let midi = endMidi; midi >= startMidi; midi--) {
        keys.push(midi);
    }
    return keys;
};
