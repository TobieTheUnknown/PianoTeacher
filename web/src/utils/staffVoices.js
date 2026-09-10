import { getMidiNumber } from '../models/song.js';

const EPSILON = 1e-9;

/** Split exact silence spans on pulse boundaries, then into standard binary
 * or dotted rests. Residual expressive timing is explicitly non-notatable,
 * never rounded into a rest with a different duration. Tuplets need metadata.
 */
export function splitStaffRests(rests, timeSignature = { numerator: 4, denominator: 4 }, measureStart = 0) {
    const denominator = timeSignature.denominator > 0 ? timeSignature.denominator : 4;
    const compound = denominator === 8 && timeSignature.numerator > 3 && timeSignature.numerator % 3 === 0;
    const pulse = (4 / denominator) * (compound ? 3 : 1);
    const values = [4, 2, 1, 0.5, 0.25, 0.125, 0.0625, 0.03125]
        .flatMap(value => [value, value * 1.5]).sort((a, b) => b - a);
    return rests.flatMap(rest => {
        if (rest.fullMeasure) return [{ ...rest, notatable: true }];
        const out = [];
        let cursor = rest.startTime;
        const end = cursor + rest.duration;
        while (cursor < end - EPSILON) {
            const nextPulse = measureStart + (Math.floor((cursor - measureStart + EPSILON) / pulse) + 1) * pulse;
            const available = Math.min(end, nextPulse) - cursor;
            const value = values.find(value => value <= available + EPSILON);
            const duration = value ?? available;
            out.push({ startTime: cursor, duration, fullMeasure: false, notatable: value != null });
            cursor += duration;
        }
        return out;
    });
}

/**
 * Infer engraving voices from a measure's display fragments. This is interval
 * partitioning, not recovery of the composer's original voices (MIDI/our model
 * has no such metadata). Only notes with the same onset AND duration may share
 * a stem. Never group by screen x: zoom must not change musical meaning.
 *
 * All starts are in the same units as the input notes. Rest spans are exact;
 * fullMeasure marks an empty staff, whose rest is centered regardless of meter.
 * Notes and their tie flags are retained without changing playback data.
 */
export function buildStaffVoices(notes, measureStart = 0, beatsPerMeasure = 4) {
    if (!Number.isFinite(measureStart) || !Number.isFinite(beatsPerMeasure) || beatsPerMeasure <= 0) return [];
    const measureEnd = measureStart + beatsPerMeasure;
    const pitch = note => typeof note.pitch === 'number' ? note.pitch : getMidiNumber(note.pitch);
    const sorted = notes.filter(note => Number.isFinite(note.startTime) && Number.isFinite(note.duration)
        && note.duration > EPSILON && note.startTime >= measureStart - EPSILON
        && note.startTime + note.duration <= measureEnd + EPSILON)
        .slice().sort((a, b) => a.startTime - b.startTime || pitch(b) - pitch(a) || b.duration - a.duration);
    const chords = [];
    let onsetChords = [];
    let onset = -Infinity;
    for (const note of sorted) {
        if (Math.abs(note.startTime - onset) > EPSILON) {
            onset = note.startTime;
            onsetChords = [];
        }
        let chord = onsetChords.find(item => Math.abs(item.duration - note.duration) <= EPSILON);
        if (!chord) {
            chord = { startTime: note.startTime, duration: note.duration, notes: [] };
            onsetChords.push(chord);
            chords.push(chord);
        }
        chord.notes.push(note);
    }
    const voices = [];
    for (const chord of chords) {
        // Prefer the closest previous pitch among free voices; time availability
        // remains the hard constraint, so a held bass never steals melody notes.
        const center = chord.notes.reduce((sum, note) => sum + pitch(note), 0) / chord.notes.length;
        const available = voices.filter(voice => voice.end <= chord.startTime + EPSILON)
            .sort((a, b) => Math.abs(a.center - center) - Math.abs(b.center - center) || a.index - b.index);
        let voice = available[0];
        if (!voice) {
            voice = { index: voices.length, end: measureStart, center, chords: [] };
            voices.push(voice);
        }
        voice.chords.push(chord);
        voice.end = chord.startTime + chord.duration;
        voice.center = center;
    }
    if (!voices.length) voices.push({ index: 0, chords: [] });
    // Rank complete voices by pitch, not by first entry time: a melody entering
    // after a sustained bass still receives the upper voice/stem direction.
    const averagePitch = voice => {
        let weight = 0;
        let sum = 0;
        for (const chord of voice.chords) for (const note of chord.notes) {
            weight += note.duration;
            sum += pitch(note) * note.duration;
        }
        return weight ? sum / weight : 0;
    };
    voices.sort((a, b) => averagePitch(b) - averagePitch(a) || a.index - b.index);
    return voices.map((voice, index) => {
        const rests = [];
        let cursor = measureStart;
        for (const chord of voice.chords) {
            if (chord.startTime > cursor + EPSILON) rests.push({ startTime: cursor, duration: chord.startTime - cursor, fullMeasure: false });
            cursor = Math.max(cursor, chord.startTime + chord.duration);
        }
        if (cursor < measureEnd - EPSILON) rests.push({ startTime: cursor, duration: measureEnd - cursor, fullMeasure: !voice.chords.length });
        return { index, chords: voice.chords, rests };
    });
}
