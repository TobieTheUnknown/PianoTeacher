import { getPianoRollKeys } from '../models/song';

/**
 * Slice a phrase into measures.
 *
 * @param phrase
 * @param displayBeatsPerMeasure  How many beats the measure shows visually
 *   (= time signature numerator). Carried on each measure so the UI can
 *   draw the right number of division lines.
 *
 * Note: the underlying note `startTime` values are stored in our internal
 * "4 units per measure" convention (legacy, matches what the MIDI parser
 * and editor produce). That's what we slice against. The display unit
 * (numerator) is purely cosmetic.
 */
export function getMeasuresFromPhrase(phrase, displayBeatsPerMeasure = 4) {
    const measures = [];
    const EPSILON = 0.001;
    const keys = getPianoRollKeys(1, 5);
    const UNITS_PER_MEASURE = 4;

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
        const measureStart = i * UNITS_PER_MEASURE;
        const measureEnd = (i + 1) * UNITS_PER_MEASURE;
        const measuresNotes = allNotes.filter(n =>
            n.startTime >= measureStart - EPSILON &&
            n.startTime < measureEnd - EPSILON
        );
        const separator = getSeparatorForMeasure(i);
        const { rightHand, leftHand } = splitNotesByHand(measuresNotes, separator?.pitch);
        measures.push({
            melody: rightHand,
            chords: leftHand,
            beatsPerMeasure: displayBeatsPerMeasure, // visual time signature
            unitsPerMeasure: UNITS_PER_MEASURE,      // data convention
        });
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
