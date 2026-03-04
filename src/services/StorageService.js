import { getMidiNumber } from '../models/song';

// Detect if running in Tauri environment
// In Tauri v2, check for TAURI_PLATFORM env variable instead of window.__TAURI__
const isTauri = () => {
    if (typeof window === 'undefined') return false;
    // Check for Tauri v2 environment variables or internal object
    return import.meta.env.TAURI_PLATFORM !== undefined ||
           import.meta.env.TAURI_FAMILY !== undefined ||
           window.__TAURI_INTERNALS__ !== undefined;
};

const STORAGE_KEY = 'piano_teacher_songs';

// Helper to migrate legacy song data (string pitches) to new format (number pitches)
const migrateSong = (song) => {
    if (!song || !song.phrases) return song;

    const migratedSong = { ...song };

    // Add default timeSignature if missing
    if (!migratedSong.timeSignature) {
        migratedSong.timeSignature = { numerator: 4, denominator: 4 };
    }

    migratedSong.phrases = song.phrases.map(phrase => {
        const newPhrase = { ...phrase };

        // Migrate melody
        if (newPhrase.tracks?.melody) {
            newPhrase.tracks.melody = newPhrase.tracks.melody.map(note => ({
                ...note,
                pitch: typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch
            }));
        } else if (newPhrase.melody) {
            // Legacy flat structure
            newPhrase.melody = newPhrase.melody.map(note => ({
                ...note,
                pitch: typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch
            }));
        }

        // Migrate chords
        if (newPhrase.tracks?.chords) {
            newPhrase.tracks.chords = newPhrase.tracks.chords.map(note => ({
                ...note,
                pitch: typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch
            }));
        } else if (newPhrase.chords) {
            // Legacy flat structure
            newPhrase.chords = newPhrase.chords.map(note => ({
                ...note,
                pitch: typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch
            }));
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

export const StorageService = {
    getSongs: () => {
        try {
            const songs = localStorage.getItem(STORAGE_KEY);
            const parsedSongs = songs ? JSON.parse(songs) : [];
            // Migrate all loaded songs on the fly
            return parsedSongs.map(migrateSong);
        } catch (error) {
            console.error('Error loading songs:', error);
            return [];
        }
    },

    saveSong: (song) => {
        try {
            const songs = StorageService.getSongs();
            const existingIndex = songs.findIndex(s => s.id === song.id);

            // Update timestamp
            const songToSave = { ...song, updatedAt: new Date().toISOString() };

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
        const songs = StorageService.getSongs();
        return songs.find(s => s.id === id);
    },

    deleteSong: (id) => {
        try {
            const songs = StorageService.getSongs();
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
        const songJson = JSON.stringify(song, null, 2);
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
        const songs = StorageService.getSongs();
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

    // Import library from JSON object or array
    importLibrary: (data, merge = false) => {
        try {
            // data should be a parsed JSON object/array
            const importedSongs = data;

            // Validate that importedSongs is an array
            if (!Array.isArray(importedSongs)) {
                throw new Error('Les données importées ne sont pas au bon format.');
            }

            if (merge) {
                // Merge with existing library
                const existingSongs = StorageService.getSongs();
                const mergedSongs = [...existingSongs];

                importedSongs.forEach(importedSong => {
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
                localStorage.setItem(STORAGE_KEY, JSON.stringify(importedSongs));
            }

            return true;
        } catch (error) {
            console.error('Error importing library:', error);
            throw new Error('Erreur lors de l\'import de la bibliothèque. Vérifiez le format des données.');
        }
    }
};

