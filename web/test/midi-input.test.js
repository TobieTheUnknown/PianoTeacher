import assert from 'node:assert/strict';
import test from 'node:test';
import { MidiInputService } from '../src/services/MidiInputService.js';

function service(values = {}) {
    globalThis.localStorage = { getItem: key => values[key] ?? null, setItem() {}, removeItem() {} };
    return new MidiInputService();
}

test('MIDI mute and zero threshold survive reopening', () => {
    const midi = service({ 'midi-volume': '0', 'midi-note-on-threshold': '0' });
    assert.equal(midi.settings.midiVolume, 0);
    assert.equal(midi.settings.noteOnThreshold, 0);
});

test('native and browser MIDI share note and pedal processing', () => {
    const midi = service();
    const seen = [];
    for (const type of ['noteOn', 'noteOff', 'sustainPedal']) midi.addEventListener(type, event => seen.push(event));
    for (const data of [[0x90,60,100], [0x90,60,0], [0xb0,64,127]]) {
        midi.handleMidiMessage({ data, timeStamp: 12 });
        midi.handleTauriMidiMessage({ status:data[0], note:data[1], velocity:data[2], timestamp:12 });
        assert.deepEqual(seen.at(-1), seen.at(-2));
    }
    assert.deepEqual(seen.map(e => e.type), ['noteOn','noteOn','noteOff','noteOff','sustainPedal','sustainPedal']);
});

test('invalid selection keeps the current keyboard; switching releases held keys', () => {
    const midi = service();
    const first = { id:'a', onmidimessage() {} };
    const second = { id:'b' };
    midi.activeDevice = first;
    midi.midiAccess = { inputs: new Map([['a',first],['b',second]]) };
    let resets = 0;
    midi.addEventListener('deviceDisconnected', () => resets++);
    assert.equal(midi.selectDevice('missing'), false);
    assert.equal(typeof first.onmidimessage, 'function');
    assert.equal(midi.selectDevice('b'), true);
    assert.equal(first.onmidimessage, null);
    assert.equal(resets, 1);
});
