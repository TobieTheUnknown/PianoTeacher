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
    'B': 'Si'
};

export const KEY_MODE_NAMES = {
    'major': 'Majeur',
    'minor': 'mineur'
};

// Convert key object to French notation
export const getFrenchKeyName = (key) => {
    if (typeof key === 'string') {
        // Legacy format: just note name
        return NOTE_NAMES[key] || key;
    }
    if (key && key.note && key.mode) {
        const noteName = NOTE_NAMES[key.note] || key.note;
        const modeName = KEY_MODE_NAMES[key.mode] || key.mode;
        return `${noteName} ${modeName}`;
    }
    return 'Do Majeur'; // Default
};

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const OCTAVES = [2, 3, 4, 5];

export const getFrenchNoteName = (pitch) => {
    if (!pitch) return '';
    // pitch is like "C4" or "F#3"
    const note = pitch.slice(0, -1);
    const octave = pitch.slice(-1);
    return `${NOTE_NAMES[note] || note}${octave}`;
};

// Helper to generate a scale or chromatic list for the Piano Roll Y-axis
export const getPianoRollKeys = (startOctave = 3, endOctave = 5) => {
    const keys = [];
    for (let oct = endOctave; oct >= startOctave; oct--) {
        for (let i = NOTES.length - 1; i >= 0; i--) {
            keys.push(`${NOTES[i]}${oct}`);
        }
    }
    return keys;
};
