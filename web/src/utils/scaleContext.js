import { getMidiNumber, normalizeKeySignature, NOTE_NAMES } from '../models/song.js';

// Pure counterpart of useScaleContext: all key parsing uses the persisted model.
export function createScaleContext(keySignature) {
    const { note, mode } = normalizeKeySignature(keySignature);
    const minor = mode === 'minor';
    const rootNote = getMidiNumber(`${note}4`) % 12;
    const intervals = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const scaleNotes = intervals.map(interval => (rootNote + interval) % 12);
    const pc = pitch => ((pitch % 12) + 12) % 12;
    const isInScale = pitch => scaleNotes.includes(pc(pitch));
    return {
        keySignature: `${NOTE_NAMES[note] || note}${minor ? 'm' : ''}`,
        normalizedKey: `${note}${minor ? 'm' : ''}`,
        rootNote,
        scaleNotes,
        isInScale,
        getScaleDegree: pitch => {
            const index = scaleNotes.indexOf(pc(pitch));
            return index < 0 ? null : index + 1;
        },
        getScaleNotesInRange: (minPitch, maxPitch) => {
            const notes = [];
            for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
                if (isInScale(pitch)) notes.push(pitch);
            }
            return notes;
        },
    };
}
