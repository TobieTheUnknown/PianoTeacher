import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { SongLibrary } from './components/SongLibrary';
import { Settings } from './components/Settings';
import { TopNavBar } from './components/TopNavBar';
import { BottomTabBar } from './components/BottomTabBar';
import { AudioLoadingIndicator } from './components/AudioLoadingIndicator';
import { PageLoadingFallback } from './components/LoadingFallback';
import { Onboarding } from './components/Onboarding';
import { OnboardingService } from './services/OnboardingService';
import { StorageService } from './services/StorageService';
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
  const [showOnboarding, setShowOnboarding] = useState(() => !OnboardingService.isComplete());

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

  const handleLearnSong = (id) => {
    loadSong(id);
    setMode('learn');
  };

  const handleLoadSongToLivePlay = (id) => {
    loadSong(id);
    setMode('liveplay');
  };

  const handleNewSong = () => {
    newSong();
    setMode('editor');
  };

  const handleEditSong = (id) => {
    loadSong(id);
    setMode('editor');
  };

  const handleViewSheet = (id) => {
    loadSong(id);
    setMode('sheet');
  };

  const handleRestartOnboarding = () => {
    setShowSettings(false);
    setShowOnboarding(true);
  };

  const handleChangeMode = (nextMode) => {
    if ((nextMode === 'sheet' || nextMode === 'learn' || nextMode === 'liveplay') && !song?.phrases?.length) {
      const fallbackSong = [...StorageService.getSongs()].sort((a, b) => (
        new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
      ))[0];
      if (!fallbackSong) {
        setMode('library');
        return;
      }
      loadSong(fallbackSong.id);
    }
    setMode(nextMode);
  };

  const handleLivePlayFullscreenChange = useCallback((isFullscreen) => {
    setIsLivePlayFullscreen(isFullscreen);
  }, []);

  return (
    <Layout>
      {/* Desktop Navigation */}
      <TopNavBar
        activeMode={mode}
        onChangeMode={handleChangeMode}
        showSettings={showSettings}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main>
        {mode === 'library' && (
          <SongLibrary
            onLearnSong={handleLearnSong}
            onEditSong={handleEditSong}
            onViewSheet={handleViewSheet}
            onLoadSongToLivePlay={handleLoadSongToLivePlay}
            onNewSong={handleNewSong}
            isMobile={isMobile}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
        <Suspense fallback={<PageLoadingFallback />}>
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
            onUpdateHandSeparators={updateHandSeparators}
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
        onChangeMode={handleChangeMode}
        visible={!isLivePlayFullscreen}
      />

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} onRestartOnboarding={handleRestartOnboarding} />

      <AudioLoadingIndicator />

      {showOnboarding && <Onboarding onComplete={() => { setShowOnboarding(false); setMode('library'); }} />}
    </Layout>
  );
}

export default App;
