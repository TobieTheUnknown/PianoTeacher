import { quarterNotesPerMeasure } from '../utils/timing.js';
import { getMidiNumber, normalizeKeySignature } from '../models/song.js';
import * as MidiModule from '@tonejs/midi';
import * as MidiFileModule from 'midi-file';

const { Midi } = MidiModule.default ?? MidiModule;
const MidiFile = MidiFileModule.default ?? MidiFileModule;

// Detect if running in Tauri environment
// In Tauri v2, check for TAURI_PLATFORM env variable instead of window.__TAURI__
const isTauri = () => {
    if (typeof window === 'undefined') return false;
    // Check for Tauri v2 environment variables or internal object
    return import.meta.env?.TAURI_PLATFORM !== undefined ||
           import.meta.env?.TAURI_FAMILY !== undefined ||
           window.__TAURI_INTERNALS__ !== undefined;
};

const STORAGE_KEY = 'piano_teacher_songs';

// Helper to migrate legacy song data (string pitches) to new format (number pitches)
const migrateSong = (song) => {
    if (!song) return song;

    const migratedSong = { ...song };

    // Legacy editor versions persisted compact strings such as "Bb" / "Bbm".
    // Keep the canonical object shape at every storage boundary.
    migratedSong.key = normalizeKeySignature(migratedSong.key);

    // Add default timeSignature if missing
    if (!migratedSong.timeSignature) {
        migratedSong.timeSignature = { numerator: 4, denominator: 4 };
    }

    migratedSong.phrases = (Array.isArray(song.phrases) ? song.phrases : []).map(phrase => {
        const newPhrase = { ...phrase, tracks: { ...phrase.tracks } };

        // Older exports stored hands directly on the phrase. Normalize the
        // structure as well as pitches so every consumer sees the same tracks.
        for (const hand of ['melody', 'chords']) {
            const notes = newPhrase.tracks[hand] ?? newPhrase[hand] ?? [];
            newPhrase.tracks[hand] = notes.map(note => ({
                ...note,
                pitch: typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch
            }));
            delete newPhrase[hand];
        }

        // Migrate hand separators if they exist
        if (newPhrase.handSeparators) {
            newPhrase.handSeparators = newPhrase.handSeparators.map(sep => ({
                ...sep,
                pitch: typeof sep.pitch === 'string' ? getMidiNumber(sep.pitch) : sep.pitch
            }));
        }

        return newPhrase;
    });

    return migratedSong;
};

// Reads used by mutations must fail closed: treating damaged JSON as an
// empty library would overwrite the user's recoverable original data.
const readSongs = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(song => !song || typeof song !== 'object')) {
        throw new Error('Bibliothèque illisible : les données originales sont conservées.');
    }
    return parsed.map(migrateSong);
};

const KEY_SIGNATURE_COUNTS = Object.freeze({
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
    F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
});
const MINOR_RELATIVE_MAJORS = Object.freeze({
    A: 'C', E: 'G', B: 'D', 'F#': 'A', 'C#': 'E', 'G#': 'B', 'D#': 'F#', 'A#': 'C#',
    D: 'F', G: 'Bb', C: 'Eb', F: 'Ab', Bb: 'Db', Eb: 'Gb', Ab: 'Cb',
});

/** Build a standards-compliant MIDI byte array, independently of the download UI. */
export const buildSongMidiBytes = (sourceSong) => {
    const song = migrateSong(sourceSong);
    const midi = new Midi();
    const bpm = Number.isFinite(song.tempo) && song.tempo > 0 ? song.tempo : 120;
    const timeSignature = song.timeSignature || { numerator: 4, denominator: 4 };
    const unitsPerMeasure = quarterNotesPerMeasure(timeSignature);
    midi.header.setTempo(bpm);
    midi.header.timeSignatures.push({
        ticks: 0,
        timeSignature: [timeSignature.numerator || 4, timeSignature.denominator || 4],
    });
    midi.header.update();

    const melodyTrack = midi.addTrack();
    melodyTrack.name = 'Mélodie';
    const chordsTrack = midi.addTrack();
    chordsTrack.name = 'Accords';
    let phraseOffset = 0;
    for (const phrase of song.phrases || []) {
        for (const [hand, track, velocity] of [
            ['melody', melodyTrack, 0.8],
            ['chords', chordsTrack, 0.7],
        ]) {
            for (const note of phrase.tracks?.[hand] || []) {
                if (Number.isInteger(note.pitch) && note.pitch >= 0 && note.pitch <= 127 &&
                    Number.isFinite(note.startTime) && note.startTime >= 0 &&
                    Number.isFinite(note.duration) && note.duration > 0) {
                    track.addNote({
                        midi: note.pitch,
                        ticks: Math.round((phraseOffset + note.startTime) * midi.header.ppq),
                        durationTicks: Math.max(1, Math.round(note.duration * midi.header.ppq)),
                        velocity,
                    });
                }
            }
        }
        phraseOffset += Math.max(1, phrase.length || 1) * unitsPerMeasure;
    }

    // @tonejs/midi 2.0.28 writes the signed key count with the wrong offset.
    // Inject the raw event with midi-file until that upstream encoder is fixed.
    const raw = MidiFile.parseMidi(midi.toArray());
    const key = normalizeKeySignature(song.key);
    const signatureName = key.mode === 'minor' ? MINOR_RELATIVE_MAJORS[key.note] : key.note;
    const count = KEY_SIGNATURE_COUNTS[signatureName];
    if (Number.isInteger(count)) {
        raw.tracks[0].unshift({
            deltaTime: 0,
            meta: true,
            type: 'keySignature',
            key: count,
            scale: key.mode === 'minor' ? 1 : 0,
        });
    }
    return new Uint8Array(MidiFile.writeMidi(raw));
};

export const StorageService = {
    getSongs: () => {
        try {
            return readSongs();
        } catch (error) {
            console.error('Error loading songs:', error);
            return [];
        }
    },

    saveSong: (song) => {
        try {
            const songs = readSongs();
            const existingIndex = songs.findIndex(s => s.id === song.id);

            // Update timestamp
            const songToSave = { ...migrateSong(song), updatedAt: new Date().toISOString() };

            if (existingIndex >= 0) {
                songs[existingIndex] = songToSave;
            } else {
                songs.push(songToSave);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
            return true;
        } catch (error) {
            console.error('Error saving song:', error);
            return false;
        }
    },

    loadSong: (id) => {
        const songs = readSongs();
        return songs.find(s => s.id === id);
    },

    deleteSong: (id) => {
        try {
            const songs = readSongs();
            const newSongs = songs.filter(s => s.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newSongs));
            return true;
        } catch (error) {
            console.error('Error deleting song:', error);
            return false;
        }
    },

    // Export song as JSON file download
    exportSong: async (song) => {
        const canonicalSong = migrateSong(song);
        const songJson = JSON.stringify(canonicalSong, null, 2);
        const defaultFilename = `${song.title.replace(/\s+/g, '_')}.json`;

        // Use Tauri dialog if available (desktop app)
        if (isTauri()) {
            try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeTextFile } = await import('@tauri-apps/plugin-fs');

                const filePath = await save({
                    defaultPath: defaultFilename,
                    filters: [{
                        name: 'JSON',
                        extensions: ['json']
                    }]
                });

                if (filePath) {
                    await writeTextFile(filePath, songJson);
                    console.log('Song exported to:', filePath);
                    return { success: true, path: filePath };
                }
                return { success: false, cancelled: true };
            } catch (error) {
                console.error('Error exporting song with Tauri:', error);
            }
        }

        // Fallback: Web browser download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(songJson);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", defaultFilename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        return { success: true };
    },

    // Export entire library as JSON file
    exportLibrary: async () => {
        const songs = readSongs();
        const libraryJson = JSON.stringify(songs, null, 2);
        const defaultFilename = `bibliotheque_piano_${new Date().toISOString().split('T')[0]}.json`;

        if (isTauri()) {
            try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeTextFile } = await import('@tauri-apps/plugin-fs');

                const filePath = await save({
                    defaultPath: defaultFilename,
                    filters: [{
                        name: 'JSON',
                        extensions: ['json']
                    }]
                });

                if (filePath) {
                    await writeTextFile(filePath, libraryJson);
                    console.log('Library exported to:', filePath);
                    return { success: true, path: filePath };
                }
                return { success: false, cancelled: true };
            } catch (error) {
                console.error('Error exporting library with Tauri:', error);
            }
        }

        // Fallback: Web browser download
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(libraryJson);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", defaultFilename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        return { success: true };
    },

    // Export a single song as a MIDI file
    exportSongAsMidi: async (song) => {
        const midiArray = buildSongMidiBytes(song);
        const defaultFilename = `${(song.title || 'export').replace(/[^a-z0-9]/gi, '_')}.mid`;

        if (isTauri()) {
            try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeFile } = await import('@tauri-apps/plugin-fs');
                const filePath = await save({
                    defaultPath: defaultFilename,
                    filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }]
                });
                if (filePath) {
                    await writeFile(filePath, midiArray);
                    return { success: true, path: filePath };
                }
                return { success: false, cancelled: true };
            } catch (err) {
                console.error('Tauri MIDI export failed, falling back to browser:', err);
            }
        }

        // Browser / Android fallback
        const blob = new Blob([midiArray], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return { success: true };
    },

    // Import library from JSON object or array
    importLibrary: (data, merge = false) => {
        try {
            // data should be a parsed JSON object/array
            const importedSongs = data;

            // Validate that importedSongs is an array
            if (!Array.isArray(importedSongs)) {
                throw new Error('Les données importées ne sont pas au bon format.');
            }

            const canonicalSongs = importedSongs.map(migrateSong);

            if (merge) {
                // Merge with existing library
                const existingSongs = readSongs();
                const mergedSongs = [...existingSongs];

                canonicalSongs.forEach(importedSong => {
                    const existingIndex = mergedSongs.findIndex(s => s.id === importedSong.id);
                    if (existingIndex >= 0) {
                        // Update existing song
                        mergedSongs[existingIndex] = { ...importedSong, updatedAt: new Date().toISOString() };
                    } else {
                        // Add new song
                        mergedSongs.push({ ...importedSong, updatedAt: new Date().toISOString() });
                    }
                });

                localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedSongs));
            } else {
                // Replace entire library
                localStorage.setItem(STORAGE_KEY, JSON.stringify(canonicalSongs));
            }

            return true;
        } catch (error) {
            console.error('Error importing library:', error);
            throw new Error('Erreur lors de l\'import de la bibliothèque. Vérifiez le format des données.');
        }
    }
};
