import { useState, useCallback } from 'react';
import { createSong, createPhrase, createNoteEvent } from './models/song';
import { StorageService } from './services/StorageService';

export function useSong() {
    const [song, setSong] = useState(createSong());

    const updateSongMetadata = useCallback((updates) => {
        setSong(prev => ({ ...prev, ...updates }));
    }, []);

    const importSong = useCallback((newSong) => {
        setSong(newSong);
    }, []);

    const newSong = useCallback(() => {
        setSong(createSong());
    }, []);

    const loadSong = useCallback((id) => {
        const loadedSong = StorageService.loadSong(id);
        if (loadedSong) {
            setSong(loadedSong);
        }
    }, []);

    const saveSong = useCallback(() => {
        StorageService.saveSong(song);
        alert('Morceau sauvegardé !');
    }, [song]);

    const addPhrase = useCallback(() => {
        setSong(prev => ({
            ...prev,
            phrases: [...prev.phrases, createPhrase(`Section ${String.fromCharCode(65 + prev.phrases.length)}`)]
        }));
    }, []);

    const removePhrase = useCallback((phraseId) => {
        setSong(prev => ({
            ...prev,
            phrases: prev.phrases.filter(p => p.id !== phraseId)
        }));
    }, []);

    const addNoteToPhrase = useCallback((phraseId, trackName, pitch, startTime, duration) => {
        setSong(prev => ({
            ...prev,
            phrases: prev.phrases.map(p => {
                if (p.id !== phraseId) return p;
                return {
                    ...p,
                    tracks: {
                        ...p.tracks,
                        [trackName]: [...p.tracks[trackName], createNoteEvent(pitch, startTime, duration)]
                    }
                };
            })
        }));
    }, []);

    const removeNoteFromPhrase = useCallback((phraseId, trackName, noteId) => {
        setSong(prev => ({
            ...prev,
            phrases: prev.phrases.map(p => {
                if (p.id !== phraseId) return p;
                return {
                    ...p,
                    tracks: {
                        ...p.tracks,
                        [trackName]: p.tracks[trackName].filter(n => n.id !== noteId)
                    }
                };
            })
        }));
    }, []);

    const updateNoteInPhrase = useCallback((phraseId, trackName, noteId, updates) => {
        setSong(prev => ({
            ...prev,
            phrases: prev.phrases.map(p => {
                if (p.id !== phraseId) return p;
                return {
                    ...p,
                    tracks: {
                        ...p.tracks,
                        [trackName]: p.tracks[trackName].map(n =>
                            n.id === noteId ? { ...n, ...updates } : n
                        )
                    }
                };
            })
        }));
    }, []);

    const toggleHighlightedMeasure = useCallback((measureNumber) => {
        setSong(prev => {
            const highlightedMeasures = prev.highlightedMeasures || [];
            const isHighlighted = highlightedMeasures.includes(measureNumber);

            return {
                ...prev,
                highlightedMeasures: isHighlighted
                    ? highlightedMeasures.filter(m => m !== measureNumber)
                    : [...highlightedMeasures, measureNumber]
            };
        });
    }, []);

    return {
        song,
        updateSongMetadata,
        importSong,
        newSong,
        loadSong,
        saveSong,
        addPhrase,
        removePhrase,
        addNoteToPhrase,
        removeNoteFromPhrase,
        updateNoteInPhrase,
        toggleHighlightedMeasure
    };
}
