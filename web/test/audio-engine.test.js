import { setImmediate } from 'node:timers';
import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { AudioEngine } = await import('../src/services/AudioEngine.js');

function fixture() {
    const log = [];
    let samplerOptions;
    class Node {
        volume = { value: 0 };
        connect() { return this; }
        toDestination() { return this; }
        dispose() { log.push('dispose'); }
        releaseAll() { log.push('release'); }
    }
    const tone = {
        context: { state: 'suspended' },
        start: async () => { log.push('resume'); tone.context.state = 'running'; },
        Volume: Node, MembraneSynth: Node,
        Sampler: class extends Node { constructor(options) { super(); samplerOptions = options; log.push('samples'); } },
        Transport: { stop() { log.push('stop'); }, cancel() { log.push('cancel'); } },
    };
    return { engine: new AudioEngine(async () => tone), tone, log, options: () => samplerOptions };
}

test('first gesture resumes before samples finish and initialize resumes again after suspension', async () => {
    const { engine, tone, log, options } = fixture();
    const started = engine.initialize();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(log, ['resume', 'samples']);
    options().onload();
    await started;
    tone.context.state = 'suspended';
    await engine.initialize();
    assert.equal(log.filter(x => x === 'resume').length, 2);
});

test('failed samples reject and permit a fresh preload', async () => {
    const { engine, options } = fixture();
    const failed = engine.preload();
    await new Promise(resolve => setImmediate(resolve));
    options().onerror(new Error('missing MP3'));
    await assert.rejects(failed, /missing MP3/);
    assert.equal(engine.sampler, null);
    const retried = engine.preload();
    await new Promise(resolve => setImmediate(resolve));
    options().onload();
    await retried;
    assert.equal(engine.samplerLoaded, true);
});

test('manual stop never restarts a loop; natural completion cleans before callback', async () => {
    const { engine, options, log } = fixture();
    const ready = engine.preload();
    await new Promise(resolve => setImmediate(resolve));
    options().onload(); await ready;
    let completed = 0;
    engine.onPlaybackEnd = () => completed++;
    engine.stop();
    assert.equal(completed, 0);
    engine.onPlaybackEnd = () => log.push('restart');
    engine.stop({ notify: true });
    assert.equal(log.at(-1), 'restart');
});

test('mute persists as finite minimum gain', () => {
    const { engine } = fixture();
    engine.setVolumePercent(0);
    assert.equal(engine.getVolume(), -60);
    assert.equal(engine.getVolumePercent(), 0);
});
