import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMidiCalibration, matchCalibrationBeats, MidiCalibrationSession } from '../src/utils/midiCalibration.js';

const beats = Array.from({ length: 8 }, (_, index) => (index + 1) * 1000);

test('missing first or central beat never shifts subsequent calibration pairs', () => {
    for (const missing of [0, 3]) {
        const taps = beats.filter((_, index) => index !== missing).map(time => time + 35);
        const result = calculateMidiCalibration(beats, taps);
        assert.equal(result.valid, true);
        assert.equal(result.compensation, -35);
        assert.deepEqual(result.pairs.map(pair => pair.beatIndex), beats.map((_, index) => index).filter(index => index !== missing));
        assert.deepEqual(result.latencies, Array(7).fill(35));
    }
});

test('duplicate and stray taps use each beat and tap at most once and choose nearest match', () => {
    const taps = [100, ...beats.flatMap(time => [time + 30, time + 55]), 9900];
    const result = calculateMidiCalibration(beats, taps);
    assert.equal(result.compensation, -30);
    assert.equal(result.pairs.length, 8);
    assert.equal(new Set(result.pairs.map(pair => pair.beatIndex)).size, 8);
    assert.equal(new Set(result.pairs.map(pair => pair.tapIndex)).size, 8);
    assert.deepEqual(result.latencies, Array(8).fill(30));
});

test('matching respects the explicit window and maximizes pairs when windows overlap', () => {
    assert.deepEqual(matchCalibrationBeats([1000, 2000], [749, 2251]), []);
    assert.deepEqual(matchCalibrationBeats([1000, 2000], [750, 2250]).map(pair => pair.latencyMs), [-250, 250]);
    // Greedily taking the closest tap (10) for beat 0 would lose beat 100.
    assert.deepEqual(matchCalibrationBeats([0, 100], [-100, 10], 100).map(pair => pair.latencyMs), [-100, -90]);
});

test('fewer than five matched beats never yield an applicable compensation', () => {
    for (const taps of [[], [1020], beats.slice(0, 4).map(time => time + 20), beats.map(time => time + 400)]) {
        const result = calculateMidiCalibration(beats, taps);
        assert.equal(result.valid, false);
        assert.equal(result.compensation, null);
    }
    assert.equal(calculateMidiCalibration(beats, beats.slice(0, 5)).valid, true);
});

test('median resists a single outlier and compensation always stays in the settings range', () => {
    const taps = beats.map((time, index) => time + (index === 7 ? 220 : 20));
    assert.equal(calculateMidiCalibration(beats, taps).compensation, -20);
    for (const [latency, compensation] of [[200, -100], [-200, 100], [0, 0]]) {
        assert.equal(calculateMidiCalibration(beats, beats.map(time => time + latency)).compensation, compensation);
    }
});

test('pairing ignores non-finite timestamps without mutating supplied arrays', () => {
    const expected = [3000, NaN, 1000, 2000];
    const taps = [2020, Infinity, 3020, 1020];
    const originalExpected = [...expected], originalTaps = [...taps];
    assert.deepEqual(matchCalibrationBeats(expected, taps).map(pair => [pair.beatIndex, pair.tapIndex]), [[2, 3], [3, 0], [0, 2]]);
    assert.deepEqual(expected, originalExpected);
    assert.deepEqual(taps, originalTaps);
});

function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}

function fixture() {
    let now = 0, nextId = 0;
    const timers = new Map();
    const log = [];
    const synth = {
        triggerAttackRelease: () => log.push('sound'),
        dispose: () => log.push('dispose'),
    };
    const session = new MidiCalibrationSession({
        now: () => now,
        schedule: (callback, period) => {
            const id = ++nextId;
            timers.set(id, { callback, period, at: now + period });
            return id;
        },
        cancel: id => timers.delete(id),
    });
    const advanceTo = target => {
        while (true) {
            const next = [...timers.values()].filter(timer => timer.at <= target).sort((a, b) => a.at - b.at)[0];
            if (!next) break;
            now = next.at;
            next.at += next.period;
            next.callback();
        }
        now = target;
    };
    const callbacks = {
        mode: 'visual',
        onCountdown: count => log.push(['countdown', count]),
        onStart: start => log.push(['start', start]),
        onBeat: beat => log.push(['beat', beat]),
        onFinish: result => log.push(['finish', result]),
        onError: () => log.push('error'),
    };
    return { session, synth, timers, log, callbacks, advanceTo };
}

test('disposing during countdown cancels it and rejects even an already-queued callback', async () => {
    const f = fixture();
    await f.session.prepareAudio(() => f.synth);
    await f.session.start(f.callbacks);
    const queuedCallback = [...f.timers.values()][0].callback;
    f.advanceTo(2999);
    f.session.dispose();
    const finalLog = [...f.log];
    queuedCallback();
    f.advanceTo(20000);
    assert.deepEqual(f.log, finalLog);
    assert.equal(f.timers.size, 0);
    assert.equal(f.log.filter(item => item === 'dispose').length, 1);
    assert.equal(f.log.some(item => Array.isArray(item) && item[0] === 'start'), false);
});

test('disposing while calibrating releases audio and prevents subsequent results or callbacks', async () => {
    const f = fixture();
    await f.session.prepareAudio(() => f.synth);
    await f.session.start({ ...f.callbacks, mode: 'audio' });
    f.advanceTo(6000);
    f.session.recordTap();
    f.session.dispose();
    const finalLog = [...f.log];
    f.advanceTo(20000);
    f.session.recordTap();
    assert.deepEqual(f.log, finalLog);
    assert.equal(f.timers.size, 0);
    assert.equal(f.log.some(item => Array.isArray(item) && item[0] === 'finish'), false);
});

test('late audio initialization disposes returned synth and cannot start a disposed countdown', async () => {
    const f = fixture();
    const ready = deferred();
    f.session.prepareAudio(() => ready.promise);
    await Promise.resolve(); // The asynchronous factory is now in flight.
    const started = f.session.start({ ...f.callbacks, mode: 'audio' });
    f.session.dispose();
    const callbacksBefore = f.log.length;
    ready.resolve(f.synth);
    assert.equal(await started, false);
    assert.equal(await f.session.audioReady, false);
    assert.deepEqual(f.log.slice(callbacksBefore), ['dispose']);
    assert.equal(f.timers.size, 0);
    f.advanceTo(20000);
    assert.equal(f.timers.size, 0);
});

test('late initialization rejection never notifies a disposed panel', async () => {
    const f = fixture();
    const ready = deferred();
    f.session.prepareAudio(() => ready.promise);
    await Promise.resolve();
    const started = f.session.start({ ...f.callbacks, mode: 'audio' });
    f.session.dispose();
    const finalLog = [...f.log];
    ready.reject(new Error('samples unavailable'));
    assert.equal(await started, false);
    assert.deepEqual(f.log, finalLog);
});

test('audio initialization is shared, retryable after failure and resources dispose only once', async () => {
    const f = fixture();
    let requests = 0;
    const initialize = () => { requests++; throw new Error('offline'); };
    const first = f.session.prepareAudio(initialize);
    assert.equal(f.session.prepareAudio(initialize), first);
    assert.equal(await first, false);
    assert.equal(requests, 1);
    assert.equal(await f.session.start({ ...f.callbacks, mode: 'audio' }), false);
    assert.equal(f.timers.size, 0);
    await f.session.prepareAudio(() => f.synth);
    assert.equal(await f.session.start({ ...f.callbacks, mode: 'audio' }), true);
    assert.equal(await f.session.start(f.callbacks), false);
    f.session.dispose();
    f.session.dispose();
    assert.equal(f.log.filter(item => item === 'dispose').length, 1);
});

test('complete session accepts missed beats and duplicates and emits one bounded result', async () => {
    const f = fixture();
    await f.session.start(f.callbacks);
    f.session.recordTap(); // Countdown taps cannot enter the measurement.
    for (let beat = 1; beat <= 8; beat++) {
        f.advanceTo(3000 + beat * 1000 + 20);
        if (beat === 1 || beat === 4) continue;
        f.session.recordTap();
        f.session.recordTap(f.session.now() + 15);
    }
    f.advanceTo(12000);
    const results = f.log.filter(item => Array.isArray(item) && item[0] === 'finish');
    assert.equal(results.length, 1);
    assert.equal(results[0][1].compensation, -20);
    assert.equal(results[0][1].latencies.length, 6);
    assert.equal(f.timers.size, 0);
});

test('session with too few measurements produces no applicable compensation', async () => {
    const f = fixture();
    const applied = [];
    await f.session.start({ ...f.callbacks, onFinish: result => {
        if (result.valid) applied.push(result.compensation);
    } });
    for (let beat = 1; beat <= 3; beat++) {
        f.advanceTo(3000 + beat * 1000);
        f.session.recordTap();
    }
    f.advanceTo(12000);
    assert.deepEqual(applied, []);
    assert.equal(f.timers.size, 0);
});
