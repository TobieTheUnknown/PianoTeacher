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

    // Simple LZ-based compression
    _compress: (str) => {
        const dict = {};
        const data = (str + '').split('');
        const out = [];
        let phrase = data[0];
        let code = 256;

        for (let i = 1; i < data.length; i++) {
            const currChar = data[i];
            if (dict[phrase + currChar] != null) {
                phrase += currChar;
            } else {
                out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                dict[phrase + currChar] = code;
                code++;
                phrase = currChar;
            }
        }
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));

        // Convert to string
        let compressed = '';
        for (let i = 0; i < out.length; i++) {
            compressed += String.fromCharCode(out[i]);
        }
        return compressed;
    },

    _decompress: (compressed) => {
        const dict = {};
        const data = (compressed + '').split('');
        let currChar = data[0];
        let oldPhrase = currChar;
        const out = [currChar];
        let code = 256;
        let phrase;

        for (let i = 1; i < data.length; i++) {
            const currCode = data[i].charCodeAt(0);
            if (currCode < 256) {
                phrase = data[i];
            } else {
                phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
            }
            out.push(phrase);
            currChar = phrase.charAt(0);
            dict[code] = oldPhrase + currChar;
            code++;
            oldPhrase = phrase;
        }
        return out.join('');
    },

    // Convert song to compressed base64 string (compact format for sharing)
    exportToString: (song) => {
        try {
            const jsonString = JSON.stringify(song);
            // Compress then encode to base64
            const compressed = StorageService._compress(jsonString);
            return btoa(unescape(encodeURIComponent(compressed)));
        } catch (error) {
            console.error('Error exporting to string:', error);
            return null;
        }
    },

    // Import song from compressed base64 string or JSON string
    importFromString: (dataString) => {
        try {
            // Try to parse as compressed base64 first
            try {
                const decoded = decodeURIComponent(escape(atob(dataString)));
                // Try to decompress
                try {
                    const decompressed = StorageService._decompress(decoded);
                    return JSON.parse(decompressed);
                } catch {
                    // If decompression fails, try parsing decoded string directly
                    return JSON.parse(decoded);
                }
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

