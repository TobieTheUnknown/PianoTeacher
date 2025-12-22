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

            // Split notes by track
            const beforeMelody = phrase.tracks.melody.filter(n => n.startTime < splitTime);
            const afterMelody = phrase.tracks.melody
                .filter(n => n.startTime >= splitTime)
                .map(n => ({ ...n, startTime: n.startTime - splitTime }));

            const beforeChords = phrase.tracks.chords.filter(n => n.startTime < splitTime);
            const afterChords = phrase.tracks.chords
                .filter(n => n.startTime >= splitTime)
                .map(n => ({ ...n, startTime: n.startTime - splitTime }));

            // Calculate new phrase lengths (in beats / 4 to get measures, assuming 4/4 time)
            const beatsPerMeasure = 4;
            const beforeLength = Math.ceil(splitTime / beatsPerMeasure);

            // Find the last note in the second phrase to determine its length
            const allAfterNotes = [...afterMelody, ...afterChords];
            const maxEndTime = allAfterNotes.length > 0
                ? Math.max(...allAfterNotes.map(n => n.startTime + n.duration))
                : beatsPerMeasure;
            const afterLength = Math.ceil(maxEndTime / beatsPerMeasure);

            // Create updated first phrase
            const updatedPhrase = {
                ...phrase,
                length: beforeLength,
                tracks: {
                    melody: beforeMelody,
                    chords: beforeChords
                }
            };

            // Create new second phrase
            const newPhraseName = `Phrase ${String.fromCharCode(65 + prev.phrases.length)}`;
            const newPhrase = createPhrase(newPhraseName, afterLength);
            newPhrase.tracks.melody = afterMelody;
            newPhrase.tracks.chords = afterChords;

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
        addNoteToPhrase,
        removeNoteFromPhrase,
        updateNoteInPhrase,
        toggleHighlightedMeasure,
        updateHandSeparators,
        renamePhrasesInOrder
    };
}
