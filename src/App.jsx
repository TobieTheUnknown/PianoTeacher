import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { SongEditor } from './components/SongEditor';
import { LiveLearning } from './components/LiveLearning';
import { SongLibrary } from './components/SongLibrary';
import { SynthesiaView } from './components/SynthesiaView';
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
    updateHandSeparators,
    renamePhrasesInOrder
  } = useSong();

  const [mode, setMode] = useState('library'); // 'library', 'edit', 'learn', 'synthesia'

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
        marginBottom: '3rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)'
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
        color: active ? 'white' : 'var(--text-secondary)',
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
