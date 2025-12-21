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

async function testMidiParse(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        const midi = new Midi(buffer);

        console.log("\n=== Analyzing:", filePath, "===");
        console.log("MIDI Loaded:", midi.name);
        console.log("Duration:", midi.duration, "seconds");
        console.log("Tempo:", midi.header.tempos[0]?.bpm || 120, "BPM");
        console.log("Tracks:", midi.tracks.length);

        const tempo = midi.header.tempos[0]?.bpm || 120;

        midi.tracks.forEach((track, i) => {
            console.log(`\n--- Track ${i}: ${track.notes.length} notes ---`);

            // Calculate average pitch
            const avgPitch = track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length;
            const trackType = avgPitch < 60 ? 'CHORDS (Left Hand)' : 'MELODY (Right Hand)';
            console.log(`Average pitch: ${avgPitch.toFixed(1)} -> ${trackType}`);

            console.log('\nFirst 20 notes (with FULL PRECISION):');
            track.notes.slice(0, 20).forEach((note, idx) => {
                const startTimeBeats = note.time * (tempo / 60);
                const durationBeats = note.duration * (tempo / 60);

                // Check if this note would be filtered for measure 1 & 2
                const inMeasure1 = startTimeBeats >= 0 && startTimeBeats < 4;
                const inMeasure2 = startTimeBeats >= 4 && startTimeBeats < 8;

                // Show which beats are exactly on measure boundaries
                const isOnBoundary = (startTimeBeats % 4) === 0;
                const boundaryMarker = isOnBoundary ? ' [BOUNDARY]' : '';

                console.log(`  ${idx}: ${note.name.padEnd(4)} @ ${startTimeBeats.toFixed(20)} → M1: ${inMeasure1}, M2: ${inMeasure2}${boundaryMarker}`);
            });

            // Count notes in first measure using the actual filter logic
            const measure1Notes = track.notes.filter(n => {
                const st = n.time * (tempo / 60);
                return st >= 0 && st < 4;
            });
            console.log(`\n→ TOTAL notes in Measure 1: ${measure1Notes.length}`);
        });

        console.log("\n======================\n");
    } catch (e) {
        console.error("Error parsing MIDI:", e);
    }
}

// Test both MIDI files
testMidiParse('./LaputaTwitch(2).mid');
testMidiParse('./OtherPromiseTwitch.mid');
