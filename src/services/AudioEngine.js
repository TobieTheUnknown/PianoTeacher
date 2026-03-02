import * as Tone from 'tone';
import { getNoteNameFromMidi } from '../models/song';

class AudioEngine {
    constructor() {
        this.sampler = null;
        this.isPlaying = false; // True only when actually playing notes (not just metronome)
        this.metronomeEnabled = false; // Track if metronome should stay active
    }

    // Returns true only if we're playing actual music (not just metronome)
    getIsActuallyPlaying() {
        return this.isPlaying;
    }

    async initialize() {
        if (this.sampler) return;

        await Tone.start();


        // Metronome Synth
        this.metronomeSynth = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            envelope: {
                attack: 0.0006,
                decay: 0.1,
                sustain: 0
            }
        }).toDestination();

        return new Promise((resolve) => {
            this.sampler = new Tone.Sampler({
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
                    console.log("Sampler loaded");
                    resolve();
                }
            }).toDestination();
        });
    }

    playNote(pitch, duration = '8n', time) {
        if (!this.sampler) return;
        const note = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;
        this.sampler.triggerAttackRelease(note, duration, time);
    }

    // Simple playback of a phrase
    // startPositionBeats: optional start position in beats (if not provided, starts from 0)
    // stopAtEnd: if true, automatically stop playback at the end of the phrase
    // onPlaybackEnd: optional callback called when playback ends (either manually or automatically)
    playPhrase(phrase, tempo = 120, startPositionBeats = null, stopAtEnd = false, onPlaybackEnd = null, beatsPerMeasure = 4) {
        this.onPlaybackEnd = onPlaybackEnd;

        // Stop current transport and dispose of previous part
        Tone.Transport.stop();
        if (this._currentPart) {
            this._currentPart.dispose();
            this._currentPart = null;
        }
        Tone.Transport.cancel();
        if (this.sampler) {
            this.sampler.releaseAll();
        }

        // Clear any previous stop timeout
        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }

        Tone.Transport.bpm.value = tempo;

        // Combine tracks for playback
        const allNotes = [
            ...phrase.tracks.melody.map(n => ({ ...n, track: 'melody' })),
            ...phrase.tracks.chords.map(n => ({ ...n, track: 'chords' }))
        ];

        // Pre-compute quarter note duration once
        const quarterDuration = Tone.Time('4n').toSeconds();

        this._currentPart = new Tone.Part((time, note) => {
            const pitch = typeof note.pitch === 'number' ? getNoteNameFromMidi(note.pitch) : note.pitch;
            this.sampler.triggerAttackRelease(pitch, note.duration * quarterDuration, time);
        }, allNotes.map(n => ({
            time: n.startTime * quarterDuration,
            pitch: n.pitch,
            duration: n.duration
        })));

        this._currentPart.start(0);

        // Restart metronome if it was enabled
        if (this.metronomeEnabled && this.metronomeLoop) {
            this.metronomeLoop.start(0);
        }

        // Calculate start position
        let startSeconds = 0;
        if (startPositionBeats !== null && startPositionBeats > 0) {
            startSeconds = (startPositionBeats * 60) / tempo;
            Tone.Transport.seconds = startSeconds;
        }

        Tone.Transport.start();
        this.isPlaying = true;

        // Schedule automatic stop at end of phrase if requested
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

    // Play a specific list of notes (e.g. for a measure)
    playNotes(notes, tempo = 120) {
        // Stop playback but keep metronome if it's enabled
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

        // Find the earliest start time to normalize playback
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

        // Restart metronome if it was enabled
        if (this.metronomeEnabled && this.metronomeLoop) {
            this.metronomeLoop.start(0);
        }

        Tone.Transport.start();
        this.isPlaying = true;
    }

    // Metronome Features
    playClick(time, isAccent = false) {
        if (!this.metronomeSynth) return;
        // Accent (first beat) is higher pitch and louder
        const pitch = isAccent ? "C6" : "C5";
        const duration = "32n";
        this.metronomeSynth.triggerAttackRelease(pitch, duration, time, isAccent ? 1.0 : 0.6);
    }

    startMetronome(tempo = 120, subdivision = 'quarter') {
        // Stop any existing metronome loop to avoid duplicates
        this.stopMetronome();

        this.metronomeEnabled = true;
        Tone.Transport.bpm.value = tempo;

        // Map subdivision to Tone.js notation
        const subdivisionMap = {
            'quarter': '4n',  // Noire (1/4)
            'eighth': '8n'    // Croche (1/8)
        };
        const toneSubdivision = subdivisionMap[subdivision] || '4n';

        // Schedule click at the specified subdivision
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
        Tone.Transport.bpm.value = bpm;
    }

    stop() {
        Tone.Transport.stop();
        if (this._currentPart) {
            this._currentPart.dispose();
            this._currentPart = null;
        }
        Tone.Transport.cancel();
        this.isPlaying = false;

        // Clear any scheduled stop timeout
        if (this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }

        // Call the playback end callback if it exists
        if (this.onPlaybackEnd) {
            this.onPlaybackEnd();
            this.onPlaybackEnd = null;
        }

        // Only stop metronome if explicitly disabled
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
}

export const audioEngine = new AudioEngine();
