import React, { useState } from 'react';
import { PianoRoll } from './PianoRoll';
import { audioEngine } from '../services/AudioEngine';
import { parseMidiFile } from '../services/MidiService';

import { StorageService } from '../services/StorageService';

export function SongEditor({ song, updateSongMetadata, onImportSong, onSaveSong, addPhrase, removePhrase, addNoteToPhrase, removeNoteFromPhrase }) {
    const [activeTrack, setActiveTrack] = useState('melody'); // 'melody' | 'chords'
    const [isImporting, setIsImporting] = useState(false);

    const handlePlayPhrase = async (phrase) => {
        await audioEngine.initialize();
        audioEngine.playPhrase(phrase, song.tempo);
    };

    const handleStop = () => {
        audioEngine.stop();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const newSong = await parseMidiFile(file);
            onImportSong(newSong);
        } catch (error) {
            console.error("Error importing MIDI:", error);
            alert("Erreur lors de l'import du fichier MIDI.");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="song-editor">
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                    <h2 style={{ marginTop: 0, color: 'var(--text-accent)' }}>Détails du Morceau</h2>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={onSaveSong} style={{ backgroundColor: 'var(--accent-secondary)' }}>
                            💾 Sauvegarder
                        </button>
                        <button onClick={() => StorageService.exportSong(song)} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                            📤 Exporter
                        </button>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="file"
                                accept=".mid,.midi"
                                onChange={handleFileChange}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0,
                                    cursor: 'pointer',
                                    zIndex: 10
                                }}
                            />
                            <button style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)' }}>
                                {isImporting ? 'Importation...' : '📥 Importer MIDI'}
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Titre</label>
                        <input
                            type="text"
                            value={song.title}
                            onChange={(e) => updateSongMetadata({ title: e.target.value })}
                            style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Tempo (BPM)</label>
                        <input
                            type="number"
                            value={song.tempo}
                            onChange={(e) => updateSongMetadata({ tempo: parseInt(e.target.value) })}
                            style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Structure</h2>
                <button onClick={addPhrase}>+ Ajouter une phrase</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {song.phrases.map((phrase, index) => (
                    <div key={phrase.id} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>{phrase.name}</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handlePlayPhrase(phrase)} style={{ backgroundColor: 'var(--accent-primary)' }}>▶ Lecture</button>
                                <button onClick={handleStop}>⏹ Stop</button>
                                <button onClick={() => removePhrase(phrase.id)} style={{ backgroundColor: '#ef4444' }}>Supprimer</button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <button
                                    onClick={() => setActiveTrack('melody')}
                                    style={{
                                        flex: 1,
                                        backgroundColor: activeTrack === 'melody' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        opacity: activeTrack === 'melody' ? 1 : 0.7
                                    }}
                                >
                                    Mélodie (Main Droite)
                                </button>
                                <button
                                    onClick={() => setActiveTrack('chords')}
                                    style={{
                                        flex: 1,
                                        backgroundColor: activeTrack === 'chords' ? 'var(--accent-secondary)' : 'var(--bg-tertiary)',
                                        opacity: activeTrack === 'chords' ? 1 : 0.7
                                    }}
                                >
                                    Accords (Main Gauche)
                                </button>
                            </div>

                            <PianoRoll
                                phrase={phrase}
                                trackName={activeTrack}
                                onAddNote={addNoteToPhrase}
                                onRemoveNote={removeNoteFromPhrase}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
