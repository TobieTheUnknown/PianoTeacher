import { getNoteNameFromMidi } from '../models/song.js';

// Lazy-loaded Tone.js module — avoids AudioContext creation on import (crashes Android WebView)
let Tone = null;

// localStorage key holding the calibrated audio/visual offset in milliseconds.
// Positive = sound is heard later than the visuals are drawn (macOS/WKWebView).
export const AV_OFFSET_STORAGE_KEY = 'piano-teacher-av-offset-ms';

async function loadTone() {
    if (!Tone) {
        Tone = await import('tone');
    }
    return Tone;
}

export class AudioEngine {
    constructor(toneLoader = loadTone) {
        this._loadTone = toneLoader;
        this._tone = null;
        this.sampler = null;
        this.samplerLoaded = false;
        this.isPlaying = false;
        this.metronomeEnabled = false;
        this.masterVolume = null;
        // Restore volume (dB). Guard against a persisted '-Infinity' (saved
        // when the slider was once dragged to 0%): restoring it would leave
        // the app PERMANENTLY silent across restarts. Non-finite or
        // out-of-range values fall back to 0 dB (full volume).
        let storedVolume = 0;
        try { storedVolume = parseFloat(localStorage.getItem('piano-teacher-volume') ?? '0'); }
        catch { /* Audio remains usable when browser storage is disabled. */ }
        this._volume = (Number.isFinite(storedVolume) && storedVolume >= -60 && storedVolume <= 0)
            ? storedVolume
            : 0;
        this._readyCallbacks = [];
        this._avOffsetSec = null; // cached A/V offset (seconds); null = needs recompute
    }

    /**
     * Auto-estimate of the audio output latency from the AudioContext, in
     * seconds: how long after its scheduled audio-clock time a sample is
     * actually heard. Used as the fallback when the user hasn't run the
     * A/V calibration wizard. Returns 0 when the context isn't available
     * (e.g. before init or on platforms that don't expose the values).
     */
    getAutoAvOffsetSeconds() {
        try {
            const ctx = this._tone && this._tone.context ? this._tone.context.rawContext || this._tone.context : null;
            if (!ctx) return 0;
            const base = typeof ctx.baseLatency === 'number' ? ctx.baseLatency : 0;
            const output = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : 0;
            const total = base + output;
            return Number.isFinite(total) && total > 0 ? total : 0;
        } catch {
            return 0;
        }
    }

    /**
     * A/V offset to subtract from the raw audio-clock time to get the time
     * the user actually HEARS the sound, in seconds. Reads the calibrated
     * value from localStorage when present, otherwise falls back to the
     * auto estimate (baseLatency+outputLatency). Clamped to [0, 0.5] for
     * safety. Cached; call setAvOffsetMs (or clearAvOffsetCache) to refresh.
     */
    getAvOffsetSeconds() {
        if (this._avOffsetSec !== null) return this._avOffsetSec;
        let sec;
        const raw = localStorage.getItem(AV_OFFSET_STORAGE_KEY);
        const parsed = raw === null ? NaN : parseFloat(raw);
        if (Number.isFinite(parsed)) {
            sec = parsed / 1000;
        } else {
            sec = this.getAutoAvOffsetSeconds();
        }
        sec = Math.max(0, Math.min(0.5, sec));
        this._avOffsetSec = sec;
        return sec;
    }

    /**
     * Persist a calibrated A/V offset (milliseconds) and invalidate the
     * cache. Passing null/undefined clears the stored value, reverting to
     * the auto estimate. Called by the calibration wizard.
     */
    setAvOffsetMs(ms) {
        if (ms === null || ms === undefined || !Number.isFinite(ms)) {
            localStorage.removeItem(AV_OFFSET_STORAGE_KEY);
        } else {
            localStorage.setItem(AV_OFFSET_STORAGE_KEY, String(Math.round(ms)));
        }
        this._avOffsetSec = null; // force recompute on next read
    }

    /** Invalidate the cached A/V offset (e.g. after an external write). */
    clearAvOffsetCache() {
        this._avOffsetSec = null;
    }

    getIsActuallyPlaying() {
        return this.isPlaying;
    }

    // Expose the Tone module for consumers that need it (e.g. usePlaybackPosition)
    getTone() {
        return this._tone;
    }

    /**
     * Stable clock function for a play session. Returns the audio-context
     * clock (this._tone.now()) when available so visuals and scheduled audio share
     * the same time base; falls back to performance.now() before init.
     * Callers must capture ONE clock per play session — never mix sources.
     */
    getClock() {
        if (this._tone) {
            const T = this._tone;
            return () => T.now();
        }
        return () => performance.now() / 1000;
    }

    /**
     * Subscribe to "samples loaded" — fires once. Used by the loading indicator
     * and by useMidiAudio to flush queued MIDI events.
     */
    onReady(callback) {
        if (this.samplerLoaded) {
            try { callback(); } catch { /* listener errors must not break audio */ }
        } else {
            this._readyCallbacks.push(callback);
        }
        return () => { this._readyCallbacks = this._readyCallbacks.filter(cb => cb !== callback); };
    }

    /**
     * Phase 1: download samples + construct graph. No user gesture required —
     * the AudioContext stays suspended; we just create nodes and fetch MP3s.
     * Call this at app mount so samples are warm before the first key press.
     */
    async preload() {
        if (this._preloadPromise) return this._preloadPromise;
        this._preloadPromise = this._doPreload().catch(error => {
            this.samplerLoaded = false;
            this.sampler?.dispose();
            this.metronomeSynth?.dispose();
            this.masterVolume?.dispose();
            this.sampler = null;
            this.metronomeSynth = null;
            this.masterVolume = null;
            this._preloadPromise = null;
            throw error;
        });
        return this._preloadPromise;
    }

    async _doPreload() {
        if (this.samplerLoaded) return;

        const T = this._tone || await this._loadTone();
        this._tone = T;

        // lookAhead trades latency for scheduling stability. The previous 0.2s on
        // mobile (200ms) made live MIDI feel unplayable. 0.05s is the same as
        // desktop — Tone.js' default — and matches Web Audio's ~50ms intrinsic
        // latency, so total observed latency for triggerAttack(this._tone.now()) stays
        // under ~100ms on a phone. If we hit buffer underruns on low-end Android
        // WebViews, bump back up only on those specifically.
        if (T.context) {
            T.context.lookAhead = 0.05;
        }

        // Master volume node — everything routes through this
        this.masterVolume = new T.Volume(this._volume).toDestination();

        this.metronomeSynth = new T.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            envelope: {
                attack: 0.0006,
                decay: 0.1,
                sustain: 0
            }
        }).connect(this.masterVolume);

        await new Promise((resolve, reject) => {
            this.sampler = new T.Sampler({
                urls: {
                    "A0": "A0.mp3",
                    "C1": "C1.mp3",
                    "D#1": "Ds1.mp3",
                    "F#1": "Fs1.mp3",
                    "A1": "A1.mp3",
                    "C2": "C2.mp3",
                    "D#2": "Ds2.mp3",
                    "F#2": "Fs2.mp3",
                    "A2": "A2.mp3",
                    "C3": "C3.mp3",
                    "D#3": "Ds3.mp3",
                    "F#3": "Fs3.mp3",
                    "A3": "A3.mp3",
                    "C4": "C4.mp3",
                    "D#4": "Ds4.mp3",
                    "F#4": "Fs4.mp3",
                    "A4": "A4.mp3",
                    "C5": "C5.mp3",
                    "D#5": "Ds5.mp3",
                    "F#5": "Fs5.mp3",
                    "A5": "A5.mp3",
                    "C6": "C6.mp3",
                    "D#6": "Ds6.mp3",
                    "F#6": "Fs6.mp3",
                    "A6": "A6.mp3",
                    "C7": "C7.mp3",
                    "D#7": "Ds7.mp3",
                    "F#7": "Fs7.mp3",
                    "A7": "A7.mp3",
                    "C8": "C8.mp3"
                },
                onerror: reject,
                release: 1,
                baseUrl: (import.meta.env?.BASE_URL || '/') + "audio/salamander/",
                onload: () => {
                    console.log("[AudioEngine] Sampler loaded");
                    this.samplerLoaded = true;
                    const cbs = this._readyCallbacks.slice();
                    this._readyCallbacks = [];
                    for (const cb of cbs) {
                        try { cb(); } catch { /* listener errors must not break audio */ }
                    }
                    resolve();
                }
            }).connect(this.masterVolume);
        });
    }

    /**
     * Phase 2: resume the AudioContext. Browsers require this to be triggered
     * by a user gesture (click/touch/keydown). Idempotent — safe to call often.
     */
    async start() {
        const T = this._tone || await this._loadTone();
        this._tone = T;
        // Resume while handling the gesture, before waiting for sample downloads.
        const resumed = T.context?.state !== 'running' ? T.start() : Promise.resolve();
        await Promise.all([resumed, this.preload()]);
    }

    async initialize() {
        return this.start();
    }

    playNote(pitch, duration = '8n', time) {
        if (!this.sampler || !this._tone || !this.samplerLoaded) return;
        const note = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;
        this.sampler.triggerAttackRelease(note, duration, time);
    }

    playPhrase(phrase, tempo = 120, startPositionBeats = null, stopAtEnd = false, onPlaybackEnd = null, beatsPerMeasure = 4, options = {}) {
        if (!this._tone || !this.samplerLoaded || !this.sampler) return;
        this.onPlaybackEnd = onPlaybackEnd;

        // Ensure context is running (mobile browsers suspend it)
        if (this._tone.context.state !== 'running') {
            this._tone.context.resume();
        }

        // Remember whether the running metronome loop was alive so we can
        // recreate it after this._tone.Transport.cancel() wipes everything.
        const hadRunningMetronome = !!(this.metronomeEnabled && this.metronomeLoop);
        const prevMetronomeSubdivision = this._metronomeSubdivision || 'quarter';

        this._tone.Transport.stop();
        if (this._currentPart) {
            this._currentPart.dispose();
            this._currentPart = null;
        }
        if (this.metronomeLoop) {
            this.metronomeLoop.stop();
            this.metronomeLoop.dispose();
            this.metronomeLoop = null;
        }
        this._tone.Transport.cancel();
        if (this.sampler) {
            this.sampler.releaseAll();
        }

        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }

        this._tone.Transport.bpm.value = tempo;

        // Preroll is now explicit. Caller passes options.preroll=true to
        // get one bar of metronome click before the music. We no longer
        // read this.metronomeEnabled (was racy when callers toggled the
        // metronome after this call).
        const wantsPreroll = options.preroll === true;
        const prerollBeats = wantsPreroll ? beatsPerMeasure : 0;
        const prerollSec = (prerollBeats * 60) / tempo;
        this._prerollSec = prerollSec;

        const allNotes = [
            ...phrase.tracks.melody.map(n => ({ ...n, track: 'melody' })),
            ...phrase.tracks.chords.map(n => ({ ...n, track: 'chords' }))
        ];

        const quarterDuration = this._tone.Time('4n').toSeconds();

        this._currentPart = new this._tone.Part((time, note) => {
            const pitch = typeof note.pitch === 'number' ? getNoteNameFromMidi(note.pitch) : note.pitch;
            this.sampler.triggerAttackRelease(pitch, note.duration * quarterDuration, time);
        }, allNotes.map(n => ({
            // Schedule notes after the preroll
            time: n.startTime * quarterDuration + prerollSec,
            pitch: n.pitch,
            duration: n.duration
        })));

        // Set transport position FIRST (before starting Part). With preroll,
        // we want Transport.seconds = 0 at the start of the preroll and
        // = prerollSec at the start of the music. So the requested start
        // becomes startPositionBeats AFTER the preroll.
        let startSeconds = 0;
        if (startPositionBeats !== null && startPositionBeats > 0) {
            startSeconds = (startPositionBeats * 60) / tempo;
        }
        // Always start at 0 (= beginning of preroll if any). The startSeconds
        // shift is folded into the Part schedule (subtract the start offset).
        if (startSeconds > 0) {
            this._currentPart.clear();
            allNotes.forEach((n) => {
                const noteSec = n.startTime * quarterDuration + prerollSec;
                if (n.startTime * quarterDuration >= startSeconds) {
                    this._currentPart.add(noteSec - startSeconds, {
                        pitch: n.pitch,
                        duration: n.duration,
                    });
                }
            });
        }
        this._tone.Transport.seconds = 0;

        // THEN start Part and Transport
        this._currentPart.start(0);

        // Schedule the preroll metronome clicks (if any). One beat per
        // click; the first one is accented.
        if (wantsPreroll && this.metronomeSynth) {
            const secondsPerBeat = 60 / tempo;
            for (let i = 0; i < prerollBeats; i++) {
                this._tone.Transport.scheduleOnce((time) => {
                    this.playClick(time, i === 0);
                }, i * secondsPerBeat);
            }
        }

        // Re-create the running metronome loop that Transport.cancel() wiped
        // out. Start it after the preroll so we don't double up clicks
        // during the count-in bar.
        if (hadRunningMetronome) {
            const subMap = { half: '2n', quarter: '4n', eighth: '8n' };
            const sub = subMap[prevMetronomeSubdivision] || '4n';
            this.metronomeLoop = new this._tone.Loop((time) => {
                this.playClick(time);
            }, sub);
            this.metronomeLoop.start(prerollSec);
        }

        this._tone.Transport.start();
        this.isPlaying = true;

        if (stopAtEnd) {
            const phraseLengthBeats = phrase.length * beatsPerMeasure;
            const phraseDurationSeconds = (phraseLengthBeats * 60) / tempo;
            const remainingSeconds = phraseDurationSeconds - startSeconds + prerollSec;

            if (remainingSeconds > 0) {
                this.stopTimeout = setTimeout(() => {
                    this.stop({ notify: true });
                }, remainingSeconds * 1000);
            }
        }
    }

    playNotes(notes, tempo = 120) {
        this.stop();
        if (!this._tone || !this.samplerLoaded || !this.sampler) return;
        if (this._tone.context.state !== 'running') this._tone.context.resume();
        this._tone.Transport.seconds = 0;
        if (notes.length === 0) return;

        this._tone.Transport.bpm.value = tempo;

        const minTime = Math.min(...notes.map(n => n.startTime));
        const quarterDuration = this._tone.Time('4n').toSeconds();

        this._currentPart = new this._tone.Part((time, note) => {
            const pitch = typeof note.pitch === 'number' ? getNoteNameFromMidi(note.pitch) : note.pitch;
            this.sampler.triggerAttackRelease(pitch, note.duration * quarterDuration, time);
        }, notes.map(n => ({
            time: (n.startTime - minTime) * quarterDuration,
            pitch: n.pitch,
            duration: n.duration
        })));

        this._currentPart.start(0);

        if (this.metronomeEnabled && this.metronomeLoop) {
            this.metronomeLoop.start(0);
        }

        this._tone.Transport.start();
        this.isPlaying = true;
        const endBeats = Math.max(...notes.map(n => n.startTime - minTime + n.duration));
        this.stopTimeout = setTimeout(() => this.stop(), endBeats * quarterDuration * 1000);
    }

    playClick(time, isAccent = false) {
        if (!this.metronomeSynth) return;
        const pitch = isAccent ? "C6" : "C5";
        const duration = "32n";
        this.metronomeSynth.triggerAttackRelease(pitch, duration, time, isAccent ? 1.0 : 0.6);
    }

    /**
     * Schedule a metronome count-in (preroll). N evenly-spaced clicks
     * play starting immediately. Returns the total preroll duration in
     * seconds so the caller can delay its main playback by the same
     * amount.
     */
    playPrerollClicks(beats = 4, tempo = 120) {
        if (!this._tone || !this.metronomeSynth) return 0;
        if (this._tone.context.state !== 'running') {
            this._tone.context.resume();
        }
        const secondsPerBeat = 60 / Math.max(20, tempo);
        const now = this._tone.now();
        for (let i = 0; i < beats; i++) {
            this.playClick(now + i * secondsPerBeat, i === 0);
        }
        return beats * secondsPerBeat;
    }

    startMetronome(tempo = 120, subdivision = 'quarter') {
        if (!this._tone) return;
        this.stopMetronome();

        this.metronomeEnabled = true;
        this._metronomeSubdivision = subdivision;
        this._tone.Transport.bpm.value = tempo;

        const subdivisionMap = {
            'half': '2n',
            'quarter': '4n',
            'eighth': '8n'
        };
        const toneSubdivision = subdivisionMap[subdivision] || '4n';

        this.metronomeLoop = new this._tone.Loop((time) => {
            this.playClick(time);
        }, toneSubdivision).start(0);

        if (this._tone.Transport.state !== 'started') {
            this._tone.Transport.start();
        }
    }

    stopMetronome() {
        this.metronomeEnabled = false;
        if (this.metronomeLoop) {
            this.metronomeLoop.stop();
            this.metronomeLoop.dispose();
            this.metronomeLoop = null;
        }
    }

    setTempo(bpm) {
        if (!this._tone) return;
        this._tone.Transport.bpm.value = bpm;
    }

    getTransportSeconds() {
        if (!this._tone) return 0;
        return this._tone.Transport.seconds;
    }

    // Music position in seconds, accounting for the metronome preroll.
    // Returns a negative number during preroll (countdown).
    getMusicSeconds() {
        if (!this._tone) return 0;
        return this._tone.Transport.seconds - (this._prerollSec || 0);
    }

    getPrerollSeconds() {
        return this._prerollSec || 0;
    }

    stop({ notify = false } = {}) {
        const onEnd = this.onPlaybackEnd;
        this.onPlaybackEnd = null;
        this._tone?.Transport.stop();
        this._currentPart?.dispose();
        this._currentPart = null;
        this._tone?.Transport.cancel();
        this.isPlaying = false;
        if (this.stopTimeout) clearTimeout(this.stopTimeout);
        this.stopTimeout = null;
        this.stopMetronome();
        this.sampler?.releaseAll();
        // A loop may restart in this callback: finish ALL old-session cleanup first.
        if (notify) onEnd?.();
    }

    stopAll() {
        this.stop();
    }

    /** Volume in dB (-60 to 0). Persisted to localStorage. */
    getVolume() {
        return this._volume;
    }

    setVolume(dB) {
        if (!Number.isFinite(dB)) return;
        this._volume = Math.max(-60, Math.min(0, dB));
        if (this.masterVolume) {
            this.masterVolume.volume.value = this._volume;
        }
        try { localStorage.setItem('piano-teacher-volume', String(this._volume)); }
        catch { /* Keep the current session volume even if storage is unavailable. */ }
    }

    /** Volume as 0-100 percentage (convenience) */
    getVolumePercent() {
        // -60dB → 0%, 0dB → 100%
        return Math.round(Math.max(0, Math.min(100, ((this._volume + 60) / 60) * 100)));
    }

    setVolumePercent(pct) {
        // 0% → -60dB, 100% → 0dB
        const dB = (Math.max(0, Math.min(100, pct)) / 100) * 60 - 60;
        this.setVolume(dB);
    }
}

export const audioEngine = new AudioEngine();
