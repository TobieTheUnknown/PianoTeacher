import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStaffVoices, splitStaffRests } from '../src/utils/staffVoices.js';
import { computeBeamGroups, slicePhraseIntoMeasures } from '../src/utils/sheetMusic.js';

const note = (pitch, startTime, duration) => ({ pitch, startTime, duration });

test('a held bass and moving melody retain independent durations and voices', () => {
    const notes = [note(48, 0, 2), note(72, 0, 0.5), note(74, 0.5, 0.5), note(76, 1, 0.5)];
    const voices = buildStaffVoices(notes);
    assert.equal(voices.length, 2);
    assert.deepEqual(voices[0].chords.map(chord => chord.notes.map(n => n.pitch)), [[72], [74], [76]]);
    assert.deepEqual(voices[1].chords.map(chord => chord.duration), [2]);
    assert.deepEqual(voices.map(voice => voice.rests.map(rest => [rest.startTime, rest.duration])), [[[1.5, 2.5]], [[2, 2]]]);
});

test('only exact simultaneous equal durations share stems, independently of display width', () => {
    const voices = buildStaffVoices([note(60, 0, 1), note(64, 0, 1), note(67, 0.0001, 1)]);
    assert.equal(voices.length, 2);
    assert.deepEqual(voices.flatMap(v => v.chords).map(c => c.notes.length), [1, 2]);
});

test('initial and internal silences are retained and an empty 6/8 staff gets a measure rest', () => {
    const [voice] = buildStaffVoices([note(60, 1, 0.5), note(62, 2, 1)], 0, 3);
    assert.deepEqual(voice.rests, [
        { startTime: 0, duration: 1, fullMeasure: false },
        { startTime: 1.5, duration: 0.5, fullMeasure: false },
    ]);
    assert.deepEqual(buildStaffVoices([], 6, 3)[0].rests, [{ startTime: 6, duration: 3, fullMeasure: true }]);
});

test('tied fragments preserve source identity and cover every voice without overlaps', () => {
    const phrase = { length: 2, tracks: { melody: [note(60, 3, 3), note(72, 4, 0.5)] } };
    const second = slicePhraseIntoMeasures(phrase)[1];
    const voices = buildStaffVoices(second.melodyNotes, second.measureStart, 4);
    const held = voices.flatMap(v => v.chords).flatMap(c => c.notes).find(n => n.pitch === 60);
    assert.equal(held.tieFromPrevious, true);
    assert.equal(held.duration, 2);
    assert.equal(phrase.tracks.melody[0].duration, 3);
    for (const voice of voices) {
        const spans = [...voice.chords, ...voice.rests].sort((a, b) => a.startTime - b.startTime);
        let cursor = 4;
        for (const span of spans) {
            assert.equal(span.startTime, cursor);
            cursor += span.duration;
        }
        assert.equal(cursor, 8);
    }
});

test('beams do not mix interleaved voices or simultaneous unequal durations', () => {
    const items = [
        { startBeat: 0, durationBeats: 0.25, flags: 2, voice: 0 },
        { startBeat: 0, durationBeats: 0.5, flags: 1, voice: 1 },
        { startBeat: 0.25, durationBeats: 0.25, flags: 2, voice: 0 },
        { startBeat: 0.5, durationBeats: 0.5, flags: 1, voice: 1 },
    ];
    assert.deepEqual(computeBeamGroups(items), [[0, 2], [1, 3]]);
    assert.deepEqual(computeBeamGroups(items.slice(0, 2).map((item) => ({
        startBeat: item.startBeat,
        durationBeats: item.durationBeats,
        flags: item.flags,
    }))), [[0], [1]]);
});

test('rest spelling respects compound pulses and preserves expressive residuals', () => {
    const span = { startTime: 0.5, duration: 2.5, fullMeasure: false };
    assert.deepEqual(splitStaffRests([span]).map(rest => rest.duration), [0.5, 1, 1]);
    assert.deepEqual(splitStaffRests([span], { numerator: 6, denominator: 8 }).map(rest => rest.duration), [1, 1.5]);
    const expressive = splitStaffRests([{ startTime: 0, duration: 0.26, fullMeasure: false }]);
    assert.equal(expressive.reduce((sum, rest) => sum + rest.duration, 0), 0.26);
    assert.equal(expressive.at(-1).notatable, false);
    assert.equal(splitStaffRests([{ startTime: 0, duration: 3, fullMeasure: true }]).length, 1);
});

test('a late upper voice is ranked above the held bass regardless of input order', () => {
    const notes = [note(48, 0, 4), note(72, 1, 1), note(74, 2, 1)];
    const voices = buildStaffVoices(notes);
    assert.deepEqual(voices[0].chords.flatMap(chord => chord.notes.map(n => n.pitch)), [72, 74]);
    assert.deepEqual(voices, buildStaffVoices(notes.slice().reverse()));
    assert.equal(voices[1].chords[0].notes[0].pitch, 48);
});
