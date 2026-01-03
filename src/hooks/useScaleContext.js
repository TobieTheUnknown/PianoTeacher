import { useMemo } from 'react';

/**
 * Hook for getting scale context and highlighting notes
 *
 * Features:
 * - Get scale notes from key signature
 * - Check if a MIDI pitch is in the scale
 * - Provide visual indicators for scale notes
 */

// Map of key signatures to scale degrees (major scale)
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // W-W-H-W-W-W-H

// Map of key signatures to root note (C=0, C#=1, D=2, etc.)
const KEY_TO_ROOT = {
    'C': 0, 'G': 7, 'D': 2, 'A': 9, 'E': 4, 'B': 11, 'F#': 6, 'C#': 1,
    'F': 5, 'Bb': 10, 'Eb': 3, 'Ab': 8, 'Db': 1, 'Gb': 6, 'Cb': 11,
    // Minor keys (natural minor)
    'Am': 9, 'Em': 4, 'Bm': 11, 'F#m': 6, 'C#m': 1, 'G#m': 8, 'D#m': 3,
    'Dm': 2, 'Gm': 7, 'Cm': 0, 'Fm': 5, 'Bbm': 10, 'Ebm': 3, 'Abm': 8
};

export function useScaleContext(keySignature) {
    // Normalize keySignature (handle null/undefined/object/string values)
    const normalizedKey = useMemo(() => {
        if (!keySignature) return 'C';

        // If it's an object like { note: 'C', mode: 'major' }
        if (typeof keySignature === 'object' && keySignature.note) {
            const note = keySignature.note;
            const isMinor = keySignature.mode === 'minor';
            return isMinor ? `${note}m` : note;
        }

        // If it's already a string
        if (typeof keySignature === 'string') {
            return KEY_TO_ROOT[keySignature] !== undefined ? keySignature : 'C';
        }

        // Fallback
        return 'C';
    }, [keySignature]);

    // Get root note from key signature
    const rootNote = useMemo(() => {
        return KEY_TO_ROOT[normalizedKey] ?? 0; // Default to C if unknown
    }, [normalizedKey]);

    // Get scale notes (as MIDI note numbers modulo 12)
    const scaleNotes = useMemo(() => {
        const isMinor = normalizedKey.includes('m');
        const intervals = isMinor
            ? [0, 2, 3, 5, 7, 8, 10] // Natural minor: W-H-W-W-H-W-W
            : MAJOR_SCALE_INTERVALS;

        return intervals.map(interval => (rootNote + interval) % 12);
    }, [rootNote, normalizedKey]);

    // Check if a MIDI pitch is in the scale
    const isInScale = useMemo(() => {
        return (pitch) => {
            const pitchClass = pitch % 12;
            return scaleNotes.includes(pitchClass);
        };
    }, [scaleNotes]);

    // Get scale degree for a pitch (1-7, or null if not in scale)
    const getScaleDegree = useMemo(() => {
        return (pitch) => {
            const pitchClass = pitch % 12;
            const index = scaleNotes.indexOf(pitchClass);
            return index !== -1 ? index + 1 : null;
        };
    }, [scaleNotes]);

    // Get all scale notes across all octaves for a given range
    const getScaleNotesInRange = useMemo(() => {
        return (minPitch, maxPitch) => {
            const notes = [];
            for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
                if (isInScale(pitch)) {
                    notes.push(pitch);
                }
            }
            return notes;
        };
    }, [isInScale]);

    return {
        keySignature: normalizedKey,
        rootNote,
        scaleNotes,
        isInScale,
        getScaleDegree,
        getScaleNotesInRange
    };
}
