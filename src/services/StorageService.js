import { getMidiNumber } from '../models/song';

const STORAGE_KEY = 'piano_teacher_songs';

// Helper to migrate legacy song data (string pitches) to new format (number pitches)
const migrateSong = (song) => {
    if (!song || !song.phrases) return song;

    const migratedSong = { ...song };
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
    exportSong: (song) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(song));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${song.title.replace(/\s+/g, '_')}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    // Convert song to base64 encoded string (compact format for sharing)
    exportToString: (song) => {
        try {
            const jsonString = JSON.stringify(song);
            // Use btoa for base64 encoding (works in browser)
            return btoa(unescape(encodeURIComponent(jsonString)));
        } catch (error) {
            console.error('Error exporting to string:', error);
            return null;
        }
    },

    // Import song from base64 string or JSON string
    importFromString: (dataString) => {
        try {
            // Try to parse as base64 first
            try {
                const jsonString = decodeURIComponent(escape(atob(dataString)));
                return JSON.parse(jsonString);
            } catch {
                // If base64 fails, try parsing directly as JSON
                return JSON.parse(dataString);
            }
        } catch (error) {
            console.error('Error importing from string:', error);
            throw new Error('Format de données invalide. Veuillez vérifier la chaîne importée.');
        }
    },

    // Export entire library as JSON file
    exportLibrary: () => {
        const songs = StorageService.getSongs();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(songs));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `bibliotheque_piano_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    // Export library as base64 string
    exportLibraryToString: () => {
        try {
            const songs = StorageService.getSongs();
            const jsonString = JSON.stringify(songs);
            return btoa(unescape(encodeURIComponent(jsonString)));
        } catch (error) {
            console.error('Error exporting library to string:', error);
            return null;
        }
    },

    // Import library from JSON file or base64 string
    importLibrary: (data, merge = false) => {
        try {
            let importedSongs;

            // Check if data is a string (base64 or JSON) or already parsed
            if (typeof data === 'string') {
                // Try to parse as base64 first
                try {
                    const jsonString = decodeURIComponent(escape(atob(data)));
                    importedSongs = JSON.parse(jsonString);
                } catch {
                    // If base64 fails, try parsing directly as JSON
                    importedSongs = JSON.parse(data);
                }
            } else {
                importedSongs = data;
            }

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

