import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from './components/Layout';
import { LiveLearning } from './components/LiveLearning';
import { SongLibrary } from './components/SongLibrary';
import { SynthesiaViewOptimized as SynthesiaView } from './components/SynthesiaViewOptimized';
import { Settings } from './components/Settings';
import { BottomTabBar } from './components/BottomTabBar';
import { AudioLoadingIndicator } from './components/AudioLoadingIndicator';
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

  const handleLoadSongToSynthesia = (id) => {
    loadSong(id);
    navigateTo('synthesia');
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
            isMobile={true}
          />
        )}
        {mode === 'synthesia' && (
          <SynthesiaView
            song={song}
            onFullscreenChange={handleSynthesiaFullscreenChange}
            onBack={() => navigateTo('library')}
          />
        )}
      </main>

      <BottomTabBar
        activeMode={mode}
        onChangeMode={navigateTo}
        visible={!isSynthesiaFullscreen}
        onOpenSettings={() => setShowSettings(true)}
      />

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <AudioLoadingIndicator />
    </Layout>
  );
}

export default AppMobile;
