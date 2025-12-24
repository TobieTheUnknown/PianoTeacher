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
      {/* Premium Navigation with Glass Morphism */}
      <nav style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '4rem',
        position: 'sticky',
        top: '1.5rem',
        zIndex: 100,
        animation: 'fadeInScale 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.5s backwards'
      }}>
        <div style={{
          display: 'inline-flex',
          gap: '0.75rem',
          padding: '0.75rem',
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'blur(40px) saturate(180%)',
          border: '1.5px solid var(--glass-border-strong)',
          borderRadius: 'var(--radius-3xl)',
          boxShadow: 'var(--shadow-2xl), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
          position: 'relative'
        }}>
          {/* Glow effect behind nav */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '110%',
            height: '140%',
            background: 'radial-gradient(ellipse, rgba(167, 139, 250, 0.15) 0%, transparent 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
            zIndex: -1
          }} />

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
            active={mode === 'learn'}
            onClick={() => setMode('learn')}
            icon="📖"
            label="Apprentissage"
          />
          <NavButton
            active={mode === 'synthesia'}
            onClick={() => setMode('synthesia')}
            icon="🎹"
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

// Premium Navigation Button Component
function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '1rem 1.75rem',
        background: active ? 'var(--gradient-primary)' : 'transparent',
        color: active ? 'white' : 'var(--text-tertiary)',
        border: active ? 'none' : '1px solid transparent',
        borderRadius: 'var(--radius-2xl)',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '0.9375rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        transition: 'all var(--transition-normal)',
        boxShadow: active ? 'var(--shadow-glow-sm), var(--shadow-md)' : 'none',
        transform: active ? 'scale(1)' : 'scale(0.97)',
        whiteSpace: 'nowrap',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.borderColor = 'var(--border-accent)';
        } else {
          e.currentTarget.style.transform = 'scale(1.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-tertiary)';
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.transform = 'scale(0.97)';
          e.currentTarget.style.borderColor = 'transparent';
        } else {
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      <span style={{
        fontSize: '1.25rem',
        filter: active ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))' : 'none'
      }}>
        {icon}
      </span>
      <span style={{
        letterSpacing: '0.01em',
        textShadow: active ? '0 2px 10px rgba(0, 0, 0, 0.3)' : 'none'
      }}>
        {label}
      </span>

      {/* Active indicator glow */}
      {active && (
        <div style={{
          position: 'absolute',
          bottom: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.5)',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)'
        }} />
      )}
    </button>
  );
}

export default App;
