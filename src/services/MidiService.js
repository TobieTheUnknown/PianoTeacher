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
                // Convert time to beats
                const startTime = note.time * (song.tempo / 60);
                const duration = note.duration * (song.tempo / 60);

                // Round to avoid floating-point precision issues at measure boundaries
                // This ensures notes at exactly beat 4.0, 8.0, etc. are correctly placed
                const roundedStartTime = Math.round(startTime * 1000) / 1000;
                const roundedDuration = Math.round(duration * 1000) / 1000;

                // Create NoteEvent
                // note.midi is the integer MIDI number (e.g., 60 for C4)
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

// Export song to MIDI file
export const exportToMidi = (song) => {
    try {
        // Create new MIDI file
        const midi = new Midi();
        midi.header.name = song.title || 'Untitled';

        // Set tempo (BPM)
        midi.header.setTempo(0, song.tempo || 120);

        // Create tracks for melody (right hand) and chords (left hand)
        const melodyTrack = midi.addTrack();
        melodyTrack.name = 'Melody (Right Hand)';

        const chordsTrack = midi.addTrack();
        chordsTrack.name = 'Chords (Left Hand)';

        // Convert beats per second
        const beatsPerSecond = (song.tempo || 120) / 60;

        // Process all phrases
        song.phrases.forEach(phrase => {
            // Add melody notes
            if (phrase.tracks?.melody) {
                phrase.tracks.melody.forEach(note => {
                    const timeInSeconds = note.startTime / beatsPerSecond;
                    const durationInSeconds = note.duration / beatsPerSecond;

                    melodyTrack.addNote({
                        midi: note.pitch,
                        time: timeInSeconds,
                        duration: durationInSeconds,
                        velocity: 0.8
                    });
                });
            }

            // Add chord notes
            if (phrase.tracks?.chords) {
                phrase.tracks.chords.forEach(note => {
                    const timeInSeconds = note.startTime / beatsPerSecond;
                    const durationInSeconds = note.duration / beatsPerSecond;

                    chordsTrack.addNote({
                        midi: note.pitch,
                        time: timeInSeconds,
                        duration: durationInSeconds,
                        velocity: 0.7
                    });
                });
            }
        });

        // Convert to array buffer
        const midiArray = midi.toArray();

        // Create blob and download
        const blob = new Blob([midiArray], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${song.title.replace(/\s+/g, '_')}.mid`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    } catch (error) {
        console.error('Error exporting to MIDI:', error);
        throw new Error('Erreur lors de l\'export MIDI');
    }
};
