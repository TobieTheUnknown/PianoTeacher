import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SongEditor } from './components/SongEditor';
import { LiveLearning } from './components/LiveLearning';
import { SongLibrary } from './components/SongLibrary';
import { SynthesiaViewOptimized as SynthesiaView } from './components/SynthesiaViewOptimized';
import { Settings } from './components/Settings';
import { SheetMusicExporter } from './components/SheetMusicExporter';
import { useSong } from './useSong';
import { useMidiAudio } from './hooks/useMidiAudio';

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

  const [mode, setMode] = useState('library'); // 'library', 'edit', 'learn', 'synthesia', 'export'
  const [showSettings, setShowSettings] = useState(false);

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
    setMode('edit');
  };

  const handleNewSong = () => {
    newSong();
    setMode('edit');
  };

  return (
    <Layout>
      {/* Navigation */}
      <nav className="nav-bar">
        <div className="nav-bar-inner">
          <NavButton
            active={mode === 'library'}
            onClick={() => setMode('library')}
            label="Bibliothèque"
            icon="📚"
          />
          <NavButton
            active={mode === 'edit'}
            onClick={() => setMode('edit')}
            label="Éditeur"
            icon="✏️"
          />
          <NavButton
            active={mode === 'learn'}
            onClick={() => setMode('learn')}
            label="Apprentissage"
            icon="🎹"
          />
          <NavButton
            active={mode === 'synthesia'}
            onClick={() => setMode('synthesia')}
            label="Synthesia"
            icon="🎮"
          />
          <NavButton
            active={mode === 'export'}
            onClick={() => setMode('export')}
            label="Export"
            icon="🎵"
          />
          <NavButton
            active={showSettings}
            onClick={() => setShowSettings(true)}
            label="Réglages"
            icon="⚙️"
          />
        </div>
      </nav>

      <main>
        {mode === 'library' && (
          <SongLibrary onLoadSong={handleLoadSong} onNewSong={handleNewSong} />
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
          />
        )}
        {mode === 'learn' && (
          <LiveLearning song={song} onToggleHighlight={toggleHighlightedMeasure} />
        )}
        {mode === 'synthesia' && (
          <SynthesiaView song={song} />
        )}
        {mode === 'export' && (
          <SheetMusicExporter song={song} />
        )}
      </main>

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </Layout>
  );
}

// Minimal Navigation Button
function NavButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      className="nav-button"
      style={{
        padding: '0.5rem 1.25rem',
        background: active ? 'var(--accent-primary)' : 'transparent',
        color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontWeight: active ? '500' : '400',
        fontSize: '0.875rem',
        transition: 'all var(--transition-normal)',
        letterSpacing: '0.01em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.background = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {icon && <span className="nav-button-icon">{icon}</span>}
      <span className="nav-button-label">{label}</span>
    </button>
  );
}

export default App;
