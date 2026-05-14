/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import { useSong } from '../useSong';

/**
 * Context pour partager l'état du song dans toute l'application
 * Évite le props drilling et optimise les re-renders
 */

const SongContext = createContext(null);

/**
 * Provider pour le SongContext
 * Encapsule le hook useSong et expose l'état et les actions
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Composants enfants
 */
export function SongProvider({ children }) {
  // Utiliser le hook useSong existant
  const songState = useSong();

  // Mémoriser le contexte pour éviter re-renders inutiles
  // Seul le changement de song.id déclenche un re-render
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const contextValue = useMemo(() => {
    return {
      // Song data
      song: songState.song,

      // Metadata operations
      updateSongMetadata: songState.updateSongMetadata,
      setSongKey: songState.setSongKey,
      setTempo: songState.setTempo,

      // Phrase operations
      addPhrase: songState.addPhrase,
      updatePhrase: songState.updatePhrase,
      deletePhrase: songState.deletePhrase,
      movePhraseUp: songState.movePhraseUp,
      movePhraseDown: songState.movePhraseDown,
      splitPhrase: songState.splitPhrase,

      // Note operations
      addNote: songState.addNote,
      removeNote: songState.removeNote,
      updateNote: songState.updateNote,
      updateHandSeparators: songState.updateHandSeparators,

      // Song management
      loadSong: songState.loadSong,
      createNewSong: songState.createNewSong,
      saveSong: songState.saveSong,
      deleteSong: songState.deleteSong,
      importMidi: songState.importMidi,

      // Highlighted measures
      toggleHighlightMeasure: songState.toggleHighlightMeasure,
      clearHighlightedMeasures: songState.clearHighlightedMeasures
    };
  }, [
    // Only re-create context when song ID changes
    // This prevents unnecessary re-renders when only internal song data changes
    songState.song.id,
    // Keep references to functions (these should be stable from useSong)
    songState.updateSongMetadata,
    songState.setSongKey,
    songState.setTempo,
    songState.addPhrase,
    songState.updatePhrase,
    songState.deletePhrase,
    songState.movePhraseUp,
    songState.movePhraseDown,
    songState.splitPhrase,
    songState.addNote,
    songState.removeNote,
    songState.updateNote,
    songState.updateHandSeparators,
    songState.loadSong,
    songState.createNewSong,
    songState.saveSong,
    songState.deleteSong,
    songState.importMidi,
    songState.toggleHighlightMeasure,
    songState.clearHighlightedMeasures
  ]);

  return (
    <SongContext.Provider value={contextValue}>
      {children}
    </SongContext.Provider>
  );
}

/**
 * Hook pour accéder au SongContext
 * Utiliser ce hook dans les composants au lieu de passer props
 *
 * @returns {Object} Song state et actions
 * @throws {Error} Si utilisé hors d'un SongProvider
 *
 * @example
 * function MyComponent() {
 *   const { song, addPhrase } = useSongContext();
 *   return <div>{song.title}</div>;
 * }
 */
export function useSongContext() {
  const context = useContext(SongContext);

  if (context === null) {
    throw new Error(
      'useSongContext must be used within a SongProvider. ' +
      'Wrap your component tree with <SongProvider>.'
    );
  }

  return context;
}

/**
 * Selectors optimisés pour accéder à des parties spécifiques du state
 * Utilisez ces hooks au lieu de useSongContext() quand vous n'avez besoin
 * que d'une partie spécifique du state
 */

/**
 * Hook pour accéder uniquement aux métadonnées du song
 * Re-render uniquement quand les métadonnées changent
 */
export function useSongMetadata() {
  const { song, updateSongMetadata, setSongKey, setTempo } = useSongContext();

  return useMemo(() => ({
    title: song.title,
    artist: song.artist,
    key: song.key,
    tempo: song.tempo,
    createdAt: song.createdAt,
    updateSongMetadata,
    setSongKey,
    setTempo
  }), [
    song.title,
    song.artist,
    song.key,
    song.tempo,
    song.createdAt,
    updateSongMetadata,
    setSongKey,
    setTempo
  ]);
}

/**
 * Hook pour accéder uniquement aux phrases
 * Re-render uniquement quand les phrases changent
 */
export function useSongPhrases() {
  const {
    song,
    addPhrase,
    updatePhrase,
    deletePhrase,
    movePhraseUp,
    movePhraseDown,
    splitPhrase
  } = useSongContext();

  return useMemo(() => ({
    phrases: song.phrases,
    addPhrase,
    updatePhrase,
    deletePhrase,
    movePhraseUp,
    movePhraseDown,
    splitPhrase
  }), [
    song.phrases,
    addPhrase,
    updatePhrase,
    deletePhrase,
    movePhraseUp,
    movePhraseDown,
    splitPhrase
  ]);
}

/**
 * Hook pour accéder aux opérations sur les notes
 * Pas de re-render car ne dépend pas du state
 */
export function useSongNoteOperations() {
  const { addNote, removeNote, updateNote, updateHandSeparators } = useSongContext();

  return useMemo(() => ({
    addNote,
    removeNote,
    updateNote,
    updateHandSeparators
  }), [addNote, removeNote, updateNote, updateHandSeparators]);
}

/**
 * Hook pour accéder aux opérations de gestion des songs
 */
export function useSongManagement() {
  const { loadSong, createNewSong, saveSong, deleteSong, importMidi } = useSongContext();

  return useMemo(() => ({
    loadSong,
    createNewSong,
    saveSong,
    deleteSong,
    importMidi
  }), [loadSong, createNewSong, saveSong, deleteSong, importMidi]);
}

/**
 * Hook pour accéder aux mesures surlignées
 */
export function useSongHighlights() {
  const { song, toggleHighlightMeasure, clearHighlightedMeasures } = useSongContext();

  return useMemo(() => ({
    highlightedMeasures: song.highlightedMeasures || [],
    toggleHighlightMeasure,
    clearHighlightedMeasures
  }), [song.highlightedMeasures, toggleHighlightMeasure, clearHighlightedMeasures]);
}

/**
 * Hook pour accéder uniquement au song (lecture seule)
 * Utilisez ce hook quand vous avez seulement besoin de lire les données
 */
export function useSongData() {
  const { song } = useSongContext();
  return song;
}
