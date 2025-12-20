import * as Tone from 'tone';

class AudioEngine {
    constructor() {
        this.sampler = null;
        this.isPlaying = false;
    }

    async initialize() {
        if (this.sampler) return;

        await Tone.start();

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
                baseUrl: "https://tonejs.github.io/audio/salamander/",
                onload: () => {
                    console.log("Sampler loaded");
                    resolve();
                }
            }).toDestination();
        });
    }

    playNote(pitch, duration = '8n') {
        if (!this.sampler) return;
        this.sampler.triggerAttackRelease(pitch, duration);
    }

    // Simple playback of a phrase
    playPhrase(phrase, tempo = 120) {
        this.stop();
        Tone.Transport.bpm.value = tempo;

        // Combine tracks for playback
        const allNotes = [
            ...phrase.tracks.melody.map(n => ({ ...n, track: 'melody' })),
            ...phrase.tracks.chords.map(n => ({ ...n, track: 'chords' }))
        ];

        const part = new Tone.Part((time, note) => {
            this.sampler.triggerAttackRelease(note.pitch, note.duration * Tone.Time('4n').toSeconds(), time);
        }, allNotes.map(n => ({
            time: n.startTime * Tone.Time('4n').toSeconds(),
            pitch: n.pitch,
            duration: n.duration
        })));

        part.start(0);

        Tone.Transport.start();
        this.isPlaying = true;
    }

    // Play a specific list of notes (e.g. for a measure)
    playNotes(notes, tempo = 120) {
        this.stop();
        if (notes.length === 0) return;

        Tone.Transport.bpm.value = tempo;

        // Find the earliest start time to normalize playback
        const minTime = Math.min(...notes.map(n => n.startTime));

        const part = new Tone.Part((time, note) => {
            this.sampler.triggerAttackRelease(note.pitch, note.duration * Tone.Time('4n').toSeconds(), time);
        }, notes.map(n => ({
            time: (n.startTime - minTime) * Tone.Time('4n').toSeconds(),
            pitch: n.pitch,
            duration: n.duration
        })));

        part.start(0);

        Tone.Transport.start();
        this.isPlaying = true;
    }

    stop() {
        Tone.Transport.stop();
        Tone.Transport.cancel(); // Clear scheduled events
        this.isPlaying = false;
    }
}

export const audioEngine = new AudioEngine();
