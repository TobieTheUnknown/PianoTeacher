import assert from 'node:assert/strict';
import test from 'node:test';
import { MidiInputService } from '../src/services/MidiInputService.js';
import { normalizedMidiTimestamp, midiRecordingBeat, finalizedMidiTiming, midiLiveTime, judgeMidiAttack } from '../src/utils/midiTiming.js';
import { observeMidiSettings } from '../src/utils/midiSettingsState.js';

const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const identity = value => value;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

function timedService() {
    let now = 1000;
    const service = new MidiInputService({ storage, autoInit: false, now: () => now });
    const events = [];
    for (const type of ['noteOn', 'noteOff', 'sustainPedal']) service.addEventListener(type, event => events.push(event));
    return { service, events, at: time => { now = time; } };
}

test('native MIDI uses monotonic receipt time regardless of epoch value or wall-clock jumps', () => {
    const f = timedService();
    f.service.updateSettings({ latencyCompensation: -50 });
    for (const [receipt, epoch] of [[1000, 1790000000000], [1100, 100], [1200, NaN]]) {
        f.at(receipt);
        f.service.handleTauriMidiMessage({ status: 144, note: 60, velocity: 80, timestamp: epoch });
        assert.equal(f.events.at(-1).timestamp, receipt - 50);
    }
});

test('Web MIDI retains delayed event timestamps and rejects values outside its time domain', () => {
    assert.equal(normalizedMidiTimestamp(980, 1000, -50), 930);
    for (const raw of [undefined, NaN, Infinity, -1, 1790000000000]) {
        assert.equal(normalizedMidiTimestamp(raw, 1000, -50), 950);
    }
    assert.equal(normalizedMidiTimestamp(20, 20, -50), 0);
});

test('compensation changes event metadata but delivers notes and releases immediately', () => {
    const f = timedService();
    for (const compensation of [-50, 0, 100]) {
        f.service.updateSettings({ latencyCompensation: compensation });
        const before = f.events.length;
        f.service.handleMidiMessage({ data: [144, 60, 80], timeStamp: 1000 });
        f.service.handleMidiMessage({ data: [128, 60, 0], timeStamp: 1000 });
        assert.equal(f.events.length, before + 2); // No timer or await before monitoring.
        assert.equal(f.events.at(-1).timestamp, 1000 + compensation);
    }
});

test('minus 50ms moves recorded attack and release together without changing duration', () => {
    const timings = [];
    for (const compensation of [0, -50]) {
        const f = timedService();
        f.service.updateSettings({ latencyCompensation: compensation });
        f.service.handleTauriMidiMessage({ status: 144, note: 60, velocity: 80, timestamp: 1790000000000 });
        f.at(1100);
        f.service.handleTauriMidiMessage({ status: 128, note: 60, velocity: 0, timestamp: 1790000000100 });
        const start = midiRecordingBeat(f.events[0].timestamp, 900, 120);
        const end = midiRecordingBeat(f.events[1].timestamp, 900, 120);
        const timing = finalizedMidiTiming(start, end, 4, identity, 0.001);
        timings.push(timing);
        close(timing.duration, 0.2);
    }
    close(timings[0].startTime, 0.2);
    close(timings[1].startTime, 0.1);
});

test('compensation near recording start clips negative time and produces a valid release', () => {
    const on = normalizedMidiTimestamp(1020, 1020, -50);
    const off = normalizedMidiTimestamp(1080, 1080, -50);
    const start = midiRecordingBeat(on, 1000, 120);
    const end = midiRecordingBeat(off, 1000, 120);
    assert.equal(start, 0);
    const timing = finalizedMidiTiming(start, end, 4, identity, 0.001);
    assert.equal(timing.startTime, 0);
    close(timing.duration, 0.06);
    // A changed compensation or reordered release must never create a negative duration.
    assert.deepEqual(finalizedMidiTiming(0.1, 0, 4, identity, 0.001), { startTime: 0.1, duration: 0.001 });
});

test('quantization cannot push a late attack outside the phrase or leave an invalid duration', () => {
    const timing = finalizedMidiTiming(3.99, 4.03, 4, value => Math.round(value / 0.25) * 0.25, 0.25);
    assert.deepEqual(timing, { startTime: 3.75, duration: 0.25 });
    assert.equal(finalizedMidiTiming(4, 5, 4, identity, 0.25), null);
    assert.equal(finalizedMidiTiming(NaN, 1, 4, identity, 0.25), null);
    assert.equal(midiRecordingBeat(20, 0, 120), 0.04); // A recording can start at performance time zero.
});

test('minus 50ms changes actual Live judgment from good to perfect', () => {
    const notes = [{ id: 'n', pitch: 60, hand: 'right', startTime: 2 }];
    const grades = [0, -50].map(compensation => {
        const time = midiLiveTime(normalizedMidiTimestamp(1100, 1100, compensation), 1100, 1.1, true);
        return judgeMidiAttack(notes, 60, time, 2, 'both', new Map()).accuracy;
    });
    assert.deepEqual(grades, ['good', 'perfect']);
});

test('Live judgment uses corrected time beyond the rendered window and respects hands and played notes', () => {
    const notes = [{ id: 'n', pitch: 60, hand: 'right', startTime: 2 }];
    const time = midiLiveTime(normalizedMidiTimestamp(1330, 1330, -50), 1330, 1.33, true);
    assert.equal(judgeMidiAttack(notes, 60, time, 2, 'both', new Map([['n', 'missed']])).note.id, 'n');
    assert.equal(judgeMidiAttack(notes, 60, time, 2, 'left', new Map()), null);
    assert.equal(judgeMidiAttack(notes, 60, time, 2, 'watch', new Map()), null);
    assert.equal(judgeMidiAttack(notes, 60, time, 2, 'both', new Map([['n', 'correct']])), null);
    assert.equal(midiLiveTime(20, 100, 0.01, true), 0);
    assert.equal(midiLiveTime(9950, 10000, 1, false), 1); // Waiting freezes score position.
});

function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}

test('open settings receive statusChanged when permission resolves, then retain live settings changes', async () => {
    const access = deferred();
    const service = new MidiInputService({ storage, autoInit: false, requestAccess: () => access.promise });
    const snapshots = [], statuses = [];
    service.addEventListener('statusChanged', status => statuses.push(status));
    const panel = observeMidiSettings(service, snapshot => snapshots.push(snapshot));
    assert.equal(snapshots.at(-1).supported, false);
    const init = service.init();
    access.resolve({ inputs: new Map([['a', { id: 'a', state: 'connected' }]]) });
    await init;
    assert.deepEqual(statuses, [{ isSupported: true, initialized: true }]);
    assert.equal(snapshots.at(-1).supported, true);
    assert.equal(snapshots.at(-1).devices.length, 1);
    service.updateSettings({ latencyCompensation: -50 });
    assert.equal(snapshots.at(-1).settings.latencyCompensation, -50);
    panel.dispose();
});

test('settings refresh waits for native enumeration and shares pending refresh work', async () => {
    const scan = deferred();
    let requests = 0;
    const service = new MidiInputService({ storage, autoInit: false, nativeInvoke: () => { requests++; return scan.promise; } });
    service.useTauriMidi = true;
    const snapshots = [];
    const panel = observeMidiSettings(service, snapshot => snapshots.push(snapshot));
    const refresh = panel.refresh();
    assert.equal(panel.refresh(), refresh);
    assert.equal(snapshots.at(-1).refreshing, true);
    await Promise.resolve();
    assert.equal(requests, 1);
    scan.resolve([{ id: 'a', name: 'A' }]);
    await refresh;
    assert.equal(snapshots.at(-1).refreshing, false);
    assert.equal(snapshots.at(-1).devices[0].id, 'a');
    panel.dispose();
});

test('settings can retry denied permission and closed panels ignore late completion', async () => {
    const first = deferred();
    const second = deferred();
    let attempts = 0;
    const service = new MidiInputService({ storage, autoInit: false, requestAccess: () => ++attempts === 1 ? first.promise : second.promise });
    const snapshots = [], statuses = [];
    service.addEventListener('statusChanged', status => statuses.push(status));
    const panel = observeMidiSettings(service, snapshot => snapshots.push(snapshot));
    const denied = panel.refresh();
    await Promise.resolve();
    first.reject(new Error('NotAllowedError'));
    await denied;
    assert.deepEqual(statuses[0], { isSupported: true, initialized: false });
    assert.equal(snapshots.at(-1).refreshing, false);
    const retry = panel.refresh();
    await Promise.resolve();
    panel.dispose();
    const count = snapshots.length;
    second.resolve({ inputs: new Map() });
    await retry;
    assert.equal(snapshots.length, count);
    assert.deepEqual(statuses[1], { isSupported: true, initialized: true });
    assert.equal(service.listeners.get('devicesChanged').size, 0);
});
