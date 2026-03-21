import { getPianoRollKeys } from '../models/song';

export function getMeasuresFromPhrase(phrase) {
    const measures = [];
    const EPSILON = 0.001;
    const keys = getPianoRollKeys(1, 5);

    const getSeparatorForMeasure = (measureIndex) => {
        const handSeparators = phrase.handSeparators || [];
        if (handSeparators.length === 0) return null;
        const applicable = handSeparators
            .filter(s => s.fromMeasure <= measureIndex)
            .sort((a, b) => b.fromMeasure - a.fromMeasure);
        return applicable[0] || null;
    };

    const splitNotesByHand = (notes, separatorPitch) => {
        if (!separatorPitch) {
            return {
                rightHand: notes.filter(n => n.trackName === 'melody'),
                leftHand: notes.filter(n => n.trackName === 'chords')
            };
        }
        const separatorIndex = keys.indexOf(separatorPitch);
        return {
            rightHand: notes.filter(n => keys.indexOf(n.pitch) < separatorIndex),
            leftHand: notes.filter(n => keys.indexOf(n.pitch) >= separatorIndex)
        };
    };

    const allNotes = [
        ...phrase.tracks.melody.map(n => ({ ...n, trackName: 'melody' })),
        ...phrase.tracks.chords.map(n => ({ ...n, trackName: 'chords' }))
    ];

    for (let i = 0; i < phrase.length; i++) {
        const measureStart = i * 4;
        const measureEnd = (i + 1) * 4;
        const measuresNotes = allNotes.filter(n =>
            n.startTime >= measureStart - EPSILON &&
            n.startTime < measureEnd - EPSILON
        );
        const separator = getSeparatorForMeasure(i);
        const { rightHand, leftHand } = splitNotesByHand(measuresNotes, separator?.pitch);
        measures.push({ melody: rightHand, chords: leftHand });
    }
    return measures;
}

export function groupNotesByTime(notes) {
    const groups = [];
    const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
    sorted.forEach(note => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && Math.abs(lastGroup.startTime - note.startTime) < 0.1) {
            lastGroup.notes.push(note);
        } else {
            groups.push({ startTime: note.startTime, notes: [note] });
        }
    });
    return groups;
}
