import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getEnharmonicNote,
    getFrenchKeyName,
    normalizeKeySignature,
} from '../src/models/song.js';
import { StorageService } from '../src/services/StorageService.js';
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
