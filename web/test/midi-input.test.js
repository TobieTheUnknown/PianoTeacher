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

function memoryStorage(values = {}) {
    const data = new Map(Object.entries(values));
    return {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key),
    };
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}

async function until(predicate) {
    for (let i = 0; i < 30 && !predicate(); i++) await Promise.resolve();
    assert.ok(predicate(), 'expected operation to be dispatched');
}

function nativeFixture(storage = memoryStorage()) {
    const calls = [];
    const connects = [];
    let backendDevice = null;
    const midi = new MidiInputService({ storage, autoInit: false, nativeInvoke: async (command, args) => {
        calls.push([command, args?.deviceId]);
        if (command === 'disconnect_midi_device') backendDevice = null;
        if (command === 'connect_midi_device') {
            const gate = deferred();
            connects.push({ id: args.deviceId, ...gate });
            await gate.promise;
            backendDevice = args.deviceId;
        }
    } });
    midi.useTauriMidi = true;
    midi.devices = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    return { midi, calls, connects, storage, backend: () => backendDevice };
}

test('native disconnect wins over a connection already in flight in runtime and backend', async () => {
    const { midi, connects, backend, storage } = nativeFixture();
    const connected = [];
    midi.addEventListener('deviceConnected', device => connected.push(device.id));
    const first = midi.selectDevice('a');
    await until(() => connects.length === 1);
    const stopped = midi.disconnect();
    connects[0].resolve();
    assert.equal(await first, false);
    assert.equal(await stopped, true);
    assert.equal(backend(), null);
    assert.equal(midi.getActiveDevice(), null);
    assert.equal(storage.getItem('midi-selected-device'), null);
    assert.deepEqual(connected, []);
});

test('native selections serialize hardware and publish only the latest requested keyboard', async () => {
    const { midi, connects, backend, storage, calls } = nativeFixture();
    const connected = [];
    midi.addEventListener('deviceConnected', device => connected.push(device.id));
    const first = midi.selectDevice('a');
    await until(() => connects.length === 1);
    const second = midi.selectDevice('b');
    await Promise.resolve();
    assert.equal(connects.length, 1); // B cannot finish before hardware operation A.
    connects[0].resolve();
    await until(() => connects.length === 2);
    assert.equal(connects[1].id, 'b');
    connects[1].resolve();
    assert.equal(await first, false);
    assert.equal(await second, true);
    assert.equal(backend(), 'b');
    assert.equal(midi.getActiveDevice().id, 'b');
    assert.equal(midi.isDeviceConnected(), true);
    assert.equal(storage.getItem('midi-selected-device'), 'b');
    assert.deepEqual(connected, ['b']);
    assert.deepEqual(calls.map(call => call[0]), [
        'disconnect_midi_device', 'connect_midi_device', 'disconnect_midi_device', 'connect_midi_device',
    ]);
});

test('failed native operation does not prevent a later selection or emit stale MIDI', async () => {
    const { midi, connects, backend } = nativeFixture();
    let attacks = 0;
    midi.addEventListener('noteOn', () => attacks++);
    const first = midi.selectDevice('a');
    await until(() => connects.length === 1);
    midi.handleTauriMidiMessage({ status: 144, note: 60, velocity: 90, timestamp: 1 });
    assert.equal(attacks, 0);
    const second = midi.selectDevice('b');
    connects[0].reject(new Error('device unplugged'));
    await until(() => connects.length === 2);
    connects[1].resolve();
    assert.equal(await first, false);
    assert.equal(await second, true);
    assert.equal(backend(), 'b');
    midi.handleTauriMidiMessage({ status: 144, note: 60, velocity: 90, timestamp: 2 });
    assert.equal(attacks, 1);
});

test('native scan invalidates a vanished active keyboard but preserves and reconnects its preference', async () => {
    const storage = memoryStorage({ 'midi-selected-device': 'a' });
    let devices = [];
    let backend = 'a';
    const midi = new MidiInputService({ storage, autoInit: false, nativeInvoke: async (command, args) => {
        if (command === 'get_midi_devices') return devices;
        if (command === 'disconnect_midi_device') backend = null;
        if (command === 'connect_midi_device') backend = args.deviceId;
    } });
    midi.useTauriMidi = true;
    midi.activeDevice = { id: 'a', state: 'connected' };
    let disconnected = 0;
    midi.addEventListener('deviceDisconnected', () => disconnected++);
    await midi.refreshDevices();
    assert.equal(disconnected, 1);
    assert.equal(backend, null);
    assert.equal(midi.getActiveDevice(), null);
    assert.equal(storage.getItem('midi-selected-device'), 'a');
    devices = [{ id: 'a', name: 'A' }];
    await midi.refreshDevices();
    assert.equal(backend, 'a');
    assert.equal(midi.getActiveDevice().id, 'a');
    await midi.disconnect();
    await midi.refreshDevices();
    assert.equal(backend, null);
    assert.equal(storage.getItem('midi-selected-device'), null);
});

test('out-of-order native scan results never replace the latest device list', async () => {
    const scans = [];
    const midi = new MidiInputService({ storage: memoryStorage(), autoInit: false, nativeInvoke: () => {
        const gate = deferred();
        scans.push(gate);
        return gate.promise;
    } });
    midi.useTauriMidi = true;
    const first = midi.refreshDevices();
    const second = midi.refreshDevices();
    scans[1].resolve([{ id: 'b', name: 'B' }]);
    await second;
    scans[0].resolve([{ id: 'a', name: 'A' }]);
    await first;
    assert.deepEqual(midi.getDevices().map(device => device.id), ['b']);
});

test('denied Web MIDI access is retryable explicitly without automatic retry or concurrent prompts', async () => {
    const pending = deferred();
    let requests = 0;
    const access = { inputs: new Map() };
    const midi = new MidiInputService({ storage: memoryStorage(), autoInit: false, requestAccess: () => {
        requests++;
        return requests === 1 ? pending.promise : Promise.resolve(access);
    } });
    const first = midi.init();
    assert.equal(midi.init(), first);
    pending.reject(new Error('NotAllowedError'));
    assert.equal(await first, false);
    await Promise.resolve();
    assert.equal(requests, 1);
    assert.equal(midi.initialized, false);
    assert.equal(midi.isSupported, true); // API exists; permission failed.
    assert.equal(await midi.refreshDevices(), true);
    assert.equal(requests, 2);
    assert.equal(midi.initialized, true);
    assert.equal(typeof access.onstatechange, 'function');
    await midi.init();
    await midi.refreshDevices();
    assert.equal(requests, 2);
});

test('disconnect during pending Web MIDI initialization prevents restoring the saved keyboard', async () => {
    const pending = deferred();
    const storage = memoryStorage({ 'midi-selected-device': 'a' });
    const midi = new MidiInputService({ storage, autoInit: false, requestAccess: () => pending.promise });
    const first = midi.init();
    await midi.disconnect();
    pending.resolve({ inputs: new Map([['a', { id: 'a', state: 'connected' }]]) });
    await first;
    assert.equal(midi.getActiveDevice(), null);
    assert.equal(storage.getItem('midi-selected-device'), null);
});

test('physical Web MIDI removal retains preference; voluntary disconnect clears it even while absent', async () => {
    const storage = memoryStorage();
    const midi = new MidiInputService({ storage, autoInit: false });
    const keyboard = { id: 'a', state: 'connected' };
    const other = { id: 'b', state: 'connected' };
    midi.midiAccess = { inputs: new Map([['a', keyboard], ['b', other]]) };
    midi.selectDevice('a');
    other.state = 'disconnected';
    midi.handleStateChange({ port: other });
    assert.equal(midi.getActiveDevice().id, 'a');
    keyboard.state = 'disconnected';
    midi.handleStateChange({ port: keyboard });
    assert.equal(midi.getActiveDevice(), null);
    assert.equal(keyboard.onmidimessage, null);
    assert.equal(storage.getItem('midi-selected-device'), 'a');
    keyboard.state = 'connected';
    midi.handleStateChange({ port: keyboard });
    assert.equal(midi.getActiveDevice().id, 'a');
    keyboard.state = 'disconnected';
    midi.handleStateChange({ port: keyboard });
    await midi.disconnect();
    keyboard.state = 'connected';
    midi.handleStateChange({ port: keyboard });
    assert.equal(midi.getActiveDevice(), null);
    assert.equal(storage.getItem('midi-selected-device'), null);
});

test('blocked browser storage never interrupts handlers, settings notifications or disconnection', async () => {
    const storage = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() { throw new Error('SecurityError'); },
    };
    const midi = new MidiInputService({ storage, autoInit: false });
    const keyboard = { id: 'a', state: 'connected' };
    midi.midiAccess = { inputs: new Map([['a', keyboard]]) };
    const events = [];
    for (const type of ['deviceConnected', 'settingsChanged', 'noteOn', 'deviceDisconnected']) {
        midi.addEventListener(type, () => events.push(type));
    }
    assert.equal(midi.selectDevice('a'), true);
    midi.updateSettings({ midiVolume: 0 });
    keyboard.onmidimessage({ data: [144, 60, 80], timeStamp: 1 });
    await midi.disconnect();
    assert.equal(keyboard.onmidimessage, null);
    assert.equal(midi.getActiveDevice(), null);
    assert.equal(midi.getSettings().midiVolume, 0);
    assert.deepEqual(events, ['deviceConnected', 'settingsChanged', 'noteOn', 'deviceDisconnected']);
});

test('blocked native storage does not mask a successful connection or disconnection', async () => {
    const storage = { getItem: () => null, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    const { midi, connects, backend } = nativeFixture(storage);
    const connected = [];
    midi.addEventListener('deviceConnected', device => connected.push(device.id));
    const selection = midi.selectDevice('a');
    await until(() => connects.length === 1);
    connects[0].resolve();
    assert.equal(await selection, true);
    assert.deepEqual(connected, ['a']);
    assert.equal(backend(), 'a');
    assert.equal(await midi.disconnect(), true);
    assert.equal(backend(), null);
    assert.equal(midi.getActiveDevice(), null);
});

test('malformed channel settings do not disable MIDI or discard other valid preferences', () => {
    for (const channels of ['null', '{}', '"hello"', '{broken', '[16,-1,1.5,"2"]']) {
        const midi = new MidiInputService({ autoInit: false, storage: memoryStorage({
            'midi-enabled-channels': channels, 'midi-volume': '0', 'midi-note-on-threshold': '0',
        }) });
        let attacks = 0;
        midi.addEventListener('noteOn', () => attacks++);
        midi.handleMidiMessage({ data: [144, 60, 1], timeStamp: 0 });
        assert.equal(attacks, 1);
        assert.equal(midi.getSettings().midiVolume, 0);
        assert.equal(midi.getSettings().noteOnThreshold, 0);
    }
});

test('numeric settings and channels are normalized on load and update and survive reopening', () => {
    const storage = memoryStorage({
        'midi-velocity-sensitivity': 'Infinity', 'midi-latency': '-1000',
        'midi-note-on-threshold': '300', 'midi-volume': '-8',
        'midi-enabled-channels': '[0,0,15,16,-1,1.5,"2"]',
    });
    const midi = new MidiInputService({ storage, autoInit: false });
    assert.deepEqual(midi.getSettings(), {
        selectedDeviceId: null, velocitySensitivity: 1, latencyCompensation: -100,
        noteOnThreshold: 127, midiVolume: 0, enabledChannels: [0, 15],
    });
    let notified;
    midi.addEventListener('settingsChanged', value => { notified = value; });
    midi.updateSettings({ velocitySensitivity: -2, latencyCompensation: Infinity, noteOnThreshold: NaN, midiVolume: 120, enabledChannels: null });
    assert.equal(notified.velocitySensitivity, 0.5);
    assert.equal(notified.latencyCompensation, 0);
    assert.equal(notified.noteOnThreshold, 10);
    assert.equal(notified.midiVolume, 100);
    assert.equal(notified.enabledChannels.length, 16);
    assert.deepEqual(new MidiInputService({ storage, autoInit: false }).getSettings(), midi.getSettings());
    notified.enabledChannels.length = 0;
    const snapshot = midi.getSettings();
    snapshot.enabledChannels.length = 0;
    assert.equal(midi.getSettings().enabledChannels.length, 16);
    midi.updateSettings({ enabledChannels: [] });
    assert.deepEqual(new MidiInputService({ storage, autoInit: false }).getSettings().enabledChannels, []);
});
