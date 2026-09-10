import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getEnharmonicNote,
    getFrenchKeyName,
    normalizeKeySignature,
} from '../src/models/song.js';
import { StorageService } from '../src/services/StorageService.js';
import { buildSongMidiBytes } from '../src/services/StorageService.js';
import {
    getChordDegree,
    identifyChord,
    qualifyOstinatoMeasure,
} from '../src/utils/chordDetection.js';
import { toKotlinKeySig } from '../src/utils/sheetMusic.js';

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }

    clear() {
        this.values.clear();
    }
}

test('normalizeKeySignature migrates compact legacy keys', () => {
    assert.deepEqual(normalizeKeySignature('Bb'), { note: 'Bb', mode: 'major' });
    assert.deepEqual(normalizeKeySignature('Bbm'), { note: 'Bb', mode: 'minor' });
    assert.deepEqual(normalizeKeySignature('f#m'), { note: 'F#', mode: 'minor' });
    assert.deepEqual(normalizeKeySignature({ note: 'Eb', mode: 'minor' }), {
        note: 'Eb', mode: 'minor',
    });
    assert.deepEqual(normalizeKeySignature('not-a-key'), { note: 'C', mode: 'major' });
});

test('legacy key strings remain safe for display, enharmonics and engraving adapters', () => {
    assert.equal(getFrenchKeyName('Bbm'), 'Sib mineur');
    assert.equal(getEnharmonicNote('D#', 'Bbm'), 'Eb');
    assert.deepEqual(toKotlinKeySig('Bbm'), {
        root: 10,
        isMinor: true,
        useFlats: true,
        keyName: 'Bb-minor',
    });
});

test('StorageService canonicalizes a legacy key on save and load', () => {
    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = new MemoryStorage();
    try {
        StorageService.saveSong({
            id: 'legacy-key-song',
            title: 'Legacy',
            key: 'F#m',
            phrases: [],
        });
        const [saved] = StorageService.getSongs();
        assert.deepEqual(saved.key, { note: 'F#', mode: 'minor' });
        const persisted = JSON.parse(globalThis.localStorage.getItem('piano_teacher_songs'));
        assert.deepEqual(persisted[0].key, { note: 'F#', mode: 'minor' });
    } finally {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    }
});

test('chord detection remains key-aware after normalization', () => {
    const chord = identifyChord([58, 62, 65], 'Bbm'); // Bb-D-F
    assert.ok(chord);
    assert.equal(chord.rootName, 'Sib');
    assert.equal(chord.quality, 'Maj');
    assert.equal(getChordDegree(chord, 'Bbm'), 'I');
});

function singleNoteGroups(pitches) {
    return pitches.map((pitch, index) => ({
        startTime: index * 0.5,
        notes: [{ pitch, startTime: index * 0.5, duration: 0.5 }],
    }));
}

test('ostinato run signature includes the ordered motif, not rhythm alone', () => {
    const doRe = qualifyOstinatoMeasure(singleNoteGroups([60, 62, 60, 62]), {
        note: 'C', mode: 'major',
    });
    const doMi = qualifyOstinatoMeasure(singleNoteGroups([60, 64, 60, 64]), {
        note: 'C', mode: 'major',
    });

    assert.ok(doRe);
    assert.ok(doMi);
    assert.equal(doRe.rhythmSig, doMi.rhythmSig);
    assert.notEqual(doRe.runSig, doMi.runSig);
    assert.deepEqual(doRe.motifPcs, [0, 2]);
});

const { getMidiNumber, getFrenchNoteName } = await import('../src/models/song.js');
const { createScaleContext } = await import('../src/utils/scaleContext.js');

test('note parsing covers MIDI edges, enharmonics and rejects partial names', () => {
    for (const [name, midi] of [['C-1', 0], ['G9', 127], ['E#4', 65], ['Fb4', 64], ['B#3', 60], ['Cb4', 59]]) {
        assert.equal(getMidiNumber(name), midi);
    }
    for (const name of ['C4junk', 'C-2', 'G#9', {}, '']) assert.equal(getMidiNumber(name), null);
});

test('enharmonic labels preserve the sounding octave across B/C', () => {
    assert.equal(getEnharmonicNote('F', 'F#'), 'E#');
    assert.equal(getEnharmonicNote('B', 'Cb'), 'Cb');
    assert.equal(getFrenchNoteName(60, 'C#'), 'Si#3');
    assert.equal(getFrenchNoteName(59, 'Cb'), 'Dob4');
});

test('A sharp minor has the same scale for object and compact keys', () => {
    for (const key of ['A#m', { note: 'A#', mode: 'minor' }]) {
        const scale = createScaleContext(key);
        assert.equal(scale.rootNote, 10);
        assert.deepEqual(scale.scaleNotes, [10, 0, 1, 3, 5, 6, 8]);
        assert.equal(scale.getScaleDegree(60), 2);
        assert.equal(scale.isInScale(64), false);
    }
});

test('inverted seventh wins over a triad subset rooted at the bass', () => {
    const chord = identifyChord([62, 65, 69, 70], 'Bb');
    assert.equal(chord.rootPitchClass, 10);
    assert.equal(chord.quality, 'Maj7');
});

test('measure harmony is consistent and does not invent a missing seventh', async () => {
    const { getMeasureHarmony } = await import('../src/utils/chordDetection.js');
    assert.equal(getMeasureHarmony([60, 64, 65], 'C'), null);
    const harmony = getMeasureHarmony([60, 64, 67, 69], 'C');
    assert.equal(harmony.chord.quality, '6');
    assert.equal(harmony.chord.rootPitchClass, 0);
    assert.equal(harmony.label, 'DO 6');
});

const { getMeasuresFromPhrase, groupNotesByTime } = await import('../src/utils/measureUtils.js');
const { analyzeSong } = await import('../src/utils/analyzeSong.js');
const { detectKey, parseMidiFile } = await import('../src/services/MidiService.js');
const MidiModule = await import('@tonejs/midi');
const { Midi } = MidiModule.default ?? MidiModule;

test('6/8 cards use three quarter notes per measure and keep six visual divisions', () => {
    const phrase = { length: 2, tracks: { melody: [{ pitch: 84, startTime: 3, duration: 0.5 }], chords: [{ pitch: 12, startTime: 3, duration: 1 }] }, handSeparators: [{ fromMeasure: 0, pitch: 60 }] };
    const measures = getMeasuresFromPhrase(phrase, { numerator: 6, denominator: 8 });
    assert.equal(measures[0].melody.length, 0);
    assert.equal(measures[1].melody[0].pitch, 84);
    assert.equal(measures[1].chords[0].pitch, 12);
    assert.equal(measures[1].unitsPerMeasure, 3);
    assert.equal(measures[1].beatsPerMeasure, 6);
    const analysis = analyzeSong({ key: 'C', timeSignature: { numerator: 6, denominator: 8 }, phrases: [phrase] });
    assert.equal(analysis.measures[1].measureStartUnits, 3);
});

test('a real one-tick onset before the final barline is not discarded', () => {
    const tick = 1 / 1920;
    const phrase = { length: 1, tracks: { melody: [
        { pitch: 60, startTime: 4 - tick, duration: tick },
    ], chords: [] } };
    assert.equal(getMeasuresFromPhrase(phrase, { numerator: 4, denominator: 4 })[0].melody.length, 1);
});

test('score slicing clips sustained notes into tied bar fragments', async () => {
    const { slicePhraseIntoMeasures } = await import('../src/utils/sheetMusic.js');
    const phrase = { length: 3, tracks: { melody: [
        { id: 'held', pitch: 60, startTime: 3, duration: 6 },
    ], chords: [] } };
    const measures = slicePhraseIntoMeasures(phrase, 4);
    assert.deepEqual(measures.map(m => m.melodyNotes.map(n => ({
        start: n.startTime, duration: n.duration, from: n.tieFromPrevious, to: n.tieToNext,
    }))), [
        [{ start: 3, duration: 1, from: false, to: true }],
        [{ start: 4, duration: 4, from: true, to: true }],
        [{ start: 8, duration: 1, from: true, to: false }],
    ]);
});

test('real MIDI decoding preserves pickups, long songs, explicit key and single-track hands', async () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [6, 8] });

    midi.header.update();
    const track = midi.addTrack();
    track.addNote({ midi: 48, ticks: 240, durationTicks: 240 });
    track.addNote({ midi: 72, ticks: 480 * 3 * 70, durationTicks: 240 });
    // Write the raw -5 flats/minor event, avoiding @tonejs/midi's encoder bug.
    const { default: midiFile } = await import('midi-file');
    const raw = midiFile.parseMidi(midi.toArray());
    raw.tracks[0].unshift({ deltaTime: 0, meta: true, type: 'keySignature', key: -5, scale: 1 });
    const song = await parseMidiFile(new File([new Uint8Array(midiFile.writeMidi(raw))], 'regression.mid'));
    assert.equal(song.phrases[0].length, 71);
    assert.equal(song.phrases[0].tracks.chords[0].startTime, 0.5);
    assert.equal(song.phrases[0].tracks.melody[0].startTime, 210);
    assert.deepEqual(song.key, { note: 'Bb', mode: 'minor' });
});

test('metadata after tick zero does not rewrite the beginning of an imported song', async () => {
    const { default: midiFile } = await import('midi-file');
    const raw = {
        header: { format: 0, numTracks: 1, ticksPerBeat: 480 },
        tracks: [[
            { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 100 },
            { deltaTime: 1, type: 'noteOff', channel: 0, noteNumber: 60, velocity: 0 },
            { deltaTime: 479, meta: true, type: 'setTempo', microsecondsPerBeat: 1_000_000 },
            { deltaTime: 0, meta: true, type: 'timeSignature', numerator: 3, denominator: 4, metronome: 24, thirtyseconds: 8 },
            { deltaTime: 0, meta: true, type: 'endOfTrack' },
        ]],
    };
    const song = await parseMidiFile(new File([new Uint8Array(midiFile.writeMidi(raw))], 'late-meta.mid'));
    assert.equal(song.tempo, 120);
    assert.deepEqual(song.timeSignature, { numerator: 4, denominator: 4 });
    assert.equal(song.phrases[0].tracks.melody[0].duration, 1 / 480);
});

test('statistical key detection uses the same Pearson definition as Android', () => {
    const notes = [60, 64, 68].map(midi => ({ midi, duration: 1 }));
    assert.deepEqual(detectKey(notes), { note: 'C', mode: 'major' });
});

test('MIDI export and import preserve key, meter, phrase offsets and short durations', async () => {
    const source = {
        id: 'roundtrip', title: 'Round trip', tempo: 96,
        key: { note: 'Bb', mode: 'minor' },
        timeSignature: { numerator: 6, denominator: 8 },
        phrases: [
            { id: 'a', name: 'A', length: 2, tracks: {
                melody: [{ id: 'n1', pitch: 72, startTime: 0.5, duration: 1 / 480 }], chords: [],
            } },
            { id: 'b', name: 'B', length: 1, tracks: {
                melody: [], chords: [{ id: 'n2', pitch: 48, startTime: 0, duration: 0.25 }],
            } },
        ],
    };
    const bytes = buildSongMidiBytes(source);
    const imported = await parseMidiFile(new File([bytes], 'roundtrip.mid'));
    assert.equal(imported.tempo, 96);
    assert.deepEqual(imported.timeSignature, source.timeSignature);
    assert.deepEqual(imported.key, source.key);
    assert.equal(imported.phrases[0].tracks.melody[0].startTime, 0.5);
    assert.equal(imported.phrases[0].tracks.melody[0].duration, 1 / 480);
    assert.equal(imported.phrases[0].tracks.chords[0].startTime, 6);
});

test('repeated arpeggio badges report the same repetitions for both hands', () => {
    const notes = Array.from({ length: 16 }, (_, i) => ({ pitch: [60, 64, 67, 64][i % 4], startTime: i * 0.5, duration: 0.5 }));
    const analysis = analyzeSong({ key: 'C', phrases: [{ length: 2, tracks: { melody: notes, chords: notes.map(n => ({ ...n, pitch: n.pitch - 12 })) } }] });
    for (const measure of analysis.measures) {
        assert.equal(measure.leftRole.badge.reps, 2);
        assert.equal(measure.rightRole.badge.reps, 2);
    }
});

const { keySignatureAccidentalCount, spellMidiForStaff, createAccidentalState } = await import('../src/utils/sheetMusic.js');
const { computeBeamGroups } = await import('../src/utils/sheetMusic.js');

test('seven-sign armures and staff placement preserve the written letter', () => {
    for (const key of ['C#', 'Cb', 'A#m', 'Abm']) assert.equal(keySignatureAccidentalCount(key), 7);
    assert.equal(spellMidiForStaff(65, 'F#').diatonic, 37); // E#4, not F4
    assert.equal(spellMidiForStaff(59, 'Cb').diatonic, 35); // Cb4, not B3
    assert.equal(spellMidiForStaff(60, 'C#').diatonic, 34); // B#3
    assert.equal(keySignatureAccidentalCount('invalid'), 0);
});

test('accidentals follow the armure, cancel, repeat per octave and reset per measure', () => {
    const accidental = createAccidentalState('G');
    assert.equal(accidental(spellMidiForStaff(66, 'G')), null);
    assert.equal(accidental(spellMidiForStaff(65, 'G')), '♮');
    assert.equal(accidental(spellMidiForStaff(65, 'G')), null);
    assert.equal(accidental(spellMidiForStaff(77, 'G')), '♮');
    assert.equal(accidental(spellMidiForStaff(66, 'G')), '♯');
    assert.equal(createAccidentalState('G')(spellMidiForStaff(66, 'G')), null);
});

test('beams follow simple and compound meter pulses', () => {
    const eighths = Array.from({ length: 8 }, (_, index) => ({
        startBeat: index * 0.5, durationBeats: 0.5, flags: 1,
    }));
    assert.deepEqual(computeBeamGroups(eighths, { numerator: 4, denominator: 4 }).map(g => g.length), [2,2,2,2]);
    assert.deepEqual(computeBeamGroups(eighths.slice(0, 6), { numerator: 6, denominator: 8 }).map(g => g.length), [3,3]);
});

const { segmentRepeatedMotifs } = await import('../src/utils/repeatedMotifs.js');
const { splitPhraseAtMeasure, mergePhrases } = await import('../src/utils/phraseEditing.js');
test('user example splits into do mi fa x3 then mi fa x2', () => {
    const groups = singleNoteGroups([60,64,65,60,64,65,60,64,65,64,65,64,65]);
    const segments = segmentRepeatedMotifs(groups);
    assert.deepEqual(segments.map(s => [s.groups.map(g => g.notes[0].pitch), s.repetitions]), [[[60,64,65],3],[[64,65],2]]);
    assert.equal(segments.reduce((sum, s) => sum + s.eventCount, 0), groups.length);
});

test('motif segmentation preserves tails, octave changes, chords and rubato ordering', () => {
    for (const pitches of [[60,64,65,60,64,65,62], [60,64,65,72,76,77], [], [60], [60,60,60]]) {
        const groups = singleNoteGroups(pitches);
        const expanded = segmentRepeatedMotifs(groups).flatMap(s => Array.from({length:s.repetitions}, () => s.groups.map(g => g.notes[0].pitch)).flat());
        assert.deepEqual(expanded, pitches);
    }
    const groups = singleNoteGroups([60,64,65,60,64,65]);
    groups.forEach((g, i) => { g.startTime += i * i * 0.013; });
    assert.equal(segmentRepeatedMotifs(groups)[0].repetitions, 2);
});

test('fast sequential notes remain separate events for motif detection', () => {
    const notes = [60,64,65,60,64,65].map((pitch, index) => ({
        pitch, startTime: index / 16, duration: 1 / 16,
    }));
    const groups = getMeasuresFromPhrase({ length: 1, tracks: { melody: notes, chords: [] } })[0].melody;
    const onsets = groupNotesByTime(groups);
    assert.equal(onsets.length, 6);
    assert.equal(segmentRepeatedMotifs(onsets)[0].repetitions, 2);
});

test('split and merge preserve measure positions, trailing silence and hand separators', () => {
    const phrase = {
        id: 'p', name: 'P', length: 4,
        tracks: {
            melody: [{ id: 'a', pitch: 60, startTime: 3, duration: 1 }, { id: 'b', pitch: 64, startTime: 9, duration: 1 }],
            chords: [],
        },
        handSeparators: [{ fromMeasure: 0, pitch: 58 }, { fromMeasure: 2, pitch: 61 }],
    };
    assert.equal(splitPhraseAtMeasure(phrase, 1.5, 4, 'B'), null);
    const [before, after] = splitPhraseAtMeasure(phrase, 2, 4, 'B');
    assert.equal(after.tracks.melody[0].startTime, 1);
    assert.deepEqual(after.handSeparators, [{ fromMeasure: 0, pitch: 61 }]);
    const merged = mergePhrases(before, after, 4);
    assert.equal(merged.length, 4);
    assert.deepEqual(merged.tracks.melody.map(note => note.startTime), [3, 9]);
    assert.deepEqual(merged.handSeparators, phrase.handSeparators);
});

test('compound-meter split keeps crossing holds without clipping or duplicate attacks', () => {
    const phrase = {
        id: 'p', name: 'P', length: 4,
        tracks: {
            melody: [{ id: 'held', pitch: 60, startTime: 5, duration: 4 }, { id: 'edge', pitch: 64, startTime: 6, duration: 1 }],
            chords: [{ id: 'bass', pitch: 48, startTime: 0, duration: 10 }, { id: 'later', pitch: 52, startTime: 8, duration: 1 }],
        },
        handSeparators: [{ fromMeasure: 0, pitch: 59 }],
    };
    const [before, after] = splitPhraseAtMeasure(phrase, 2, 3, 'B');
    assert.equal(before.tracks.melody[0].duration, 4);
    assert.equal(before.tracks.chords[0].duration, 10);
    assert.equal(after.tracks.melody[0].startTime, 0);
    assert.equal(after.tracks.chords[0].startTime, 2);
    assert.deepEqual(after.handSeparators, [{ fromMeasure: 0, pitch: 59 }]);
    assert.deepEqual(mergePhrases(before, after, 3).tracks, phrase.tracks);
    assert.equal(mergePhrases(before, after, 3).length, 4);
    for (const units of [0, -1, NaN, Infinity]) {
        assert.equal(splitPhraseAtMeasure(phrase, 2, units, 'B'), null);
    }
});

test('damaged library survives save, delete and merge attempts', () => {
    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = new MemoryStorage();
    try {
        for (const damaged of ['{broken', '{"songs":[]}', '[null]']) {
            localStorage.setItem('piano_teacher_songs', damaged);
            assert.equal(StorageService.saveSong({ id: 'new', phrases: [] }), false);
            assert.equal(StorageService.deleteSong('old'), false);
            assert.throws(() => StorageService.importLibrary([], true));
            assert.equal(localStorage.getItem('piano_teacher_songs'), damaged);
        }
    } finally {
        globalThis.localStorage = previousStorage;
    }
});

test('legacy flat hands migrate without changing the supplied song', () => {
    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = new MemoryStorage();
    try {
        const original = { id: 'flat', phrases: [{ id: 'p', length: 1,
            melody: [{ pitch: 'E#4', startTime: 0, duration: 1 }],
            chords: [{ pitch: 'Cb3', startTime: 0, duration: 1 }] }] };
        assert.equal(StorageService.saveSong(original), true);
        const phrase = StorageService.loadSong('flat').phrases[0];
        assert.equal(phrase.tracks.melody[0].pitch, 65);
        assert.equal(phrase.tracks.chords[0].pitch, 47);
        assert.equal(phrase.melody, undefined);
        assert.equal(original.phrases[0].melody[0].pitch, 'E#4');
        assert.equal(original.phrases[0].tracks, undefined);
    } finally {
        globalThis.localStorage = previousStorage;
    }
});
