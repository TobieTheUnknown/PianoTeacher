import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { SongLibrary } from './components/SongLibrary';
import { Settings } from './components/Settings';
import { BottomTabBar } from './components/BottomTabBar';
import { AudioLoadingIndicator } from './components/AudioLoadingIndicator';
import { PageLoadingFallback } from './components/LoadingFallback';
import { useSong } from './useSong';
import { useMidiAudio } from './hooks/useMidiAudio';

// Lazy load heavy pages — only ship the Library page eagerly. Each lazy
// import becomes its own JS chunk so the initial load is much smaller.
const LiveLearning = lazy(() => import('./components/LiveLearning').then(m => ({ default: m.LiveLearning })));
const LivePlayView = lazy(() => import('./components/LivePlayViewOptimized').then(m => ({ default: m.LivePlayViewOptimized })));
const SongEditor = lazy(() => import('./components/SongEditor').then(m => ({ default: m.SongEditor })));
const SheetMusicLearning = lazy(() => import('./components/SheetMusicLearning').then(m => ({ default: m.SheetMusicLearning })));

function AppMobile() {
  const {
    song,
    updateSongMetadata,
    importSong,
    loadSong,
    saveSong,
    addPhrase,
    splitPhrase,
    mergePhraseWithPrevious,
    renamePhrasesInOrder,
    addNoteToPhrase,
    removeNoteFromPhrase,
    updateNoteInPhrase,
    toggleHighlightedMeasure,
    reorderPhrases,
  } = useSong();

  const [mode, setMode] = useState('library');
  const [showSettings, setShowSettings] = useState(false);
  const [isLivePlayFullscreen, setIsLivePlayFullscreen] = useState(false);

  useMidiAudio();

  // Android back button: push history state on mode change, handle popstate to go back
  const navigateTo = useCallback((newMode) => {
    if (newMode !== 'library') {
      window.history.pushState({ mode: newMode }, '');
    }
    setMode(newMode);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setMode('library');
      setShowSettings(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoadSongToLearn = (id) => {
    loadSong(id);
    navigateTo('learn');
  };

  const handleLoadSongToLivePlay = (id) => {
    loadSong(id);
    navigateTo('liveplay');
  };

  const handleLivePlayFullscreenChange = useCallback((isFullscreen) => {
    setIsLivePlayFullscreen(isFullscreen);
  }, []);

  return (
    <Layout hideMobileHeader={true}>
      <main style={{ paddingBottom: '64px' }}>
        {mode === 'library' && (
          <SongLibrary
            onLoadSong={handleLoadSongToLearn}
            onLoadSongToLivePlay={handleLoadSongToLivePlay}
            onNewSong={null}
            isMobile={true}
          />
        )}
        <Suspense fallback={<PageLoadingFallback />}>
          {mode === 'learn' && (
            <LiveLearning
              song={song}
              onToggleHighlight={toggleHighlightedMeasure}
              isMobile={true}
            />
          )}
          {mode === 'editor' && (
            <SongEditor
              song={song}
              onUpdateMetadata={updateSongMetadata}
              onImportSong={importSong}
              onSaveSong={saveSong}
              onAddPhrase={addPhrase}
              onSplitPhrase={splitPhrase}
              onMergePhraseWithPrevious={mergePhraseWithPrevious}
              onRenamePhrasesInOrder={renamePhrasesInOrder}
              addNoteToPhrase={addNoteToPhrase}
              removeNoteFromPhrase={removeNoteFromPhrase}
              onUpdateNote={updateNoteInPhrase}
              onReorderPhrases={reorderPhrases}
              isMobile={true}
              readOnly={false}
            />
          )}
          {mode === 'sheet' && (
            <SheetMusicLearning song={song} isMobile={true} />
          )}
          {mode === 'liveplay' && (
            <LivePlayView
              song={song}
              onFullscreenChange={handleLivePlayFullscreenChange}
              onBack={() => navigateTo('library')}
            />
          )}
        </Suspense>
      </main>

      <BottomTabBar
        activeMode={mode}
        onChangeMode={navigateTo}
        visible={!isLivePlayFullscreen}
        onOpenSettings={() => setShowSettings(true)}
      />

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <AudioLoadingIndicator />
    </Layout>
  );
}

export default AppMobile;
