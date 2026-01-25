import React, { useState, useEffect, useRef } from 'react';
import { PianoRoll } from './PianoRoll';
import { audioEngine } from '../services/AudioEngine';
import { parseMidiFile } from '../services/MidiService';

import { StorageService } from '../services/StorageService';

export function SongEditor({ song, onUpdateMetadata, onImportSong, onSaveSong, onAddPhrase, onSplitPhrase, onMergePhraseWithPrevious, onRenamePhrasesInOrder, addNoteToPhrase, removeNoteFromPhrase, onUpdateNote, onReorderPhrases }) {
    const [isImporting, setIsImporting] = useState(false);
    const [splitMode, setSplitMode] = useState(null);
    const [splitTime, setSplitTime] = useState('');
    const [isBatchSplit, setIsBatchSplit] = useState(false);
    const [showImportExportModal, setShowImportExportModal] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [editingPhraseId, setEditingPhraseId] = useState(null);
    const [editingPhraseName, setEditingPhraseName] = useState('');
    const [playingPhraseId, setPlayingPhraseId] = useState(null); // Track which phrase is playing
    const isInitialMount = useRef(true);
    const saveTimeoutRef = useRef(null);

    useEffect(() => {
        audioEngine.initialize().catch(error => {
            console.error('Failed to initialize audio engine:', error);
        });
    }, []);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        setSaveStatus('unsaved');

        saveTimeoutRef.current = setTimeout(() => {
            setSaveStatus('saving');
            onSaveSong();
            setTimeout(() => {
                setSaveStatus('saved');
            }, 500);
        }, 1500);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [song, onSaveSong]);

    const handlePlayPhrase = async (phrase) => {
        await audioEngine.initialize();
        setPlayingPhraseId(phrase.id);
        // Calculate beatsPerMeasure from time signature
        const timeSignature = song.timeSignature || { numerator: 4, denominator: 4 };
        const beatsPerMeasure = (timeSignature.numerator / timeSignature.denominator) * 4;
        // stopAtEnd = true to automatically stop at end of the phrase
        // Pass a callback to clear playingPhraseId when playback ends
        audioEngine.playPhrase(phrase, song.tempo, null, true, () => {
            setPlayingPhraseId(null);
        }, beatsPerMeasure);
    };

    const handleStop = () => {
        audioEngine.stop();
        setPlayingPhraseId(null);
    };

    // Move phrase up/down
    const handleMovePhraseUp = (phraseIndex) => {
        if (phraseIndex > 0 && onReorderPhrases) {
            onReorderPhrases(phraseIndex, phraseIndex - 1);
        }
    };

    const handleMovePhraseDown = (phraseIndex) => {
        if (phraseIndex < song.phrases.length - 1 && onReorderPhrases) {
            onReorderPhrases(phraseIndex, phraseIndex + 1);
        }
    };

    // Rename phrase handlers
    const handleStartRename = (phrase) => {
        setEditingPhraseId(phrase.id);
        setEditingPhraseName(phrase.name);
    };

    const handleSaveRename = (phraseId) => {
        if (editingPhraseName.trim()) {
            const phraseIndex = song.phrases.findIndex(p => p.id === phraseId);
            if (phraseIndex !== -1) {
                const updatedPhrase = {
                    ...song.phrases[phraseIndex],
                    name: editingPhraseName.trim()
                };

                // Update via onUpdateMetadata to trigger save
                const newPhrases = [...song.phrases];
                newPhrases[phraseIndex] = updatedPhrase;
                onUpdateMetadata({ ...song, phrases: newPhrases });
            }
        }
        setEditingPhraseId(null);
        setEditingPhraseName('');
    };

    const handleCancelRename = () => {
        setEditingPhraseId(null);
        setEditingPhraseName('');
    };

    const handleStartSplit = (phraseId) => {
        setSplitMode({ phraseId });
        setSplitTime('');
    };

    const handleCancelSplit = () => {
        setSplitMode(null);
        setSplitTime('');
    };

    const handleUpdatePhraseLength = (phraseId, newLength) => {
        const phraseIndex = song.phrases.findIndex(p => p.id === phraseId);
        if (phraseIndex === -1) return;

        const updatedPhrase = {
            ...song.phrases[phraseIndex],
            length: newLength
        };

        const newPhrases = [...song.phrases];
        newPhrases[phraseIndex] = updatedPhrase;
        onUpdateMetadata({ ...song, phrases: newPhrases });
    };

    const handleConfirmSplit = () => {
        if (!splitMode || !splitTime) return;
        const interval = parseFloat(splitTime);
        if (isNaN(interval) || interval <= 0) {
            alert('Veuillez entrer une mesure valide');
            return;
        }

        const timeSignature = song.timeSignature || { numerator: 4, denominator: 4 };
        const beatsPerMeasure = (timeSignature.numerator / timeSignature.denominator) * 4;

        if (isBatchSplit) {
            const phrase = song.phrases.find(p => p.id === splitMode.phraseId);
            if (!phrase) return;

            const phraseLengthInMeasures = phrase.length;
            const splitPoints = [];

            for (let measure = interval; measure < phraseLengthInMeasures; measure += interval) {
                splitPoints.push(measure * beatsPerMeasure);
            }

            splitPoints.reverse().forEach(timeInBeats => {
                onSplitPhrase(splitMode.phraseId, timeInBeats);
            });

            setTimeout(() => {
                onRenamePhrasesInOrder();
            }, 100);
        } else {
            const timeInBeats = interval * beatsPerMeasure;
            onSplitPhrase(splitMode.phraseId, timeInBeats);
        }

        setSplitMode(null);
        setSplitTime('');
    };

    const handleMergeWithPrevious = (phraseId) => {
        if (window.confirm('Voulez-vous vraiment fusionner cette phrase avec la précédente ?')) {
            onMergePhraseWithPrevious(phraseId);
            setTimeout(() => {
                onRenamePhrasesInOrder();
            }, 100);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const newSong = await parseMidiFile(file);
            onImportSong(newSong);
            setShowImportExportModal(false); // Fermer le modal après import réussi
            alert("Fichier MIDI importé avec succès !");
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
            // eslint-disable-next-line no-unused-vars
            } catch (error) {
                alert("Erreur lors de l'import du fichier JSON.");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div>
            {/* Song Metadata */}
            <div className="card" style={{
                marginBottom: '2rem'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <div>
                        <h2 style={{
                            marginTop: 0,
                            fontSize: '1.5rem',
                            fontWeight: '400',
                            marginBottom: '0.5rem'
                        }}>
                            Détails du Morceau
                        </h2>
                        <p style={{
                            margin: 0,
                            color: 'var(--text-secondary)',
                            fontSize: '0.875rem',
                            fontWeight: '300'
                        }}>
                            Configurez les informations de votre composition
                        </p>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                        alignItems: 'center'
                    }}>
                        {/* Save Status */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-lg)',
                            fontSize: '0.8125rem',
                            fontWeight: '400',
                            backgroundColor: saveStatus === 'saved' ? 'rgba(22, 163, 74, 0.1)' :
                                           saveStatus === 'saving' ? 'rgba(37, 99, 235, 0.1)' :
                                           'rgba(202, 138, 4, 0.1)',
                            color: saveStatus === 'saved' ? '#16a34a' :
                                   saveStatus === 'saving' ? '#2563eb' :
                                   '#ca8a04',
                            border: `1px solid ${saveStatus === 'saved' ? '#16a34a' :
                                                 saveStatus === 'saving' ? '#2563eb' :
                                                 '#ca8a04'}`
                        }}>
                            <span style={{ fontSize: '0.75rem' }}>{
                                saveStatus === 'saved' ? '●' :
                                saveStatus === 'saving' ? '●' :
                                '●'
                            }</span>
                            <span>{
                                saveStatus === 'saved' ? 'Sauvegardé' :
                                saveStatus === 'saving' ? 'Sauvegarde...' :
                                'Non sauvegardé'
                            }</span>
                        </div>

                        <button onClick={handleOpenImportExport}>
                            Import/Export
                        </button>
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem'
                }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-primary)',
                            fontWeight: '400',
                            fontSize: '0.875rem'
                        }}>
                            Titre
                        </label>
                        <input
                            type="text"
                            value={song.title}
                            onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                            placeholder="Entrez le titre du morceau"
                        />
                    </div>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-primary)',
                            fontWeight: '400',
                            fontSize: '0.875rem'
                        }}>
                            Tempo (BPM)
                        </label>
                        <input
                            type="number"
                            value={song.tempo}
                            onChange={(e) => onUpdateMetadata({ tempo: parseInt(e.target.value) })}
                            placeholder="120"
                        />
                    </div>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-primary)',
                            fontWeight: '400',
                            fontSize: '0.875rem'
                        }}>
                            Signature rythmique
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="number"
                                value={song.timeSignature?.numerator || 4}
                                onChange={(e) => onUpdateMetadata({
                                    timeSignature: {
                                        ...song.timeSignature,
                                        numerator: parseInt(e.target.value) || 4
                                    }
                                })}
                                min="1"
                                max="16"
                                style={{ width: '60px', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>/</span>
                            <select
                                value={song.timeSignature?.denominator || 4}
                                onChange={(e) => onUpdateMetadata({
                                    timeSignature: {
                                        ...song.timeSignature,
                                        denominator: parseInt(e.target.value)
                                    }
                                })}
                                style={{ width: '80px' }}
                            >
                                <option value="2">2</option>
                                <option value="4">4</option>
                                <option value="8">8</option>
                                <option value="16">16</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Piano Roll Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
            }}>
                <h2 style={{
                    margin: 0,
                    fontSize: '1.5rem',
                    fontWeight: '300'
                }}>
                    Piano Roll
                </h2>
                <button
                    onClick={onAddPhrase}
                    className="btn-primary"
                >
                    Ajouter une phrase
                </button>
            </div>

            {/* Empty State */}
            {song.phrases.length === 0 && (
                <div className="card" style={{
                    padding: '3rem 2rem',
                    textAlign: 'center'
                }}>
                    <h3 style={{
                        marginTop: 0,
                        marginBottom: '0.75rem',
                        fontSize: '1.25rem',
                        fontWeight: '400',
                        color: 'var(--text-primary)'
                    }}>
                        Aucune phrase pour le moment
                    </h3>
                    <p style={{
                        margin: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '0.9375rem',
                        marginBottom: '1.5rem',
                        fontWeight: '300'
                    }}>
                        Commencez par créer une nouvelle phrase ou importez un fichier MIDI
                    </p>
                    <div style={{
                        display: 'flex',
                        gap: '0.75rem',
                        justifyContent: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={onAddPhrase}
                            className="btn-primary"
                        >
                            Créer une phrase
                        </button>
                    </div>
                </div>
            )}

            {/* Phrases List */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
            }}>
                {song.phrases.map((phrase, phraseIndex) => (
                    <div
                        key={phrase.id}
                        className="card"
                        style={{
                            padding: '1.5rem'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.25rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            {/* Title with edit mode */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {/* Move buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <button
                                        onClick={() => handleMovePhraseUp(phraseIndex)}
                                        disabled={phraseIndex === 0}
                                        style={{
                                            padding: '0',
                                            width: '20px',
                                            height: '16px',
                                            fontSize: '0.7rem',
                                            backgroundColor: phraseIndex === 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                            color: phraseIndex === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '3px',
                                            cursor: phraseIndex === 0 ? 'not-allowed' : 'pointer',
                                            lineHeight: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Monter"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => handleMovePhraseDown(phraseIndex)}
                                        disabled={phraseIndex === song.phrases.length - 1}
                                        style={{
                                            padding: '0',
                                            width: '20px',
                                            height: '16px',
                                            fontSize: '0.7rem',
                                            backgroundColor: phraseIndex === song.phrases.length - 1 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                            color: phraseIndex === song.phrases.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '3px',
                                            cursor: phraseIndex === song.phrases.length - 1 ? 'not-allowed' : 'pointer',
                                            lineHeight: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Descendre"
                                    >
                                        ▼
                                    </button>
                                </div>

                                {editingPhraseId === phrase.id ? (
                                    <input
                                        type="text"
                                        value={editingPhraseName}
                                        onChange={(e) => setEditingPhraseName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveRename(phrase.id);
                                            if (e.key === 'Escape') handleCancelRename();
                                        }}
                                        onBlur={() => handleSaveRename(phrase.id)}
                                        autoFocus
                                        style={{
                                            padding: '0.4rem 0.6rem',
                                            fontSize: '1.15rem',
                                            fontWeight: '500',
                                            border: '2px solid var(--accent-primary)',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                            minWidth: '200px'
                                        }}
                                    />
                                ) : (
                                    <h3
                                        onClick={() => handleStartRename(phrase)}
                                        style={{
                                            margin: 0,
                                            fontSize: '1.25rem',
                                            fontWeight: '500',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            padding: '0.4rem 0.6rem',
                                            borderRadius: 'var(--radius-md)',
                                            transition: 'background-color 0.2s',
                                            border: '2px solid transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.borderColor = 'transparent';
                                        }}
                                        title="Cliquer pour renommer"
                                    >
                                        {phrase.name}
                                    </h3>
                                )}
                            </div>
                            <div style={{
                                display: 'flex',
                                gap: '0.5rem',
                                flexWrap: 'wrap'
                            }}>
                                <button onClick={() => handlePlayPhrase(phrase)}>
                                    Lecture
                                </button>
                                <button onClick={handleStop}>
                                    Stop
                                </button>
                                <button
                                    onClick={() => handleStartSplit(phrase.id)}
                                    disabled={splitMode !== null}
                                    style={{
                                        backgroundColor: splitMode?.phraseId === phrase.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        color: splitMode?.phraseId === phrase.id ? 'white' : 'var(--text-primary)',
                                        opacity: splitMode !== null && splitMode?.phraseId !== phrase.id ? 0.5 : 1,
                                        cursor: splitMode !== null && splitMode?.phraseId !== phrase.id ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Découper
                                </button>
                                <button
                                    onClick={() => handleMergeWithPrevious(phrase.id)}
                                    disabled={phraseIndex === 0}
                                    style={{
                                        opacity: phraseIndex === 0 ? 0.5 : 1,
                                        cursor: phraseIndex === 0 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Recoller
                                </button>
                            </div>
                        </div>

                        {/* Split Controls */}
                        {splitMode?.phraseId === phrase.id && (
                            <div style={{
                                padding: '1.25rem',
                                marginBottom: '1.25rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: 'var(--radius-lg)'
                            }}>
                                <h4 style={{
                                    margin: '0 0 0.75rem 0',
                                    fontSize: '0.9375rem',
                                    color: 'var(--text-primary)',
                                    fontWeight: '500'
                                }}>
                                    Mode Découpage
                                </h4>
                                <p style={{
                                    margin: '0 0 1rem 0',
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: '300'
                                }}>
                                    {isBatchSplit
                                        ? "Découpez la phrase toutes les X mesures."
                                        : "Entrez la mesure où découper la phrase."
                                    }
                                </p>

                                <div style={{
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <input
                                        type="checkbox"
                                        id="batch-split"
                                        checked={isBatchSplit}
                                        onChange={(e) => setIsBatchSplit(e.target.checked)}
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <label htmlFor="batch-split" style={{
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        color: 'var(--text-primary)',
                                        fontWeight: '400'
                                    }}>
                                        Découper toutes les X mesures
                                    </label>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignItems: 'flex-end',
                                    flexWrap: 'wrap'
                                }}>
                                    <div style={{ flex: '1', minWidth: '150px' }}>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.8125rem',
                                            color: 'var(--text-primary)',
                                            fontWeight: '400'
                                        }}>
                                            {isBatchSplit ? "Intervalle" : "Mesure"}
                                        </label>
                                        <input
                                            type="number"
                                            value={splitTime}
                                            onChange={(e) => setSplitTime(e.target.value)}
                                            placeholder={isBatchSplit ? "Ex: 4" : "Ex: 2"}
                                            step="1"
                                            min="1"
                                            style={{
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.5rem'
                                    }}>
                                        <button
                                            onClick={handleConfirmSplit}
                                            style={{
                                                background: 'var(--accent-success)',
                                                color: 'white',
                                                border: 'none'
                                            }}
                                        >
                                            Valider
                                        </button>
                                        <button onClick={handleCancelSplit}>
                                            Annuler
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Piano Roll */}
                        <div style={{ marginBottom: '1rem' }}>
                            <PianoRoll
                                phrase={phrase}
                                phraseIndex={phraseIndex}
                                allPhrases={song.phrases}
                                keySignature={song.key}
                                tempo={song.tempo}
                                timeSignature={song.timeSignature || { numerator: 4, denominator: 4 }}
                                onAddNote={addNoteToPhrase}
                                onRemoveNote={removeNoteFromPhrase}
                                onUpdateNote={onUpdateNote}
                                onUpdatePhraseLength={(newLength) => handleUpdatePhraseLength(phrase.id, newLength)}
                                onSplit={() => handleStartSplit(phrase.id)}
                                isSplitMode={splitMode?.phraseId === phrase.id}
                                splitTime={splitTime}
                                onSplitTimeChange={setSplitTime}
                                onConfirmSplit={handleConfirmSplit}
                                onCancelSplit={handleCancelSplit}
                                isCurrentlyPlaying={playingPhraseId === phrase.id}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Import/Export Modal */}
            {showImportExportModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
                            maxWidth: '800px',
                            width: '100%',
                            maxHeight: '85vh',
                            overflow: 'auto',
                            padding: '2rem'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{
                            marginBottom: '2rem',
                            fontSize: '1.5rem',
                            fontWeight: '400'
                        }}>
                            Import / Export
                        </h2>

                        {/* MIDI Section */}
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1.25rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{
                                marginBottom: '0.75rem',
                                fontSize: '1.125rem',
                                fontWeight: '500'
                            }}>
                                Import MIDI
                            </h3>
                            <p style={{
                                color: 'var(--text-secondary)',
                                marginBottom: '1rem',
                                fontSize: '0.875rem',
                                fontWeight: '300'
                            }}>
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
                                <button className="btn-primary">
                                    {isImporting ? 'Importation...' : 'Choisir un fichier MIDI'}
                                </button>
                            </div>
                        </div>

                        {/* JSON Section */}
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1.25rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{
                                marginBottom: '0.75rem',
                                fontSize: '1.125rem',
                                fontWeight: '500'
                            }}>
                                Export / Import JSON
                            </h3>
                            <p style={{
                                color: 'var(--text-secondary)',
                                marginBottom: '1rem',
                                fontSize: '0.875rem',
                                fontWeight: '300'
                            }}>
                                Format JSON pour sauvegarder ou partager
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                flexWrap: 'wrap'
                            }}>
                                <button
                                    onClick={async () => {
                                        const result = await StorageService.exportSong(song);
                                        if (result.success && !result.cancelled) {
                                            const message = result.path
                                                ? `Fichier JSON exporté !\n${result.path}`
                                                : 'Fichier JSON téléchargé !';
                                            alert(message);
                                        }
                                    }}
                                    style={{
                                        background: 'var(--accent-success)',
                                        color: 'white',
                                        border: 'none'
                                    }}
                                >
                                    Exporter JSON
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
                                    <button>
                                        Importer JSON
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginTop: '1.5rem'
                        }}>
                            <button onClick={() => setShowImportExportModal(false)}>
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
