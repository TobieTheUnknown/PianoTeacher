export const MIDI_CALIBRATION_WINDOW_MS = 250;
export const MIDI_CALIBRATION_MIN_MATCHES = 5;

/** Ordered one-to-one matching: maximize valid pairs, then minimize timing error. */
export function matchCalibrationBeats(expectedTimes, tapTimes, windowMs = MIDI_CALIBRATION_WINDOW_MS) {
    if (!Number.isFinite(windowMs) || windowMs < 0) return [];
    const sorted = values => values.map((time, index) => ({ time, index }))
        .filter(item => Number.isFinite(item.time)).sort((a, b) => a.time - b.time);
    const beats = sorted(expectedTimes);
    const taps = sorted(tapTimes);
    const table = Array.from({ length: beats.length + 1 }, () => Array(taps.length + 1));
    for (let i = beats.length; i >= 0; i--) {
        for (let j = taps.length; j >= 0; j--) {
            if (i === beats.length || j === taps.length) {
                table[i][j] = { count: 0, cost: 0 };
                continue;
            }
            const options = [
                { ...table[i + 1][j], action: 'skipBeat' },
                { ...table[i][j + 1], action: 'skipTap' },
            ];
            const distance = Math.abs(taps[j].time - beats[i].time);
            if (distance <= windowMs) {
                const next = table[i + 1][j + 1];
                options.unshift({ count: next.count + 1, cost: next.cost + distance, action: 'match' });
            }
            table[i][j] = options.reduce((best, item) => item.count > best.count ||
                (item.count === best.count && item.cost < best.cost) ? item : best);
        }
    }
    const pairs = [];
    let i = 0, j = 0;
    while (i < beats.length && j < taps.length) {
        const { action } = table[i][j];
        if (action === 'match') {
            pairs.push({ beatIndex: beats[i].index, tapIndex: taps[j].index, latencyMs: taps[j].time - beats[i].time });
            i++; j++;
        } else if (action === 'skipBeat') i++;
        else j++;
    }
    return pairs;
}

export function calculateMidiCalibration(expectedTimes, tapTimes) {
    const pairs = matchCalibrationBeats(expectedTimes, tapTimes);
    const latencies = pairs.map(pair => pair.latencyMs);
    if (pairs.length < MIDI_CALIBRATION_MIN_MATCHES) {
        return { valid: false, pairs, latencies, compensation: null, medianLatency: null };
    }
    const sorted = [...latencies].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const medianLatency = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return {
        valid: true, pairs, latencies, medianLatency,
        compensation: Math.max(-100, Math.min(100, Math.round(-medianLatency))) || 0,
    };
}

/** Owns every timer and audio resource for one mounted calibration panel. */
export class MidiCalibrationSession {
    constructor({ now = () => performance.now(), schedule = setInterval, cancel = clearInterval } = {}) {
        this.now = now;
        this.schedule = schedule;
        this.cancel = cancel;
        this.active = true;
        this.running = false;
        this.calibrating = false;
        this.timers = new Set();
        this.synth = null;
        this.audioReady = Promise.resolve(false);
        this.audioPreparing = false;
        this.expectedTimes = [];
        this.tapTimes = [];
    }

    prepareAudio(factory) {
        if (!this.active) return Promise.resolve(false);
        if (this.synth) return Promise.resolve(true);
        if (this.audioPreparing) return this.audioReady;
        this.audioPreparing = true;
        this.audioReady = Promise.resolve().then(async () => {
            if (!this.active) return false;
            const synth = await factory(() => this.active);
            if (!this.active) {
                synth?.dispose();
                return false;
            }
            this.synth = synth;
            return Boolean(synth);
        }).catch(() => false).finally(() => { this.audioPreparing = false; });
        return this.audioReady;
    }

    _interval(callback, period) {
        if (!this.active) return null;
        const id = this.schedule(() => { if (this.active) callback(); }, period);
        this.timers.add(id);
        return id;
    }

    _clear(id) {
        this.cancel(id);
        this.timers.delete(id);
    }

    _click(accent) {
        if (this.active) this.synth?.triggerAttackRelease(accent ? 'C5' : 'C4', '8n');
    }

    recordTap(time = this.now()) {
        if (this.active && this.calibrating && Number.isFinite(time)) this.tapTimes.push(time);
    }

    async start({ mode, totalBeats = 8, beatInterval = 1000, onCountdown, onStart, onBeat, onFinish, onError }) {
        if (!this.active || this.running) return false;
        this.running = true;
        onCountdown(3);
        if (mode === 'audio') {
            const ready = await this.audioReady;
            if (!this.active) return false;
            if (!ready) {
                this.running = false;
                onError();
                return false;
            }
        }
        if (!this.active) return false;
        let countdown = 3;
        const countdownTimer = this._interval(() => {
            countdown--;
            if (countdown > 0) {
                onCountdown(countdown);
                this._click(true);
                return;
            }
            this._clear(countdownTimer);
            const startTime = this.now();
            this.expectedTimes = Array.from({ length: totalBeats }, (_, index) => startTime + (index + 1) * beatInterval);
            this.tapTimes = [];
            this.calibrating = true;
            onStart(startTime);
            let beat = 0;
            const beatTimer = this._interval(() => {
                beat++;
                if (beat <= totalBeats) {
                    onBeat(beat);
                    if (mode === 'audio') this._click(beat === 1 || beat % 4 === 1);
                } else {
                    this._clear(beatTimer);
                    this.calibrating = false;
                    this.running = false;
                    onFinish(calculateMidiCalibration(this.expectedTimes, this.tapTimes));
                }
            }, beatInterval);
        }, beatInterval);
        return true;
    }

    dispose() {
        this.active = false;
        this.running = false;
        this.calibrating = false;
        this.timers.forEach(id => this.cancel(id));
        this.timers.clear();
        this.synth?.dispose();
        this.synth = null;
    }
}
