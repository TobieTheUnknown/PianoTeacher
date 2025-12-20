import fs from 'fs';
import midiPkg from '@tonejs/midi';
const { Midi } = midiPkg;
import { createSong, createPhrase, createNoteEvent, NOTE_NAMES } from './src/models/song.js';

// Mock crypto for node environment if needed
if (!global.crypto) {
    global.crypto = {
        randomUUID: () => Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
}

async function testMidiParse() {
    try {
        const buffer = fs.readFileSync('/Users/TobieRaggi/Desktop/Piano teacher/LaputaTwitch(2).mid');
        const midi = new Midi(buffer);

        console.log("MIDI Loaded:", midi.name);
        console.log("Tracks:", midi.tracks.length);

        const song = createSong(midi.name || 'Test Song');

        midi.tracks.forEach((track, i) => {
            console.log(`Track ${i}: ${track.notes.length} notes`);
            track.notes.forEach(n => {
                // Check if note name exists in our mapping
                const pitch = n.name;
                const noteName = pitch.slice(0, -1);
                if (!NOTE_NAMES[noteName]) {
                    console.warn(`Warning: Note ${noteName} not in NOTE_NAMES mapping!`);
                }
            });
        });

        console.log("Parse successful!");
    } catch (e) {
        console.error("Error parsing MIDI:", e);
    }
}

testMidiParse();
