import { quarterNotesPerMeasure } from './timing.js';

/** Transient audition notes; persisted attacks and durations remain untouched. */
export function notesInPlaybackRange(notes, startBeat, endBeat) {
    if (endBeat <= startBeat) return [];
    return notes.filter(note => note.startTime < endBeat && note.startTime + note.duration > startBeat)
        .map(note => {
            const start = Math.max(startBeat, note.startTime);
            return {
                ...note,
                startTime: start - startBeat,
                duration: Math.min(endBeat, note.startTime + note.duration) - start,
            };
        });
}

/** Include incoming holds when auditioning a phrase, or that phrase through the end. */
export function phrasePlaybackRange(song, phraseIndex, throughEnd = false) {
    const phrase = song.phrases[phraseIndex];
    if (!phrase) return null;
    const units = quarterNotesPerMeasure(song.timeSignature);
    const start = song.phrases.slice(0, phraseIndex).reduce((sum, item) => sum + item.length * units, 0);
    const length = throughEnd
        ? song.phrases.slice(phraseIndex).reduce((sum, item) => sum + item.length, 0)
        : phrase.length;
    const tracks = { melody: [], chords: [] };
    let offset = 0;
    for (const item of song.phrases) {
        for (const hand of ['melody', 'chords']) {
            tracks[hand].push(...item.tracks[hand].map(note => ({ ...note, startTime: note.startTime + offset })));
        }
        offset += item.length * units;
    }
    return {
        ...phrase,
        length,
        tracks: {
            melody: notesInPlaybackRange(tracks.melody, start, start + length * units),
            chords: notesInPlaybackRange(tracks.chords, start, start + length * units),
        },
    };
}
