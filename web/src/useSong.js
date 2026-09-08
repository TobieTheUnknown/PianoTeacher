import { quarterNotesPerMeasure } from './utils/timing.js';
import { useState, useCallback } from 'react';
import { createSong, createPhrase, createNoteEvent } from './models/song';
import { StorageService } from './services/StorageService';
import { mergePhrases, splitPhraseAtMeasure } from './utils/phraseEditing.js';

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
    }, [song]);

    const addPhrase = useCallback(() => {
        setSong(prev => ({
            ...prev,
            phrases: [...prev.phrases, createPhrase(`Phrase ${String.fromCharCode(65 + prev.phrases.length)}`)]
        }));
    }, []);

    const removePhrase = useCallback((phraseId) => {
        setSong(prev => ({
            ...prev,
            phrases: prev.phrases.filter(p => p.id !== phraseId)
        }));
    }, []);

    const splitPhrase = useCallback((phraseId, splitTime) => {
        setSong(prev => {
            const phraseIndex = prev.phrases.findIndex(p => p.id === phraseId);
            if (phraseIndex === -1) return prev;

            const phrase = prev.phrases[phraseIndex];
            const beatsPerMeasure = quarterNotesPerMeasure(prev.timeSignature);
            const newPhraseName = `Phrase ${String.fromCharCode(65 + prev.phrases.length)}`;
            const splitMeasure = Math.round(splitTime / beatsPerMeasure);
            if (Math.abs(splitTime - splitMeasure * beatsPerMeasure) > 1e-9) return prev;
            const result = splitPhraseAtMeasure(phrase, splitMeasure, beatsPerMeasure, newPhraseName);
            if (!result) return prev;
            const [updatedPhrase, newPhrase] = result;

            // Insert new phrase right after the current one
            const newPhrases = [...prev.phrases];
            newPhrases[phraseIndex] = updatedPhrase;
            newPhrases.splice(phraseIndex + 1, 0, newPhrase);

            return {
                ...prev,
                phrases: newPhrases
            };
        });
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

    const updateHandSeparators = useCallback((phraseId, separators) => {
        setSong(prev => ({
            ...prev,
            phrases: prev.phrases.map(p => {
                if (p.id !== phraseId) return p;
                return {
                    ...p,
                    handSeparators: separators
                };
            })
        }));
    }, []);

    const renamePhrasesInOrder = useCallback(() => {
        setSong(prev => ({
            ...prev,
            phrases: prev.phrases.map((p, index) => ({
                ...p,
                name: `Phrase ${String.fromCharCode(65 + index)}`
            }))
        }));
    }, []);

    const mergePhraseWithPrevious = useCallback((phraseId) => {
        setSong(prev => {
            const phraseIndex = prev.phrases.findIndex(p => p.id === phraseId);

            // Cannot merge if it's the first phrase or not found
            if (phraseIndex <= 0) return prev;

            const currentPhrase = prev.phrases[phraseIndex];
            const previousPhrase = prev.phrases[phraseIndex - 1];

            const beatsPerMeasure = quarterNotesPerMeasure(prev.timeSignature);
            const mergedPhrase = mergePhrases(previousPhrase, currentPhrase, beatsPerMeasure);

            // Update phrases array
            const newPhrases = [...prev.phrases];
            newPhrases[phraseIndex - 1] = mergedPhrase;
            newPhrases.splice(phraseIndex, 1); // Remove current phrase

            return {
                ...prev,
                phrases: newPhrases
            };
        });
    }, []);

    const reorderPhrases = useCallback((fromIndex, toIndex) => {
        setSong(prev => {
            const newPhrases = [...prev.phrases];
            const [movedPhrase] = newPhrases.splice(fromIndex, 1);
            newPhrases.splice(toIndex, 0, movedPhrase);

            return {
                ...prev,
                phrases: newPhrases
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
        splitPhrase,
        mergePhraseWithPrevious,
        addNoteToPhrase,
        removeNoteFromPhrase,
        updateNoteInPhrase,
        toggleHighlightedMeasure,
        updateHandSeparators,
        renamePhrasesInOrder,
        reorderPhrases
    };
}
