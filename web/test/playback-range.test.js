import assert from 'node:assert/strict';
import test from 'node:test';
import { notesInPlaybackRange, phrasePlaybackRange } from '../src/utils/playbackRange.js';
import { splitPhraseAtMeasure } from '../src/utils/phraseEditing.js';

test('isolated 6/8 phrase restores crossing holds but full playback never adds an attack', () => {
    const phrase = { id: 'p', name: 'P', length: 4, tracks: {
        melody: [{ id: 'held', pitch: 60, startTime: 5, duration: 4 }, { id: 'edge', pitch: 64, startTime: 6, duration: 1 }],
        chords: [{ id: 'bass', pitch: 48, startTime: 0, duration: 10 }],
    } };
    const song = { timeSignature: { numerator: 6, denominator: 8 }, phrases: splitPhraseAtMeasure(phrase, 2, 3, 'B') };
    const original = structuredClone(song);
    const isolated = phrasePlaybackRange(song, 1);
    assert.equal(isolated.length, 2);
    assert.deepEqual(isolated.tracks, {
        melody: [{ id: 'held', pitch: 60, startTime: 0, duration: 3 }, { id: 'edge', pitch: 64, startTime: 0, duration: 1 }],
        chords: [{ id: 'bass', pitch: 48, startTime: 0, duration: 4 }],
    });
    assert.deepEqual(phrasePlaybackRange(song, 0, true).tracks, phrase.tracks);
    assert.deepEqual(song, original);
});

test('range projection clips both edges and does not revive a released note or a future attack', () => {
    const notes = [
        { pitch: 60, startTime: 0, duration: 2 },
        { pitch: 64, startTime: 1, duration: 8 },
        { pitch: 67, startTime: 4, duration: 1 },
    ];
    assert.deepEqual(notesInPlaybackRange(notes, 2, 4), [{ pitch: 64, startTime: 0, duration: 2 }]);
    assert.deepEqual(notesInPlaybackRange(notes, 2, 2), []);
    assert.equal(phrasePlaybackRange({ phrases: [] }, 0), null);
});
