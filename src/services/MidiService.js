import { Midi } from '@tonejs/midi';
import { createSong, createPhrase, createNoteEvent } from '../models/song';

// Key detection using note frequency analysis
const detectKey = (notes) => {
    if (!notes || notes.length === 0) {
        return { note: 'C', mode: 'major' };
    }

    // Count occurrences of each pitch class (0-11)
    const pitchClassCounts = new Array(12).fill(0);
    notes.forEach(note => {
        const pitchClass = note.midi % 12;
        pitchClassCounts[pitchClass] += note.duration; // Weight by duration
    });

    // Major and minor key profiles (Krumhansl-Schmuckler)
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

    // Pitch class names
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    let bestCorrelation = -1;
    let bestKey = { note: 'C', mode: 'major' };

    // Try all 12 keys in both major and minor
    for (let tonic = 0; tonic < 12; tonic++) {
        // Major correlation
        let majorCorr = 0;
        for (let i = 0; i < 12; i++) {
            const pitchClass = (i + tonic) % 12;
            majorCorr += pitchClassCounts[pitchClass] * majorProfile[i];
        }
        if (majorCorr > bestCorrelation) {
            bestCorrelation = majorCorr;
            bestKey = { note: noteNames[tonic], mode: 'major' };
        }

        // Minor correlation
        let minorCorr = 0;
        for (let i = 0; i < 12; i++) {
            const pitchClass = (i + tonic) % 12;
            minorCorr += pitchClassCounts[pitchClass] * minorProfile[i];
        }
        if (minorCorr > bestCorrelation) {
            bestCorrelation = minorCorr;
            bestKey = { note: noteNames[tonic], mode: 'minor' };
        }
    }

    return bestKey;
};

export const parseMidiFile = async (file) => {
    console.log("Starting MIDI import for:", file.name);
    try {
        const arrayBuffer = await file.arrayBuffer();
        console.log("ArrayBuffer loaded, size:", arrayBuffer.byteLength);
        const midi = new Midi(arrayBuffer);
        console.log("MIDI parsed:", midi.name, "Tracks:", midi.tracks.length);

        // Create a new song from MIDI metadata
        const song = createSong(midi.name || file.name.replace('.mid', ''));
        if (midi.header.tempos.length > 0) {
            song.tempo = Math.round(midi.header.tempos[0].bpm);
        }

        // Create a single large phrase for the whole song (user can split later)
        // We'll estimate length based on the last note
        const durationInBeats = midi.duration * (song.tempo / 60);
        const phraseLength = Math.ceil(durationInBeats / 4); // in measures

        const phrase = createPhrase('Phrase A', phraseLength);

        // Collect all notes for key detection
        const allMidiNotes = [];

        // Process tracks
        // Collect notes for key detection first
        midi.tracks.forEach(track => allMidiNotes.push(...track.notes));

        // Build list of non-empty tracks with their average pitch
        const nonEmptyTracks = midi.tracks
            .filter(track => track.notes.length > 0)
            .map(track => ({
                track,
                avgPitch: track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length
            }));

        // Track assignment heuristic:
        // - Multi-track MIDI (e.g. two-hand piano): sort by avg pitch, lowest → chords, rest → melody
        //   This correctly handles left-hand parts whose avg pitch is above C4 (e.g. D4-D5 arpeggios)
        // - Single-track MIDI: use absolute threshold C4 (MIDI 60) for backward compatibility
        const assignTarget = (trackInfo, index, sorted) => {
            if (sorted.length >= 2) {
                return index === 0 ? 'chords' : 'melody'; // lowest avg → left hand
            }
            return trackInfo.avgPitch < 60 ? 'chords' : 'melody';
        };

        nonEmptyTracks
            .sort((a, b) => a.avgPitch - b.avgPitch)
            .forEach((trackInfo, index, sorted) => {
                const targetTrack = assignTarget(trackInfo, index, sorted);
                trackInfo.track.notes.forEach(note => {
                    // Convert time to beats
                    const startTime = note.time * (song.tempo / 60);
                    const duration = note.duration * (song.tempo / 60);

                    // Round to avoid floating-point precision issues at measure boundaries
                    const roundedStartTime = Math.round(startTime * 1000) / 1000;
                    const roundedDuration = Math.round(duration * 1000) / 1000;

                    const event = createNoteEvent(note.midi, roundedStartTime, roundedDuration);
                    phrase.tracks[targetTrack].push(event);
                });
            });

        // Detect key signature from all notes
        const detectedKey = detectKey(allMidiNotes);
        song.key = detectedKey;
        console.log("Detected key:", detectedKey);

        song.phrases.push(phrase);
        return song;
    } catch (error) {
        console.error("Error in parseMidiFile:", error);
        throw error;
    }
};
