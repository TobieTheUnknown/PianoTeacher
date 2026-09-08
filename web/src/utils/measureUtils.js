import { getMidiNumber } from '../models/song.js';
import { quarterNotesPerMeasure } from './timing.js';

/** Slice note onsets using quarter-note time, with separate visual divisions. */
export function getMeasuresFromPhrase(phrase, timeSignature = { numerator: 4, denominator: 4 }) {
    const measures = [];
    // Only absorb floating-point representation noise. A musically real MIDI
    // tick (often 1/480 beat) must remain in the measure where it was authored.
    const EPSILON = 1e-9;
    // A numeric argument remains compatible with callers using quarter-note bars.
    const displayBeatsPerMeasure = typeof timeSignature === 'number' ? timeSignature : timeSignature.numerator;
    const UNITS_PER_MEASURE = typeof timeSignature === 'number' ? timeSignature : quarterNotesPerMeasure(timeSignature);

    const getSeparatorForMeasure = (measureIndex) => {
        const handSeparators = phrase.handSeparators || [];
        if (handSeparators.length === 0) return null;
        const applicable = handSeparators
            .filter(s => s.fromMeasure <= measureIndex)
            .sort((a, b) => b.fromMeasure - a.fromMeasure);
        return applicable[0] || null;
    };

    const splitNotesByHand = (notes, separatorPitch) => {
        if (separatorPitch === null || separatorPitch === undefined) {
            return {
                rightHand: notes.filter(n => n.trackName === 'melody'),
                leftHand: notes.filter(n => n.trackName === 'chords')
            };
        }
        const separator = getMidiNumber(separatorPitch);
        return {
            rightHand: notes.filter(n => getMidiNumber(n.pitch) > separator),
            leftHand: notes.filter(n => getMidiNumber(n.pitch) <= separator)
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
            measureIndex: i,
            measureStartUnits: measureStart,
            beatsPerMeasure: displayBeatsPerMeasure, // visual time signature
            unitsPerMeasure: UNITS_PER_MEASURE,      // data convention
        });
    }
    return measures;
}

export function groupNotesByTime(notes) {
    const ONSET_EPSILON = 1e-6;
    const groups = [];
    const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
    sorted.forEach(note => {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && Math.abs(lastGroup.startTime - note.startTime) < ONSET_EPSILON) {
            lastGroup.notes.push(note);
        } else {
            groups.push({ startTime: note.startTime, notes: [note] });
        }
    });
    return groups;
}
