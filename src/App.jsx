import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Layout } from './components/Layout';
import { SongEditor } from './components/SongEditor';
import { LiveLearning } from './components/LiveLearning';
import { SongLibrary } from './components/SongLibrary';
import { SynthesiaViewOptimized as SynthesiaView } from './components/SynthesiaViewOptimized';
import { Settings } from './components/Settings';
import { TopNavBar } from './components/TopNavBar';
import { BottomTabBar } from './components/BottomTabBar';
import { useDeviceContext } from './hooks/useDeviceContext';
import { useSong } from './useSong';
import { useMidiAudio } from './hooks/useMidiAudio';

// Lazy-load SheetMusicExporter (pulls in VexFlow 100KB+, not needed on mobile)
const SheetMusicExporter = React.lazy(() =>
  import('./components/SheetMusicExporter').then(m => ({ default: m.SheetMusicExporter }))
);

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
  const [isSynthesiaFullscreen, setIsSynthesiaFullscreen] = useState(false);

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
    // On mobile, go to read-only view instead of editor
    setMode(isMobile ? 'edit' : 'edit');
  };

  const handleNewSong = () => {
    newSong();
    setMode('edit');
  };

  const handleSynthesiaFullscreenChange = useCallback((isFullscreen) => {
    setIsSynthesiaFullscreen(isFullscreen);
  }, []);

  // On mobile, hide export tab — accessible from library only
  const shouldShowExport = !isMobile && mode === 'export';

  return (
    <Layout hideMobileHeader={isMobile}>
      {/* Desktop Navigation */}
      <TopNavBar
        activeMode={mode}
        onChangeMode={setMode}
        showSettings={showSettings}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main>
        {mode === 'library' && (
          <SongLibrary
            onLoadSong={handleLoadSong}
            onNewSong={handleNewSong}
            isMobile={isMobile}
          />
        )}
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
        {mode === 'synthesia' && (
          <SynthesiaView
            song={song}
            onFullscreenChange={handleSynthesiaFullscreenChange}
          />
        )}
        {shouldShowExport && (
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>}>
            <SheetMusicExporter song={song} />
          </Suspense>
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar
        activeMode={mode}
        onChangeMode={setMode}
        visible={!isSynthesiaFullscreen}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </Layout>
  );
}

export default App;
