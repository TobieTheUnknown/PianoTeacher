import { getNoteNameFromMidi } from '../models/song';

// Lazy-loaded Tone.js module — avoids AudioContext creation on import (crashes Android WebView)
let Tone = null;

async function loadTone() {
    if (!Tone) {
        Tone = await import('tone');
    }
    return Tone;
}

class AudioEngine {
    constructor() {
        this.sampler = null;
        this.samplerLoaded = false;
        this.isPlaying = false;
        this.metronomeEnabled = false;
        this.masterVolume = null;
        this._volume = parseFloat(localStorage.getItem('piano-teacher-volume') ?? '0'); // dB
        this._readyCallbacks = [];
    }

    getIsActuallyPlaying() {
        return this.isPlaying;
    }

    // Expose Tone module for consumers that need it (e.g. usePlaybackPosition)
    getTone() {
        return Tone;
    }

    /**
     * Subscribe to "samples loaded" — fires once. Used by the loading indicator
     * and by useMidiAudio to flush queued MIDI events.
     */
    onReady(callback) {
        if (this.samplerLoaded) {
            try { callback(); } catch (_) {}
        } else {
            this._readyCallbacks.push(callback);
        }
    }

    /**
     * Phase 1: download samples + construct graph. No user gesture required —
     * the AudioContext stays suspended; we just create nodes and fetch MP3s.
     * Call this at app mount so samples are warm before the first key press.
     */
    async preload() {
        if (this._preloadPromise) return this._preloadPromise;
        this._preloadPromise = this._doPreload();
        return this._preloadPromise;
    }

    async _doPreload() {
        if (this.samplerLoaded) return;

        const T = await loadTone();

        // lookAhead trades latency for scheduling stability. The previous 0.2s on
        // mobile (200ms) made live MIDI feel unplayable. 0.05s is the same as
        // desktop — Tone.js' default — and matches Web Audio's ~50ms intrinsic
        // latency, so total observed latency for triggerAttack(Tone.now()) stays
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

        await new Promise((resolve) => {
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
                release: 1,
                baseUrl: "/audio/salamander/",
                onload: () => {
                    console.log("[AudioEngine] Sampler loaded");
                    this.samplerLoaded = true;
                    const cbs = this._readyCallbacks.slice();
                    this._readyCallbacks = [];
                    for (const cb of cbs) {
                        try { cb(); } catch (_) {}
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
        await this.preload();
        const T = await loadTone();
        if (T.context && T.context.state !== 'running') {
            await T.start();
        }
    }

    /** Backward-compatible alias for older call sites. */
    async initialize() {
        if (this._initPromise) return this._initPromise;
        this._initPromise = this.start();
        return this._initPromise;
    }

    playNote(pitch, duration = '8n', time) {
        if (!this.sampler || !Tone || !this.samplerLoaded) return;
        const note = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;
        this.sampler.triggerAttackRelease(note, duration, time);
    }

    playPhrase(phrase, tempo = 120, startPositionBeats = null, stopAtEnd = false, onPlaybackEnd = null, beatsPerMeasure = 4) {
        if (!Tone) return;
        this.onPlaybackEnd = onPlaybackEnd;

        // Ensure context is running (mobile browsers suspend it)
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }

        Tone.Transport.stop();
        if (this._currentPart) {
            this._currentPart.dispose();
            this._currentPart = null;
        }
        Tone.Transport.cancel();
        if (this.sampler) {
            this.sampler.releaseAll();
        }

        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }

        Tone.Transport.bpm.value = tempo;

        const allNotes = [
            ...phrase.tracks.melody.map(n => ({ ...n, track: 'melody' })),
            ...phrase.tracks.chords.map(n => ({ ...n, track: 'chords' }))
        ];

        const quarterDuration = Tone.Time('4n').toSeconds();

        this._currentPart = new Tone.Part((time, note) => {
            const pitch = typeof note.pitch === 'number' ? getNoteNameFromMidi(note.pitch) : note.pitch;
            this.sampler.triggerAttackRelease(pitch, note.duration * quarterDuration, time);
        }, allNotes.map(n => ({
            time: n.startTime * quarterDuration,
            pitch: n.pitch,
            duration: n.duration
        })));

        // Set transport position FIRST (before starting Part)
        let startSeconds = 0;
        if (startPositionBeats !== null && startPositionBeats > 0) {
            startSeconds = (startPositionBeats * 60) / tempo;
            Tone.Transport.seconds = startSeconds;
        }

        // THEN start Part and Transport
        this._currentPart.start(0);

        if (this.metronomeEnabled && this.metronomeLoop) {
            this.metronomeLoop.start(0);
        }

        Tone.Transport.start();
        this.isPlaying = true;

        if (stopAtEnd) {
            const phraseLengthBeats = phrase.length * beatsPerMeasure;
            const phraseDurationSeconds = (phraseLengthBeats * 60) / tempo;
            const remainingSeconds = phraseDurationSeconds - startSeconds;

            if (remainingSeconds > 0) {
                this.stopTimeout = setTimeout(() => {
                    this.stop();
                    this.stopTimeout = null;
                }, remainingSeconds * 1000);
            }
        }
    }

    playNotes(notes, tempo = 120) {
        if (!Tone) return;

        // Ensure context is running (mobile browsers suspend it)
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }

        Tone.Transport.stop();
        if (this._currentPart) {
            this._currentPart.dispose();
            this._currentPart = null;
        }
        Tone.Transport.cancel();
        if (this.sampler) {
            this.sampler.releaseAll();
        }

        if (notes.length === 0) return;

        Tone.Transport.bpm.value = tempo;

        const minTime = Math.min(...notes.map(n => n.startTime));
        const quarterDuration = Tone.Time('4n').toSeconds();

        this._currentPart = new Tone.Part((time, note) => {
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

        Tone.Transport.start();
        this.isPlaying = true;
    }

    playClick(time, isAccent = false) {
        if (!this.metronomeSynth) return;
        const pitch = isAccent ? "C6" : "C5";
        const duration = "32n";
        this.metronomeSynth.triggerAttackRelease(pitch, duration, time, isAccent ? 1.0 : 0.6);
    }

    startMetronome(tempo = 120, subdivision = 'quarter') {
        if (!Tone) return;
        this.stopMetronome();

        this.metronomeEnabled = true;
        Tone.Transport.bpm.value = tempo;

        const subdivisionMap = {
            'quarter': '4n',
            'eighth': '8n'
        };
        const toneSubdivision = subdivisionMap[subdivision] || '4n';

        this.metronomeLoop = new Tone.Loop((time) => {
            this.playClick(time);
        }, toneSubdivision).start(0);

        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
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
        if (!Tone) return;
        Tone.Transport.bpm.value = bpm;
    }

    getTransportSeconds() {
        if (!Tone) return 0;
        return Tone.Transport.seconds;
    }

    stop() {
        if (Tone) {
            Tone.Transport.stop();
        }
        if (this._currentPart) {
            this._currentPart.dispose();
            this._currentPart = null;
        }
        if (Tone) {
            Tone.Transport.cancel();
        }
        this.isPlaying = false;

        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }

        if (this.onPlaybackEnd) {
            this.onPlaybackEnd();
            this.onPlaybackEnd = null;
        }

        if (!this.metronomeEnabled) {
            this.stopMetronome();
        }

        if (this.sampler) {
            this.sampler.releaseAll();
        }
    }

    stopAll() {
        this.stop();
    }

    /** Volume in dB (-60 to 0). Persisted to localStorage. */
    getVolume() {
        return this._volume;
    }

    setVolume(dB) {
        this._volume = dB;
        if (this.masterVolume) {
            this.masterVolume.volume.value = dB;
        }
        localStorage.setItem('piano-teacher-volume', String(dB));
    }

    /** Volume as 0-100 percentage (convenience) */
    getVolumePercent() {
        // -60dB → 0%, 0dB → 100%
        return Math.round(Math.max(0, Math.min(100, ((this._volume + 60) / 60) * 100)));
    }

    setVolumePercent(pct) {
        // 0% → -60dB, 100% → 0dB
        const dB = pct <= 0 ? -Infinity : (pct / 100) * 60 - 60;
        this.setVolume(dB);
    }
}

export const audioEngine = new AudioEngine();
