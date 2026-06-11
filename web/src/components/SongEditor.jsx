import React, { useState, useEffect, useRef } from 'react';
import { PianoRoll } from './PianoRoll';
import { audioEngine } from '../services/AudioEngine';
import { parseMidiFile } from '../services/MidiService';
import { StorageService } from '../services/StorageService';
import { getFrenchNoteName } from '../models/song';
import { MobileHeader } from './MobileHeader';
import { PlaybackDock } from './PlaybackDock';


export function SongEditor({ song, onUpdateMetadata, onImportSong, onSaveSong, onAddPhrase, onSplitPhrase, onMergePhraseWithPrevious, onRenamePhrasesInOrder, addNoteToPhrase, removeNoteFromPhrase, onUpdateNote, onReorderPhrases, readOnly = false, isMobile = false }) {
    const [isImporting, setIsImporting] = useState(false);
    const [isMetaExpanded, setIsMetaExpanded] = useState(false);
    const [splitMode, setSplitMode] = useState(null);
    const [isSplitModeActive, setIsSplitModeActive] = useState(false);
    const [splitThreshold, setSplitThreshold] = useState(60);
    const [splitTime, setSplitTime] = useState('');
    const [isBatchSplit, setIsBatchSplit] = useState(false);
    const [showImportExportModal, setShowImportExportModal] = useState(false);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [editingPhraseId, setEditingPhraseId] = useState(null);
    const [editingPhraseName, setEditingPhraseName] = useState('');
    const [playingPhraseId, setPlayingPhraseId] = useState(null); // Track which phrase is playing

    // Universal PlaybackDock state (mirrors other pages)
    const [activePhraseIndex, setActivePhraseIndex] = useState(0);
    const [dockSpeed, setDockSpeed] = useState(100);
    const [dockHandMode, setDockHandMode] = useState('both');
    const [dockMetronome, setDockMetronome] = useState(false);
    const [dockMetronomeSubdivision, setDockMetronomeSubdivision] = useState('quarter');
    const [dockLoop, setDockLoop] = useState(false);
    const [dockLoopRange, setDockLoopRange] = useState([1, 1]);
    const [dockLoopEditorOpen, setDockLoopEditorOpen] = useState(false);

    // Toggle the running metronome when the dock state changes.
    useEffect(() => {
        if (dockMetronome) {
            const tempo = Math.max(20, Math.round((song?.tempo || 120) * (dockSpeed / 100)));
            audioEngine.startMetronome(tempo, dockMetronomeSubdivision);
        } else {
            audioEngine.stopMetronome();
        }
    }, [dockMetronome, dockMetronomeSubdivision, song, dockSpeed]);
    const isInitialMount = useRef(true);
    const saveTimeoutRef = useRef(null);
    const phraseTrackingRafRef = useRef(null);

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
        const timeSignature = song.timeSignature || { numerator: 4, denominator: 4 };
        const beatsPerMeasure = timeSignature.numerator;
        const tempo = Math.max(20, Math.round((song.tempo || 120) * (dockSpeed / 100)));

        if (dockLoop) {
            // Loop mode: play only the active phrase on a loop (existing behaviour).
            audioEngine.playPhrase(
                phrase,
                tempo,
                null,
                true,
                () => {
                    if (dockLoop) handlePlayPhrase(phrase);
                    else setPlayingPhraseId(null);
                },
                beatsPerMeasure,
                { preroll: dockMetronome },
            );
            return;
        }

        // Non-loop mode: build a combined phrase from the active phrase
        // through the end of the song so playback continues seamlessly.
        const startPhraseIndex = song.phrases.findIndex(p => p.id === phrase.id);
        const phrasesToPlay = startPhraseIndex >= 0
            ? song.phrases.slice(startPhraseIndex)
            : [phrase];

        const melody = [];
        const chords = [];
        let beatOffset = 0;
        phrasesToPlay.forEach((p) => {
            p.tracks.melody.forEach((n) => {
                melody.push({ ...n, startTime: n.startTime + beatOffset });
            });
            p.tracks.chords.forEach((n) => {
                chords.push({ ...n, startTime: n.startTime + beatOffset });
            });
            beatOffset += p.length * beatsPerMeasure;
        });

        // Apply hand-mode filter.
        const filteredMelody = dockHandMode === 'left' ? [] : melody;
        const filteredChords = dockHandMode === 'right' ? [] : chords;

        const combinedPhrase = {
            tracks: { melody: filteredMelody, chords: filteredChords },
            length: phrasesToPlay.reduce((s, p) => s + p.length, 0),
        };

        // Track which phrase the playhead is currently in during playback
        // by watching audioEngine transport position.
        const phraseStartBeat = startPhraseIndex >= 0
            ? song.phrases.slice(0, startPhraseIndex).reduce((s, p) => s + p.length * beatsPerMeasure, 0)
            : 0;

        audioEngine.playPhrase(
            combinedPhrase,
            tempo,
            null,
            true,
            () => setPlayingPhraseId(null),
            beatsPerMeasure,
            { preroll: dockMetronome },
        );

        // Update the highlighted phrase as playback crosses phrase boundaries.
        // Capture the phrases array here so the RAF callback has a stable closure.
        const phrasesSnapshot = song.phrases.slice();
        const trackPhrase = () => {
            if (!audioEngine.getIsActuallyPlaying()) return;
            const musicT = audioEngine.getMusicSeconds();
            if (musicT >= 0) {
                const secondsPerBeat = 60 / tempo;
                const currentBeat = phraseStartBeat + musicT / secondsPerBeat;
                let cumulativeBeats = 0;
                for (let i = 0; i < phrasesSnapshot.length; i++) {
                    cumulativeBeats += phrasesSnapshot[i].length * beatsPerMeasure;
                    if (currentBeat < cumulativeBeats || i === phrasesSnapshot.length - 1) {
                        setPlayingPhraseId(phrasesSnapshot[i].id);
                        break;
                    }
                }
            }
            phraseTrackingRafRef.current = requestAnimationFrame(trackPhrase);
        };
        phraseTrackingRafRef.current = requestAnimationFrame(trackPhrase);
    };

    const handleStop = () => {
        audioEngine.stop();
        if (phraseTrackingRafRef.current) {
            cancelAnimationFrame(phraseTrackingRafRef.current);
            phraseTrackingRafRef.current = null;
        }
        setPlayingPhraseId(null);
    };

    // Restart: stop playback and jump back to the first phrase.
    const handleRestart = () => {
        handleStop();
        setActivePhraseIndex(0);
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

    const hasPhrases = !readOnly && song?.phrases?.length > 0;
    const dockHeight = hasPhrases ? 175 : 0; // ~44 (editor bar) + ~111 (dock) + 20 buffer
    return (
        <div style={{ paddingBottom: dockHeight + (isMobile ? 64 : 0) }}>
            {/* MobileHeader — design-aligned big title + subtitle */}
            {isMobile && (
                <MobileHeader
                    title="Éditeur"
                    subtitle={song?.title || 'Aucun morceau chargé'}
                />
            )}

            {/* Mobile info banner — design-aligned compact pill */}
            {isMobile && (
                <div style={{
                    margin: '0 18px 12px',
                    padding: '10px 14px',
                    background: 'var(--accent-dim)',
                    border: '1px solid color-mix(in oklab, var(--accent), transparent 70%)',
                    borderRadius: 'var(--r-md)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                }}>
                    <span style={{
                        width: 22, height: 22, flexShrink: 0,
                        borderRadius: 'var(--r-sm)',
                        background: 'var(--accent-dim)',
                        color: 'var(--accent)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                    }}>i</span>
                    Édition complète disponible sur ordinateur. Sur mobile, seules les métadonnées sont modifiables.
                </div>
            )}

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
                            {readOnly ? 'Visualisation de la partition' : 'Configurez les informations de votre composition'}
                        </p>
                    </div>

                    {!readOnly && (
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
                    )}
                </div>

                {isMobile && (
                    <div
                        style={{ cursor: 'pointer', padding: '0.5rem', fontWeight: 'bold', color: 'var(--text-primary)', userSelect: 'none' }}
                        onClick={() => setIsMetaExpanded(v => !v)}
                    >
                        Infos du morceau {isMetaExpanded ? '▲' : '▼'}
                    </div>
                )}

                {(!isMobile || isMetaExpanded) && <div style={{
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
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-primary)',
                            fontWeight: '400',
                            fontSize: '0.875rem'
                        }}>
                            Tonalité
                        </label>
                        <select
                            value={(() => {
                                // Handle both object format {note, mode} and string format
                                if (!song.key) return 'C';
                                if (typeof song.key === 'string') return song.key;
                                if (typeof song.key === 'object' && song.key.note) {
                                    return song.key.mode === 'minor' ? `${song.key.note}m` : song.key.note;
                                }
                                return 'C';
                            })()}
                            onChange={(e) => onUpdateMetadata({ key: e.target.value })}
                            style={{ width: '120px' }}
                        >
                            <optgroup label="Majeur">
                                <option value="C">Do majeur</option>
                                <option value="G">Sol majeur</option>
                                <option value="D">Ré majeur</option>
                                <option value="A">La majeur</option>
                                <option value="E">Mi majeur</option>
                                <option value="B">Si majeur</option>
                                <option value="F#">Fa# majeur</option>
                                <option value="F">Fa majeur</option>
                                <option value="Bb">Sib majeur</option>
                                <option value="Eb">Mib majeur</option>
                                <option value="Ab">Lab majeur</option>
                                <option value="Db">Réb majeur</option>
                            </optgroup>
                            <optgroup label="Mineur">
                                <option value="Am">La mineur</option>
                                <option value="Em">Mi mineur</option>
                                <option value="Bm">Si mineur</option>
                                <option value="F#m">Fa# mineur</option>
                                <option value="C#m">Do# mineur</option>
                                <option value="Dm">Ré mineur</option>
                                <option value="Gm">Sol mineur</option>
                                <option value="Cm">Do mineur</option>
                                <option value="Fm">Fa mineur</option>
                                <option value="Bbm">Sib mineur</option>
                            </optgroup>
                        </select>
                    </div>
                </div>}
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
                {!isMobile && (
                    <button
                        onClick={onAddPhrase}
                        className="btn-primary"
                    >
                        Ajouter une phrase
                    </button>
                )}
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
                            {/* Per-phrase controls moved to sticky EditorBottomBar at the bottom of the page.
                                Tapping a phrase header sets it as active there. */}
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
                                onAddNote={isMobile ? null : addNoteToPhrase}
                                onRemoveNote={isMobile ? null : removeNoteFromPhrase}
                                onUpdateNote={isMobile ? null : onUpdateNote}
                                onUpdatePhraseLength={isMobile ? null : (newLength) => handleUpdatePhraseLength(phrase.id, newLength)}
                                onSplit={isMobile ? null : () => handleStartSplit(phrase.id)}
                                isSplitMode={splitMode?.phraseId === phrase.id}
                                splitTime={splitTime}
                                onSplitTimeChange={setSplitTime}
                                onConfirmSplit={handleConfirmSplit}
                                onCancelSplit={handleCancelSplit}
                                isCurrentlyPlaying={playingPhraseId === phrase.id}
                                readOnly={!!isMobile}
                                splitThresholdMode={isSplitModeActive}
                                splitThreshold={splitThreshold}
                                onSplitThresholdChange={setSplitThreshold}
                            />
                        </div>
                        {/* Split threshold (mobile only) */}
                        {isMobile && onUpdateNote && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setIsSplitModeActive(v => !v)}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.8rem',
                                        background: isSplitModeActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                        color: isSplitModeActive ? 'white' : 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        fontWeight: '500'
                                    }}
                                >
                                    {isSplitModeActive
                                        ? `Seuil : ${getFrenchNoteName(splitThreshold)} (${splitThreshold})`
                                        : '✂ Seuil MG/MD'}
                                </button>
                                {isSplitModeActive && (
                                    <button
                                        onClick={() => {
                                            const allNotes = [
                                                ...phrase.tracks.melody.map(n => ({ ...n, currentTrack: 'melody' })),
                                                ...phrase.tracks.chords.map(n => ({ ...n, currentTrack: 'chords' }))
                                            ];
                                            allNotes.forEach(note => {
                                                const midiPitch = typeof note.pitch === 'number' ? note.pitch : note.pitch;
                                                const targetTrack = midiPitch >= splitThreshold ? 'melody' : 'chords';
                                                if (targetTrack !== note.currentTrack) {
                                                    onUpdateNote(phrase.id, note.currentTrack, note.id, { track: targetTrack });
                                                }
                                            });
                                            setIsSplitModeActive(false);
                                        }}
                                        style={{
                                            padding: '0.35rem 0.75rem',
                                            fontSize: '0.8rem',
                                            background: 'var(--accent-secondary)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontWeight: '500'
                                        }}
                                    >
                                        Appliquer
                                    </button>
                                )}
                            </div>
                        )}
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

            {/* Fixed bottom playback bar — same dock as other pages, with an
                Editor-specific secondary row for phrase navigation + actions. */}
            {!readOnly && song?.phrases?.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: isMobile ? 64 : 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                }}>
                    <EditorBottomBar
                        phrases={song.phrases}
                        activeIndex={activePhraseIndex}
                        onActiveChange={setActivePhraseIndex}
                        onPlayPhrase={handlePlayPhrase}
                        onStop={handleStop}
                        playingPhraseId={playingPhraseId}
                        onSplit={handleStartSplit}
                        splitMode={splitMode}
                        onMerge={handleMergeWithPrevious}
                    />
                    <PlaybackDock
                        playing={!!playingPhraseId}
                        onPlayPause={() => {
                            const phrase = song.phrases[activePhraseIndex];
                            if (!phrase) return;
                            if (playingPhraseId) handleStop();
                            else handlePlayPhrase(phrase);
                        }}
                        onRestart={handleRestart}
                        speed={dockSpeed}
                        onSpeed={setDockSpeed}
                        handMode={dockHandMode}
                        onHandMode={setDockHandMode}
                        metronome={dockMetronome}
                        onMetronome={() => setDockMetronome(!dockMetronome)}
                        metronomeSubdivision={dockMetronomeSubdivision}
                        onMetronomeSubdivisionChange={setDockMetronomeSubdivision}
                        loop={dockLoop}
                        onLoop={() => setDockLoop(!dockLoop)}
                        loopRange={dockLoopRange[1] > 1 ? dockLoopRange : [1, song.phrases.length]}
                        onLoopRange={setDockLoopRange}
                        loopEditorOpen={dockLoopEditorOpen}
                        onToggleLoopEditor={() => setDockLoopEditorOpen(o => !o)}
                        totalMeasures={song.phrases.length}
                        onPrev={() => setActivePhraseIndex(i => Math.max(0, i - 1))}
                        onNext={() => setActivePhraseIndex(i => Math.min(song.phrases.length - 1, i + 1))}
                    />
                </div>
            )}
        </div>
    );
}

// Editor-specific secondary bar (above PlaybackDock)
function EditorBottomBar({
    phrases, activeIndex, onActiveChange, onPlayPhrase, onStop, playingPhraseId,
    onSplit, splitMode, onMerge,
}) {
    const active = phrases[activeIndex];
    if (!active) return null;
    const isPlaying = playingPhraseId === active.id;
    const canMerge = activeIndex > 0;
    const inSplitMode = splitMode?.phraseId === active.id;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            background: 'color-mix(in oklab, var(--surface-1), transparent 4%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            minHeight: 44,
        }}>
            {/* Phrase nav (▲ ▼) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button
                    onClick={() => onActiveChange(Math.max(0, activeIndex - 1))}
                    disabled={activeIndex === 0}
                    style={{
                        width: 22, height: 18, borderRadius: 'var(--r-sm)',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        color: 'var(--text-secondary)', fontSize: 10,
                        cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: activeIndex === 0 ? 0.3 : 1,
                        padding: 0, minHeight: 0,
                    }}
                    aria-label="Phrase précédente"
                >▲</button>
                <button
                    onClick={() => onActiveChange(Math.min(phrases.length - 1, activeIndex + 1))}
                    disabled={activeIndex >= phrases.length - 1}
                    style={{
                        width: 22, height: 18, borderRadius: 'var(--r-sm)',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        color: 'var(--text-secondary)', fontSize: 10,
                        cursor: activeIndex >= phrases.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: activeIndex >= phrases.length - 1 ? 0.3 : 1,
                        padding: 0, minHeight: 0,
                    }}
                    aria-label="Phrase suivante"
                >▼</button>
            </div>

            {/* Active phrase name */}
            <div style={{
                flex: 1, minWidth: 0,
                display: 'flex', flexDirection: 'column',
                gap: 1,
            }}>
                <span style={{
                    fontSize: 9, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    fontWeight: 600,
                }}>Phrase active</span>
                <span style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{active.name || `Phrase ${activeIndex + 1}`}</span>
            </div>

            {/* Lecture / Stop */}
            <button
                onClick={() => isPlaying ? onStop() : onPlayPhrase(active)}
                style={{
                    padding: '6px 10px', fontSize: 11, fontWeight: 600,
                    borderRadius: 'var(--r-pill)',
                    background: isPlaying ? 'var(--accent-dim)' : 'var(--surface-2)',
                    border: `1px solid ${isPlaying ? 'var(--accent)' : 'var(--border)'}`,
                    color: isPlaying ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', minHeight: 0,
                }}
            >
                {isPlaying ? 'Stop' : 'Lecture'}
            </button>

            {/* Découper */}
            <button
                onClick={() => onSplit(active.id)}
                disabled={splitMode !== null && !inSplitMode}
                style={{
                    padding: '6px 10px', fontSize: 11, fontWeight: 600,
                    borderRadius: 'var(--r-pill)',
                    background: inSplitMode ? 'var(--accent-dim)' : 'var(--surface-2)',
                    border: `1px solid ${inSplitMode ? 'var(--accent)' : 'var(--border)'}`,
                    color: inSplitMode ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: splitMode !== null && !inSplitMode ? 'not-allowed' : 'pointer',
                    opacity: splitMode !== null && !inSplitMode ? 0.4 : 1,
                    minHeight: 0,
                }}
            >
                Découper
            </button>

            {/* Recoller */}
            <button
                onClick={() => onMerge(active.id)}
                disabled={!canMerge}
                style={{
                    padding: '6px 10px', fontSize: 11, fontWeight: 600,
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    cursor: canMerge ? 'pointer' : 'not-allowed',
                    opacity: canMerge ? 1 : 0.4,
                    minHeight: 0,
                }}
            >
                Recoller
            </button>
        </div>
    );
}
