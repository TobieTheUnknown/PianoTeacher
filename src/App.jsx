import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SongEditor } from './components/SongEditor';
import { LiveLearning } from './components/LiveLearning';
import { SongLibrary } from './components/SongLibrary';
import { SynthesiaView } from './components/SynthesiaView';
import { Settings } from './components/Settings';
import { useSong } from './useSong';

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
    renamePhrasesInOrder
  } = useSong();

  const [mode, setMode] = useState('library'); // 'library', 'edit', 'learn', 'synthesia'
  const [showSettings, setShowSettings] = useState(false);

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
      {/* Minimal Navigation */}
      <nav style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-color)',
        gap: '1rem'
      }}>
        <div style={{
          display: 'inline-flex',
          gap: '0.5rem',
          padding: '0.375rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <NavButton
            active={mode === 'library'}
            onClick={() => setMode('library')}
            label="Bibliothèque"
          />
          <NavButton
            active={mode === 'edit'}
            onClick={() => setMode('edit')}
            label="Éditeur"
          />
          <NavButton
            active={mode === 'learn'}
            onClick={() => setMode('learn')}
            label="Apprentissage"
          />
          <NavButton
            active={mode === 'synthesia'}
            onClick={() => setMode('synthesia')}
            label="Synthesia"
          />
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            fontSize: '1.1rem',
            transition: 'all var(--transition-fast)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          title="Paramètres"
        >
          ⚙️
        </button>
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
          />
        )}
        {mode === 'learn' && (
          <LiveLearning song={song} onToggleHighlight={toggleHighlightedMeasure} />
        )}
        {mode === 'synthesia' && (
          <SynthesiaView song={song} />
        )}
      </main>

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </Layout>
  );
}

// Minimal Navigation Button
function NavButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
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
        letterSpacing: '0.01em'
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
      {label}
    </button>
  );
}

export default App;
