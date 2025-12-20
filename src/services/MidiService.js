import { Midi } from '@tonejs/midi';
import { createSong, createPhrase, createNoteEvent } from '../models/song';

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

        const phrase = createPhrase('Imported MIDI', phraseLength);

        // Process tracks
        midi.tracks.forEach(track => {
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

                // Create NoteEvent
                // note.name is like "C4", "F#3" which matches our format
                const event = createNoteEvent(note.name, startTime, duration);

                phrase.tracks[targetTrack].push(event);
            });
        });

        song.phrases.push(phrase);
        return song;
    } catch (error) {
        console.error("Error in parseMidiFile:", error);
        throw error;
    }
};
