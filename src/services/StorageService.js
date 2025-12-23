const STORAGE_KEY = 'piano_teacher_songs';

export const StorageService = {
    getSongs: () => {
        try {
            const songs = localStorage.getItem(STORAGE_KEY);
            return songs ? JSON.parse(songs) : [];
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
    }
};

