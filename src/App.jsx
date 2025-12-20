import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { SongEditor } from './components/SongEditor';
import { SongViewer } from './components/SongViewer';
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
    addNoteToPhrase,
    removeNoteFromPhrase
  } = useSong();

  const [mode, setMode] = useState('library'); // 'library', 'edit', 'view'

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
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
          🎹 Piano Teacher
        </h1>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setMode('library')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'library' ? 'var(--bg-tertiary)' : 'transparent',
              color: mode === 'library' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Bibliothèque
          </button>
          <button
            onClick={() => setMode('edit')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'edit' ? 'var(--bg-tertiary)' : 'transparent',
              color: mode === 'edit' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Éditeur
          </button>
          <button
            onClick={() => setMode('view')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: mode === 'view' ? 'var(--bg-tertiary)' : 'transparent',
              color: mode === 'view' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Apprentissage
          </button>
        </nav>
      </header>

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
            onRemovePhrase={removePhrase}
            onAddNote={addNoteToPhrase}
            onRemoveNote={removeNoteFromPhrase}
          />
        )}
        {mode === 'view' && (
          <SongViewer song={song} />
        )}
      </main>
    </Layout>
  );
}

export default App;
