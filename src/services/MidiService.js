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

        // Extract time signature from MIDI
        if (midi.header.timeSignatures.length > 0) {
            const ts = midi.header.timeSignatures[0];
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
        // We'll estimate length based on the last note
        const durationInBeats = midi.duration * (song.tempo / 60);
        // Calculate beats per measure based on time signature
        const beatsPerMeasure = (song.timeSignature.numerator / song.timeSignature.denominator) * 4;
        let phraseLength = Math.ceil(durationInBeats / beatsPerMeasure); // in measures

        // Ensure phrase length is valid (at least 1 measure, at most 64 measures)
        if (!phraseLength || phraseLength < 1 || !isFinite(phraseLength)) {
            console.warn("Invalid phrase length calculated:", phraseLength, "defaulting to 4 measures");
            phraseLength = 4;
        } else if (phraseLength > 64) {
            console.warn("Phrase too long:", phraseLength, "capping at 64 measures");
            phraseLength = 64;
        }

        const phrase = createPhrase('Phrase A', phraseLength);

        // Collect all notes for key detection
        const allMidiNotes = [];

        // Process tracks
        midi.tracks.forEach(track => {
            // Collect notes for key detection
            allMidiNotes.push(...track.notes);
            // Simple heuristic:
            // - If average pitch < C4 (60), assign to Chords (Left Hand)
            // - Else assign to Melody (Right Hand)
            // - Or just put everything in Melody if it's a single track MIDI

            let avgPitch = 0;
            if (track.notes.length > 0) {
                avgPitch = track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length;
            }

            const targetTrack = avgPitch < 60 ? 'chords' : 'melody';

            track.notes.forEach(note => {
                // Convert time to beats using integer arithmetic to avoid floating-point errors
                // Use 1/16 note as base unit (4 divisions per beat)
                const TICKS_PER_BEAT = 4; // 4 x 1/16 notes = 1 beat

                // Convert seconds to beats
                const startTimeBeats = note.time * (song.tempo / 60);
                const durationBeats = note.duration * (song.tempo / 60);

                // Convert to ticks (integer)
                const startTimeTicks = Math.round(startTimeBeats * TICKS_PER_BEAT);
                const durationTicks = Math.max(1, Math.round(durationBeats * TICKS_PER_BEAT));

                // Convert back to beats (now quantized to 1/16 note grid)
                const quantizedStartTime = startTimeTicks / TICKS_PER_BEAT;
                const quantizedDuration = durationTicks / TICKS_PER_BEAT;

                // Create NoteEvent
                // note.midi is the integer MIDI number (e.g., 60 for C4)
                const event = createNoteEvent(note.midi, quantizedStartTime, quantizedDuration);

                phrase.tracks[targetTrack].push(event);
            });
        });

        // Detect key signature from all notes
        const detectedKey = detectKey(allMidiNotes);
        song.key = detectedKey;
        console.log("Detected key:", detectedKey);

        // Normalize note positions to align with measure boundaries
        // (beatsPerMeasure already calculated above)

        // Find the earliest note across all tracks
        let earliestNoteTime = Infinity;
        phrase.tracks.melody.forEach(note => {
            if (note.startTime < earliestNoteTime) earliestNoteTime = note.startTime;
        });
        phrase.tracks.chords.forEach(note => {
            if (note.startTime < earliestNoteTime) earliestNoteTime = note.startTime;
        });

        if (earliestNoteTime !== Infinity && earliestNoteTime > 0) {
            // Calculate offset to align to measure boundary
            // Round down to nearest measure start
            const measuresBeforeFirstNote = Math.floor(earliestNoteTime / beatsPerMeasure);
            const alignedStart = measuresBeforeFirstNote * beatsPerMeasure;
            const offset = earliestNoteTime - alignedStart;

            console.log(`Normalizing notes: earliest=${earliestNoteTime}, alignedStart=${alignedStart}, offset=${offset}`);

            // Subtract offset from all notes to align them
            phrase.tracks.melody.forEach(note => {
                note.startTime -= offset;
            });
            phrase.tracks.chords.forEach(note => {
                note.startTime -= offset;
            });
        }

        song.phrases.push(phrase);
        return song;
    } catch (error) {
        console.error("Error in parseMidiFile:", error);
        throw error;
    }
};
