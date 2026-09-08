import { createPhrase } from '../models/song.js';

function separatorAt(separators, measure) {
    return [...(separators || [])]
        .filter(separator => separator.fromMeasure <= measure)
        .sort((a, b) => b.fromMeasure - a.fromMeasure)[0] || null;
}

export function splitPhraseAtMeasure(phrase, splitMeasure, unitsPerMeasure, newName) {
    if (!Number.isInteger(splitMeasure) || splitMeasure <= 0 || splitMeasure >= phrase.length) return null;
    const splitTime = splitMeasure * unitsPerMeasure;
    const partition = notes => ({
        before: notes.filter(note => note.startTime < splitTime),
        after: notes.filter(note => note.startTime >= splitTime)
            .map(note => ({ ...note, startTime: note.startTime - splitTime })),
    });
    const melody = partition(phrase.tracks.melody);
    const chords = partition(phrase.tracks.chords);
    const beforeSeparators = (phrase.handSeparators || []).filter(s => s.fromMeasure < splitMeasure);
    const afterSeparators = (phrase.handSeparators || [])
        .filter(s => s.fromMeasure >= splitMeasure)
        .map(s => ({ ...s, fromMeasure: s.fromMeasure - splitMeasure }));
    const inherited = separatorAt(phrase.handSeparators, splitMeasure);
    if (inherited && !afterSeparators.some(s => s.fromMeasure === 0)) {
        afterSeparators.unshift({ ...inherited, fromMeasure: 0 });
    }

    const after = createPhrase(newName, phrase.length - splitMeasure);
    after.tracks = { melody: melody.after, chords: chords.after };
    after.handSeparators = afterSeparators;
    return [
        {
            ...phrase,
            length: splitMeasure,
            tracks: { melody: melody.before, chords: chords.before },
            handSeparators: beforeSeparators,
        },
        after,
    ];
}

export function mergePhrases(previous, current, unitsPerMeasure) {
    const offset = previous.length * unitsPerMeasure;
    const shiftedSeparators = (current.handSeparators || []).map(separator => ({
        ...separator,
        fromMeasure: separator.fromMeasure + previous.length,
    }));
    return {
        ...previous,
        // Phrase length is authored structure, including intentional trailing silence.
        length: previous.length + current.length,
        tracks: {
            melody: previous.tracks.melody.concat(current.tracks.melody.map(note => ({ ...note, startTime: note.startTime + offset }))),
            chords: previous.tracks.chords.concat(current.tracks.chords.map(note => ({ ...note, startTime: note.startTime + offset }))),
        },
        handSeparators: [...(previous.handSeparators || []), ...shiftedSeparators],
    };
}
