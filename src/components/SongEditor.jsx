import React, { useState, useEffect, useRef } from 'react';
import { PianoRoll } from './PianoRoll';
import { audioEngine } from '../services/AudioEngine';
import { parseMidiFile, exportToMidi } from '../services/MidiService';

import { StorageService } from '../services/StorageService';

export function SongEditor({ song, onUpdateMetadata, onImportSong, onSaveSong, onAddPhrase, onSplitPhrase, onRenamePhrasesInOrder, addNoteToPhrase, removeNoteFromPhrase, onUpdateNote, onUpdateHandSeparators }) {
    const [isImporting, setIsImporting] = useState(false);
    const [splitMode, setSplitMode] = useState(null); // { phraseId, splitTime }
    const [splitTime, setSplitTime] = useState('');
    const [isBatchSplit, setIsBatchSplit] = useState(false); // Toggle between single and batch split
    const [showImportExportModal, setShowImportExportModal] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'

    // Refs for auto-save
    const isInitialMount = useRef(true);
    const saveTimeoutRef = useRef(null);

    // Pre-initialize MIDI sounds when the editor loads
    useEffect(() => {
        audioEngine.initialize().catch(error => {
            console.error('Failed to initialize audio engine:', error);
        });
    }, []);

    // Auto-save with debouncing
    useEffect(() => {
        // Skip initial mount to avoid saving on first load
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Clear previous timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set status to unsaved
        setSaveStatus('unsaved');

        // Set timeout for auto-save (1.5 seconds after last change)
        saveTimeoutRef.current = setTimeout(() => {
            setSaveStatus('saving');
            onSaveSong();
            // Wait a bit before showing "saved" to give visual feedback
            setTimeout(() => {
                setSaveStatus('saved');
            }, 500);
        }, 1500);

        // Cleanup timeout on unmount
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [song, onSaveSong]);

    const handlePlayPhrase = async (phrase) => {
        await audioEngine.initialize();
        audioEngine.playPhrase(phrase, song.tempo);
    };

    const handleStop = () => {
        audioEngine.stop();
    };

    const handleStartSplit = (phraseId) => {
        setSplitMode({ phraseId });
        setSplitTime('');
    };

    const handleCancelSplit = () => {
        setSplitMode(null);
        setSplitTime('');
    };

    const handleConfirmSplit = () => {
        if (!splitMode || !splitTime) return;
        const interval = parseFloat(splitTime);
        if (isNaN(interval) || interval <= 0) {
            alert('Veuillez entrer une mesure valide');
            return;
        }

        const beatsPerMeasure = 4;

        if (isBatchSplit) {
            // Batch split: split every X measures
            const phrase = song.phrases.find(p => p.id === splitMode.phraseId);
            if (!phrase) return;

            const phraseLengthInMeasures = phrase.length;
            const splitPoints = [];

            // Generate split points at every interval
            for (let measure = interval; measure < phraseLengthInMeasures; measure += interval) {
                splitPoints.push(measure * beatsPerMeasure);
            }

            // Split from the end to avoid index shifting issues
            splitPoints.reverse().forEach(timeInBeats => {
                onSplitPhrase(splitMode.phraseId, timeInBeats);
            });

            // After all splits are done, rename all phrases in alphabetical order
            // Use setTimeout to ensure all state updates have completed
            setTimeout(() => {
                onRenamePhrasesInOrder();
            }, 100);
        } else {
            // Single split at specified measure
            const timeInBeats = interval * beatsPerMeasure;
            onSplitPhrase(splitMode.phraseId, timeInBeats);
        }

        setSplitMode(null);
        setSplitTime('');
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

    const handleOpenImportExport = () => {
        setShowImportExportModal(true);
    };

    const handleImportJson = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedSong = JSON.parse(event.target.result);
                onImportSong(importedSong);
                setShowImportExportModal(false);
                alert("Morceau importé avec succès !");
            } catch (error) {
                alert("Erreur lors de l'import du fichier JSON.");
            }
        };
        reader.readAsText(file);
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

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Save Status Indicator */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            backgroundColor: saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.1)' :
                                           saveStatus === 'saving' ? 'rgba(59, 130, 246, 0.1)' :
                                           'rgba(251, 191, 36, 0.1)',
                            color: saveStatus === 'saved' ? 'rgb(16, 185, 129)' :
                                   saveStatus === 'saving' ? 'rgb(59, 130, 246)' :
                                   'rgb(251, 191, 36)',
                            border: `1px solid ${saveStatus === 'saved' ? 'rgba(16, 185, 129, 0.3)' :
                                                 saveStatus === 'saving' ? 'rgba(59, 130, 246, 0.3)' :
                                                 'rgba(251, 191, 36, 0.3)'}`,
                            transition: 'all 0.3s ease'
                        }}>
                            <span>{
                                saveStatus === 'saved' ? '✓' :
                                saveStatus === 'saving' ? '⏳' :
                                '✎'
                            }</span>
                            <span>{
                                saveStatus === 'saved' ? 'Sauvegardé' :
                                saveStatus === 'saving' ? 'Sauvegarde...' :
                                'Modifications non sauvegardées'
                            }</span>
                        </div>

                        <button
                            onClick={handleOpenImportExport}
                            style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem 1.5rem',
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.9375rem'
                            }}
                        >
                            <span>📁</span>
                            <span>Import/Export</span>
                        </button>
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
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
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
                <button
                    onClick={onAddPhrase}
                    style={{
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9375rem',
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                        transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 0 30px rgba(59, 130, 246, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.3)';
                    }}
                >
                    <span>➕</span>
                    <span>Ajouter une phrase</span>
                </button>
            </div>

            {/* Empty State */}
            {song.phrases.length === 0 && (
                <div className="card" style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    background: 'linear-gradient(145deg, var(--bg-secondary) 0%, rgba(30, 36, 53, 0.9) 100%)',
                    border: '2px dashed var(--border-color)'
                }}>
                    <div style={{
                        fontSize: '4rem',
                        marginBottom: '1.5rem',
                        opacity: 0.5
                    }}>
                        🎹
                    </div>
                    <h3 style={{
                        marginTop: 0,
                        marginBottom: '1rem',
                        fontSize: '1.5rem',
                        color: 'var(--text-primary)'
                    }}>
                        Aucune phrase pour le moment
                    </h3>
                    <p style={{
                        margin: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '1rem',
                        marginBottom: '2rem'
                    }}>
                        Commencez par créer une nouvelle phrase ou importez un fichier MIDI
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={onAddPhrase}
                            style={{
                                background: 'var(--gradient-primary)',
                                color: 'white',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.875rem 1.75rem',
                                fontSize: '1rem'
                            }}
                        >
                            <span>➕</span>
                            <span>Créer une phrase</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Phrases List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {song.phrases.map((phrase) => (
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
                                <button
                                    onClick={() => handleStartSplit(phrase.id)}
                                    disabled={splitMode !== null}
                                    style={{
                                        backgroundColor: splitMode?.phraseId === phrase.id ? 'var(--accent-secondary)' : 'var(--bg-elevated)',
                                        border: '1px solid var(--accent-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        opacity: splitMode !== null && splitMode?.phraseId !== phrase.id ? 0.5 : 1,
                                        cursor: splitMode !== null && splitMode?.phraseId !== phrase.id ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <span>✂️</span>
                                    <span>Découper</span>
                                </button>
                            </div>
                        </div>

                        {/* Split Controls */}
                        {splitMode?.phraseId === phrase.id && (
                            <div style={{
                                padding: '1.5rem',
                                marginBottom: '1.5rem',
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '2px solid var(--accent-secondary)',
                                borderRadius: 'var(--radius-lg)'
                            }}>
                                <h4 style={{
                                    margin: '0 0 1rem 0',
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)'
                                }}>
                                    🎯 Mode Découpage
                                </h4>
                                <p style={{
                                    margin: '0 0 1rem 0',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {isBatchSplit
                                        ? "Découpez la phrase toutes les X mesures. Chaque segment deviendra une nouvelle phrase."
                                        : "Entrez la mesure où découper la phrase. Tout ce qui est avant restera dans la phrase actuelle, tout ce qui est après sera déplacé dans une nouvelle phrase."
                                    }
                                </p>

                                {/* Batch Split Toggle */}
                                <div style={{
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem',
                                    background: 'var(--bg-elevated)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-light)'
                                }}>
                                    <input
                                        type="checkbox"
                                        id="batch-split"
                                        checked={isBatchSplit}
                                        onChange={(e) => setIsBatchSplit(e.target.checked)}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <label htmlFor="batch-split" style={{
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        color: 'var(--text-primary)',
                                        fontWeight: '600'
                                    }}>
                                        Découper toutes les X mesures
                                    </label>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1', minWidth: '200px' }}>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            color: 'var(--text-primary)',
                                            fontWeight: '600'
                                        }}>
                                            {isBatchSplit ? "Intervalle (mesures)" : "Mesure de découpage"}
                                        </label>
                                        <input
                                            type="number"
                                            value={splitTime}
                                            onChange={(e) => setSplitTime(e.target.value)}
                                            placeholder={isBatchSplit ? "Ex: 4" : "Ex: 2"}
                                            step="1"
                                            min="1"
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                fontSize: '1rem'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            onClick={handleConfirmSplit}
                                            style={{
                                                background: 'var(--gradient-success)',
                                                color: 'white',
                                                border: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.75rem 1.5rem',
                                                fontWeight: '600'
                                            }}
                                        >
                                            <span>✓</span>
                                            <span>Valider</span>
                                        </button>
                                        <button
                                            onClick={handleCancelSplit}
                                            style={{
                                                backgroundColor: 'var(--bg-elevated)',
                                                border: '1px solid var(--border-light)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.75rem 1.5rem'
                                            }}
                                        >
                                            <span>✗</span>
                                            <span>Annuler</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Piano Roll */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <PianoRoll
                                phrase={phrase}
                                keySignature={song.key}
                                onAddNote={addNoteToPhrase}
                                onRemoveNote={removeNoteFromPhrase}
                                onUpdateNote={onUpdateNote}
                                onUpdateHandSeparators={(separators) => onUpdateHandSeparators(phrase.id, separators)}
                                onSplit={() => handleStartSplit(phrase.id)}
                                isSplitMode={splitMode?.phraseId === phrase.id}
                                splitTime={splitTime}
                                onSplitTimeChange={setSplitTime}
                                onConfirmSplit={handleConfirmSplit}
                                onCancelSplit={handleCancelSplit}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Comprehensive Import/Export Modal */}
            {showImportExportModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem'
                }}
                onClick={() => setShowImportExportModal(false)}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: '900px',
                            width: '100%',
                            maxHeight: '85vh',
                            overflow: 'auto',
                            padding: '2rem'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginBottom: '2rem', color: 'var(--accent-primary)', fontSize: '1.75rem' }}>
                            📁 Import / Export
                        </h2>

                        {/* MIDI Section */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                🎹 Import MIDI
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                Importer un fichier MIDI pour créer un nouveau morceau
                            </p>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
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
                                    background: 'var(--gradient-primary)',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}>
                                    <span>📥</span>
                                    <span>{isImporting ? 'Importation...' : 'Choisir un fichier MIDI'}</span>
                                </button>
                            </div>
                        </div>

                        {/* MIDI Export Section */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                🎵 Export MIDI
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                Exporter votre morceau au format MIDI pour l'utiliser dans d'autres logiciels
                            </p>
                            <button
                                onClick={() => {
                                    try {
                                        exportToMidi(song);
                                        alert('Fichier MIDI téléchargé !');
                                    } catch (error) {
                                        alert('Erreur lors de l\'export MIDI: ' + error.message);
                                    }
                                }}
                                style={{
                                    background: 'var(--gradient-primary)',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                <span>📤</span>
                                <span>Exporter MIDI</span>
                            </button>
                        </div>

                        {/* JSON Section */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📄 Export / Import JSON
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                Format JSON lisible pour sauvegarder ou partager vos morceaux
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => {
                                        StorageService.exportSong(song);
                                        alert('Fichier JSON téléchargé !');
                                    }}
                                    style={{
                                        background: 'var(--gradient-success)',
                                        color: 'white',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    <span>📤</span>
                                    <span>Exporter JSON</span>
                                </button>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleImportJson}
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
                                        border: '1px solid var(--border-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}>
                                        <span>📥</span>
                                        <span>Importer JSON</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setShowImportExportModal(false)}
                                style={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-light)',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
