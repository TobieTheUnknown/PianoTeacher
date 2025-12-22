import React, { useState } from 'react';
import { PianoRoll } from './PianoRoll';
import { audioEngine } from '../services/AudioEngine';
import { parseMidiFile } from '../services/MidiService';

import { StorageService } from '../services/StorageService';

export function SongEditor({ song, onUpdateMetadata, onImportSong, onSaveSong, addNoteToPhrase, removeNoteFromPhrase, onUpdateNote, onUpdateHandSeparators }) {
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
            {/* Song Metadata Card */}
            <div className="card" style={{
                marginBottom: '3rem',
                background: 'linear-gradient(145deg, var(--bg-secondary) 0%, rgba(30, 36, 53, 0.9) 100%)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '2rem',
                    paddingBottom: '1.5rem',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <div>
                        <h2 style={{
                            marginTop: 0,
                            fontSize: '2rem',
                            background: 'var(--gradient-primary)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            marginBottom: '0.5rem'
                        }}>
                            Détails du Morceau
                        </h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            Configurez les informations de votre composition
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                            onClick={onSaveSong}
                            style={{
                                background: 'var(--gradient-success)',
                                color: 'white',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            <span>💾</span>
                            <span>Sauvegarder</span>
                        </button>
                        <button
                            onClick={() => StorageService.exportSong(song)}
                            style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span>📤</span>
                            <span>Exporter</span>
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
                            <button style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--accent-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span>📥</span>
                                <span>{isImporting ? 'Importation...' : 'Importer MIDI'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '2rem'
                }}>
                    <div className="form-group">
                        <label style={{
                            display: 'block',
                            marginBottom: '0.75rem',
                            color: 'var(--text-primary)',
                            fontWeight: '600',
                            fontSize: '0.9375rem'
                        }}>
                            🎵 Titre
                        </label>
                        <input
                            type="text"
                            value={song.title}
                            onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                            placeholder="Entrez le titre du morceau"
                        />
                    </div>
                    <div className="form-group">
                        <label style={{
                            display: 'block',
                            marginBottom: '0.75rem',
                            color: 'var(--text-primary)',
                            fontWeight: '600',
                            fontSize: '0.9375rem'
                        }}>
                            ⏱️ Tempo (BPM)
                        </label>
                        <input
                            type="number"
                            value={song.tempo}
                            onChange={(e) => onUpdateMetadata({ tempo: parseInt(e.target.value) })}
                            placeholder="120"
                        />
                    </div>
                </div>
            </div>

            {/* Piano Roll Section Header */}
            <div style={{
                marginBottom: '2rem'
            }}>
                <h2 style={{
                    margin: 0,
                    fontSize: '2rem',
                    background: 'var(--gradient-primary)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    Piano Roll
                </h2>
            </div>

            {/* Phrases List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {song.phrases.map((phrase, index) => (
                    <div
                        key={phrase.id}
                        className="card"
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            background: 'linear-gradient(145deg, var(--bg-secondary) 0%, rgba(30, 36, 53, 0.9) 100%)'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.5rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '1.5rem',
                                color: 'var(--text-primary)'
                            }}>
                                {phrase.name}
                            </h3>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => handlePlayPhrase(phrase)}
                                    style={{
                                        background: 'var(--gradient-primary)',
                                        color: 'white',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <span>▶</span>
                                    <span>Lecture</span>
                                </button>
                                <button
                                    onClick={handleStop}
                                    style={{
                                        backgroundColor: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    ⏹ Stop
                                </button>
                            </div>
                        </div>

                        {/* Piano Roll */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <PianoRoll
                                phrase={phrase}
                                onAddNote={addNoteToPhrase}
                                onRemoveNote={removeNoteFromPhrase}
                                onUpdateNote={onUpdateNote}
                                onUpdateHandSeparators={(separators) => onUpdateHandSeparators(phrase.id, separators)}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
