import * as Tone from 'tone';
import { getNoteNameFromMidi } from '../models/song';

class AudioEngine {
    constructor() {
        this.sampler = null;
        this.isPlaying = false;
        this.metronomeEnabled = false; // Track if metronome should stay active
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
    playPhrase(phrase, tempo = 120) {
        // Stop playback but keep metronome if it's enabled
        Tone.Transport.stop();
        Tone.Transport.cancel(); // Clear scheduled events
        if (this.sampler) {
            this.sampler.releaseAll();
        }

        Tone.Transport.bpm.value = tempo;

        // Combine tracks for playback
        const allNotes = [
            ...phrase.tracks.melody.map(n => ({ ...n, track: 'melody' })),
            ...phrase.tracks.chords.map(n => ({ ...n, track: 'chords' }))
        ];

        const part = new Tone.Part((time, note) => {
            const pitch = typeof note.pitch === 'number' ? getNoteNameFromMidi(note.pitch) : note.pitch;
            this.sampler.triggerAttackRelease(pitch, note.duration * Tone.Time('4n').toSeconds(), time);
        }, allNotes.map(n => ({
            time: n.startTime * Tone.Time('4n').toSeconds(),
            pitch: n.pitch, // Keep original in object, convert inside callback
            duration: n.duration
        })));

        part.start(0);

        // Restart metronome if it was enabled
        if (this.metronomeEnabled && this.metronomeLoop) {
            this.metronomeLoop.start(0);
        }

        Tone.Transport.start();
        this.isPlaying = true;
    }

    // Play a specific list of notes (e.g. for a measure)
    playNotes(notes, tempo = 120) {
        // Stop playback but keep metronome if it's enabled
        Tone.Transport.stop();
        Tone.Transport.cancel(); // Clear scheduled events
        if (this.sampler) {
            this.sampler.releaseAll();
        }

        if (notes.length === 0) return;

        Tone.Transport.bpm.value = tempo;

        // Find the earliest start time to normalize playback
        const minTime = Math.min(...notes.map(n => n.startTime));

        const part = new Tone.Part((time, note) => {
            const pitch = typeof note.pitch === 'number' ? getNoteNameFromMidi(note.pitch) : note.pitch;
            this.sampler.triggerAttackRelease(pitch, note.duration * Tone.Time('4n').toSeconds(), time);
        }, notes.map(n => ({
            time: (n.startTime - minTime) * Tone.Time('4n').toSeconds(),
            pitch: n.pitch,
            duration: n.duration
        })));

        part.start(0);

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

    startMetronome(tempo = 120) {
        // Stop any existing metronome loop to avoid duplicates
        this.stopMetronome();

        this.metronomeEnabled = true;
        Tone.Transport.bpm.value = tempo;

        // Schedule click every quarter note
        this.metronomeLoop = new Tone.Loop((time) => {
            this.playClick(time);
        }, "4n").start(0);

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
        Tone.Transport.cancel(); // Clear scheduled events
        this.isPlaying = false;

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
