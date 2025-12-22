import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { SongEditor } from './components/SongEditor';
import { SongViewer } from './components/SongViewer';
import { LiveLearning } from './components/LiveLearning';
import { SongLibrary } from './components/SongLibrary';
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
    removePhrase,
    splitPhrase,
    addNoteToPhrase,
    removeNoteFromPhrase,
    updateNoteInPhrase,
    toggleHighlightedMeasure,
    updateHandSeparators
  } = useSong();

  const [mode, setMode] = useState('library'); // 'library', 'edit', 'view', 'live'

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
      {/* Modern Navigation */}
      <nav style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '3rem',
        position: 'sticky',
        top: '1rem',
        zIndex: 100
      }}>
        <div style={{
          display: 'inline-flex',
          gap: '0.5rem',
          padding: '0.5rem',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-xl)'
        }}>
          <NavButton
            active={mode === 'library'}
            onClick={() => setMode('library')}
            icon="📚"
            label="Bibliothèque"
          />
          <NavButton
            active={mode === 'edit'}
            onClick={() => setMode('edit')}
            icon="✏️"
            label="Éditeur"
          />
          <NavButton
            active={mode === 'view'}
            onClick={() => setMode('view')}
            icon="🎵"
            label="Apprentissage"
          />
          <NavButton
            active={mode === 'live'}
            onClick={() => setMode('live')}
            icon="⚡"
            label="Live Learning"
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
            addNoteToPhrase={addNoteToPhrase}
            removeNoteFromPhrase={removeNoteFromPhrase}
            onUpdateNote={updateNoteInPhrase}
            onUpdateHandSeparators={updateHandSeparators}
          />
        )}
        {mode === 'view' && (
          <SongViewer song={song} />
        )}
        {mode === 'live' && (
          <LiveLearning song={song} onToggleHighlight={toggleHighlightedMeasure} />
        )}
      </main>
    </Layout>
  );
}

// Navigation Button Component
function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.75rem 1.5rem',
        background: active ? 'var(--gradient-primary)' : 'transparent',
        color: active ? 'white' : 'var(--text-secondary)',
        border: 'none',
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '0.9375rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all var(--transition-fast)',
        boxShadow: active ? 'var(--shadow-glow)' : 'none',
        transform: active ? 'scale(1)' : 'scale(0.95)',
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default App;
