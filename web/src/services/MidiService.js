import { quarterNotesPerMeasure } from '../utils/timing.js';
import * as MidiModule from '@tonejs/midi';
const { Midi } = MidiModule.default ?? MidiModule;
import { createSong, createPhrase, createNoteEvent } from '../models/song.js';

// Key detection using note frequency analysis
export const detectKey = (notes) => {
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

    const correlation = (distribution, profile, tonic) => {
        const rotated = Array.from({ length: 12 }, (_, index) => distribution[(index + tonic) % 12]);
        const meanA = rotated.reduce((sum, value) => sum + value, 0) / 12;
        const meanB = profile.reduce((sum, value) => sum + value, 0) / 12;
        let numerator = 0;
        let squareA = 0;
        let squareB = 0;
        for (let index = 0; index < 12; index++) {
            const a = rotated[index] - meanA;
            const b = profile[index] - meanB;
            numerator += a * b;
            squareA += a * a;
            squareB += b * b;
        }
        const denominator = Math.sqrt(squareA * squareB);
        return denominator === 0 ? 0 : numerator / denominator;
    };

    let bestCorrelation = -2;
    let bestKey = { note: 'C', mode: 'major' };

    // Try all 12 keys in both major and minor
    for (let tonic = 0; tonic < 12; tonic++) {
        // Major correlation
        const majorCorr = correlation(pitchClassCounts, majorProfile, tonic);
        if (majorCorr > bestCorrelation) {
            bestCorrelation = majorCorr;
            bestKey = { root: tonic, mode: 'major' };
        }

        // Minor correlation
        const minorCorr = correlation(pitchClassCounts, minorProfile, tonic);
        if (minorCorr > bestCorrelation) {
            bestCorrelation = minorCorr;
            bestKey = { root: tonic, mode: 'minor' };
        }
    }
    const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const flatMajorRoots = new Set([1, 3, 5, 6, 8, 10]);
    const relativeMajorRoot = bestKey.mode === 'minor' ? (bestKey.root + 3) % 12 : bestKey.root;
    return {
        note: (flatMajorRoots.has(relativeMajorRoot) ? flatNames : sharpNames)[bestKey.root],
        mode: bestKey.mode,
    };
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
        const initialTempo = midi.header.tempos.find(event => event.ticks === 0);
        if (initialTempo) song.tempo = Math.round(initialTempo.bpm);

        // Extract time signature from MIDI
        const initialTimeSignature = midi.header.timeSignatures.find(event => event.ticks === 0);
        if (initialTimeSignature) {
            const ts = initialTimeSignature;
            // @tonejs/midi stores time signature as an array [numerator, denominator]
            song.timeSignature = {
                numerator: ts.timeSignature[0],
                denominator: ts.timeSignature[1]
            };
            console.log("Detected time signature:", song.timeSignature);
        }

        // Ensure timeSignature is always valid (fallback to 4/4)
        if (!song.timeSignature || !song.timeSignature.numerator || !song.timeSignature.denominator) {
            console.warn("Invalid or missing time signature, defaulting to 4/4");
            song.timeSignature = { numerator: 4, denominator: 4 };
        }

        // Create a single large phrase for the whole song (user can split later)
        // We'll estimate length based on the last note. Use ticks (integer) rather
        // than seconds × tempo to avoid floating-point noise that would push
        // downbeats slightly before measure boundaries.
        const ppq = midi.header.ppq;
        const durationInBeats = midi.durationTicks / ppq;
        // Calculate beats per measure based on time signature
        const beatsPerMeasure = quarterNotesPerMeasure(song.timeSignature);
        let phraseLength = Math.ceil(durationInBeats / beatsPerMeasure); // in measures

        // Ensure phrase length is valid (at least 1 measure; never hide notes beyond a display cap)
        if (!phraseLength || phraseLength < 1 || !isFinite(phraseLength)) {
            console.warn("Invalid phrase length calculated:", phraseLength, "defaulting to 4 measures");
            phraseLength = 4;

        }

        const phrase = createPhrase('Phrase A', phraseLength);

        // Collect all notes for key detection
        const allMidiNotes = [];
        midi.tracks.forEach(track => allMidiNotes.push(...track.notes));

        // Track assignment heuristic:
        // - Multi-track MIDI: sort by avg pitch, lowest → chords (left hand), rest → melody (right hand)
        //   Handles left-hand parts whose avg pitch is above C4 (e.g. D4-D5 arpeggios)
        // - Single-track MIDI: use absolute threshold C4 (60) for backward compatibility
        const nonEmptyTracks = midi.tracks
            .filter(track => track.notes.length > 0)
            .map(track => ({
                track,
                avgPitch: track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length
            }))
            .sort((a, b) => a.avgPitch - b.avgPitch);

        nonEmptyTracks.forEach((trackInfo, index) => {
            const targetTrack = nonEmptyTracks.length >= 2
                ? (index === 0 ? 'chords' : 'melody')
                : (trackInfo.avgPitch < 60 ? 'chords' : 'melody');

            trackInfo.track.notes.forEach(note => {
                // Use ticks (exact integers) instead of seconds to avoid FP noise
                // that would put downbeats at e.g. 27.99999... instead of 28.
                const startTimeBeats = note.ticks / ppq;
                const durationBeats = note.durationTicks / ppq;
                if (!(durationBeats > 0)) return;

                const event = createNoteEvent(note.midi, startTimeBeats, durationBeats);
                const hand = nonEmptyTracks.length === 1 ? (note.midi < 60 ? 'chords' : 'melody') : targetTrack;
                phrase.tracks[hand].push(event);
            });
        });

        // Detect key signature from all notes
        const detectedKey = detectKey(allMidiNotes);
        const explicitKey = midi.header.keySignatures?.find(key => key.ticks === 0);
        // @tonejs/midi reports the major-key name for the signed accidental count,
        // including minor signatures. Resolve its relative minor explicitly.
        const relativeMinor = { Cb: 'Ab', Gb: 'Eb', Db: 'Bb', Ab: 'F', Eb: 'C', Bb: 'G', F: 'D', C: 'A', G: 'E', D: 'B', A: 'F#', E: 'C#', B: 'G#', 'F#': 'D#', 'C#': 'A#' };
        song.key = explicitKey?.key ? {
            note: explicitKey.scale === 'minor' ? relativeMinor[explicitKey.key] : explicitKey.key,
            mode: explicitKey.scale,
        } : detectedKey;
        console.log("Detected key:", detectedKey);

        // Preserve anacrusis and initial rests exactly as encoded in ticks.

        song.phrases.push(phrase);
        return song;
    } catch (error) {
        console.error("Error in parseMidiFile:", error);
        throw error;
    }
};
