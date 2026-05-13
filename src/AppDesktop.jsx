import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { SongLibrary } from './components/SongLibrary';
import { Settings } from './components/Settings';
import { TopNavBar } from './components/TopNavBar';
import { BottomTabBar } from './components/BottomTabBar';
import { AudioLoadingIndicator } from './components/AudioLoadingIndicator';
import { PageLoadingFallback } from './components/LoadingFallback';
import { useDeviceContext } from './hooks/useDeviceContext';
import { useSong } from './useSong';
import { useMidiAudio } from './hooks/useMidiAudio';

// Lazy load heavy pages. Only Library ships in the initial bundle.
const SongEditor = lazy(() => import('./components/SongEditor').then(m => ({ default: m.SongEditor })));
const LiveLearning = lazy(() => import('./components/LiveLearning').then(m => ({ default: m.LiveLearning })));
const SheetMusicLearning = lazy(() => import('./components/SheetMusicLearning').then(m => ({ default: m.SheetMusicLearning })));
const LivePlayView = lazy(() => import('./components/LivePlayViewOptimized').then(m => ({ default: m.LivePlayViewOptimized })));

function App() {
  const {
    song,
    updateSongMetadata,
    importSong,
    newSong,
    loadSong,
    saveSong,
    addPhrase,
    splitPhrase,
    mergePhraseWithPrevious,
    addNoteToPhrase,
    removeNoteFromPhrase,
    updateNoteInPhrase,
    toggleHighlightedMeasure,
    updateHandSeparators,
    renamePhrasesInOrder,
    reorderPhrases
  } = useSong();

  const [mode, setMode] = useState('library');
  const [showSettings, setShowSettings] = useState(false);
  const [isLivePlayFullscreen, setIsLivePlayFullscreen] = useState(false);

  const { isMobile } = useDeviceContext();

  // Enable global MIDI audio (works across all pages)
  useMidiAudio();

  // Load saved font settings on mount
  useEffect(() => {
    const savedFontSize = localStorage.getItem('piano-teacher-font-size');
    const savedFontFamily = localStorage.getItem('piano-teacher-font-family');

    if (savedFontSize) {
      document.documentElement.style.fontSize = `${savedFontSize}px`;
    }
    if (savedFontFamily) {
      document.documentElement.style.fontFamily = savedFontFamily;
    }
  }, []);

  const handleLoadSong = (id) => {
    loadSong(id);
    setMode(isMobile ? 'learn' : 'edit');
  };

  const handleLoadSongToLivePlay = (id) => {
    loadSong(id);
    setMode('liveplay');
  };

  const handleNewSong = () => {
    newSong();
    setMode('edit');
  };

  const handleLivePlayFullscreenChange = useCallback((isFullscreen) => {
    setIsLivePlayFullscreen(isFullscreen);
  }, []);

  return (
    <Layout hideMobileHeader={isMobile}>
      {/* Desktop Navigation */}
      <TopNavBar
        activeMode={mode}
        onChangeMode={setMode}
        showSettings={showSettings}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main style={isMobile ? { paddingBottom: '64px' } : undefined}>
        {mode === 'library' && (
          <SongLibrary
            onLoadSong={handleLoadSong}
            onLoadSongToLivePlay={handleLoadSongToLivePlay}
            onNewSong={handleNewSong}
            isMobile={isMobile}
          />
        )}
        <Suspense fallback={<PageLoadingFallback />}>
        {mode === 'edit' && (
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
            onUpdateHandSeparators={updateHandSeparators}
            onReorderPhrases={reorderPhrases}
            readOnly={isMobile}
          />
        )}
        {mode === 'learn' && (
          <LiveLearning song={song} onToggleHighlight={toggleHighlightedMeasure} />
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
            isMobile={isMobile}
            readOnly={false}
          />
        )}
        {mode === 'sheet' && (
          <SheetMusicLearning song={song} isMobile={isMobile} />
        )}
        {mode === 'liveplay' && (
          <LivePlayView
            song={song}
            onFullscreenChange={handleLivePlayFullscreenChange}
            onBack={() => setMode('library')}
          />
        )}
        </Suspense>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar
        activeMode={mode}
        onChangeMode={setMode}
        visible={!isLivePlayFullscreen}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <AudioLoadingIndicator />
    </Layout>
  );
}

export default App;
