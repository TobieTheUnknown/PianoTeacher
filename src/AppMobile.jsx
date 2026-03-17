import React, { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { LiveLearning } from './components/LiveLearning';
import { SongLibrary } from './components/SongLibrary';
import { SynthesiaViewOptimized as SynthesiaView } from './components/SynthesiaViewOptimized';
import { Settings } from './components/Settings';
import { BottomTabBar } from './components/BottomTabBar';
import { useSong } from './useSong';
import { useMidiAudio } from './hooks/useMidiAudio';

function AppMobile() {
  const {
    song,
    loadSong,
    saveSong,
    toggleHighlightedMeasure,
  } = useSong();

  const [mode, setMode] = useState('library');
  const [showSettings, setShowSettings] = useState(false);
  const [isSynthesiaFullscreen, setIsSynthesiaFullscreen] = useState(false);

  useMidiAudio();

  const handleLoadSongToLearn = (id) => {
    loadSong(id);
    setMode('learn');
  };

  const handleLoadSongToSynthesia = (id) => {
    loadSong(id);
    setMode('synthesia');
  };

  const handleSynthesiaFullscreenChange = useCallback((isFullscreen) => {
    setIsSynthesiaFullscreen(isFullscreen);
  }, []);

  return (
    <Layout hideMobileHeader={true}>
      <main style={{ paddingBottom: '64px' }}>
        {mode === 'library' && (
          <SongLibrary
            onLoadSong={handleLoadSongToLearn}
            onLoadSongToSynthesia={handleLoadSongToSynthesia}
            onNewSong={null}
            isMobile={true}
          />
        )}
        {mode === 'learn' && (
          <LiveLearning
            song={song}
            onToggleHighlight={toggleHighlightedMeasure}
          />
        )}
        {mode === 'synthesia' && (
          <SynthesiaView
            song={song}
            onFullscreenChange={handleSynthesiaFullscreenChange}
            onBack={() => setMode('library')}
          />
        )}
      </main>

      <BottomTabBar
        activeMode={mode}
        onChangeMode={setMode}
        visible={!isSynthesiaFullscreen}
        onOpenSettings={() => setShowSettings(true)}
      />

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </Layout>
  );
}

export default AppMobile;
