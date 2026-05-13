import React, { useState, useEffect, useCallback } from 'react';
import { StorageService } from '../services/StorageService';
import { ScoreService } from '../services/ScoreService';
import { getFrenchKeyName } from '../models/song';
import { Cover, ProgressRing, Pill } from './ui';

export function SongLibrary({ onLoadSong, onNewSong, onLoadSongToLivePlay, isMobile = false }) {
    const [songs, setSongs] = useState([]);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [mergeOnImport, setMergeOnImport] = useState(false);
    const [actionSheetSong, setActionSheetSong] = useState(null);
    const [midiImportStatus, setMidiImportStatus] = useState(null); // null | 'loading' | 'success' | 'error'
    const [showFabMenu, setShowFabMenu] = useState(false);

    const loadSongs = useCallback(() => {
        setSongs(StorageService.getSongs());
    }, []);

    useEffect(() => {
        // Initial data load - setState here is intentional and necessary
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadSongs();
    }, [loadSongs]);

    const handleDelete = (id, e) => {
        e.stopPropagation();
        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce morceau ?')) {
            StorageService.deleteSong(id);
            loadSongs();
        }
    };

    const handleOpenLibraryModal = () => {
        setShowLibraryModal(true);
    };

    const handleImportMidi = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setMidiImportStatus('loading');
        try {
            const { parseMidiFile } = await import('../services/MidiService');
            const song = await parseMidiFile(file);
            StorageService.saveSong(song);
            loadSongs();
            setMidiImportStatus('success');
            setTimeout(() => setMidiImportStatus(null), 3000);
        } catch (err) {
            console.error('MIDI import error:', err);
            setMidiImportStatus('error');
            setTimeout(() => setMidiImportStatus(null), 3000);
        }
        e.target.value = '';
    };

    const handleExportMidi = async (song, e) => {
        e?.stopPropagation();
        try {
            const result = await StorageService.exportSongAsMidi(song);
            if (result.success && !result.cancelled && result.path) {
                alert(`MIDI exporté !\n${result.path}`);
            }
        } catch (err) {
            console.error('MIDI export error:', err);
            alert('Erreur lors de l\'export MIDI.');
        }
    };

    const handleImportLibraryJson = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedLibrary = JSON.parse(event.target.result);
                StorageService.importLibrary(importedLibrary, mergeOnImport);
                loadSongs();
                setShowLibraryModal(false);
                alert(`Bibliothèque ${mergeOnImport ? 'fusionnée' : 'importée'} avec succès !`);
            // eslint-disable-next-line no-unused-vars
            } catch (error) {
                alert('Erreur lors de l\'import du fichier JSON.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div>
                    <h2 style={{
                        fontSize: isMobile ? '1.625rem' : '1.875rem',
                        margin: 0,
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                        color: 'var(--text-primary)',
                    }}>
                        Bibliothèque
                    </h2>
                    <p style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '0.8125rem',
                        margin: '4px 0 0',
                        fontWeight: 500,
                    }}>
                        {songs.length} {songs.length === 1 ? 'morceau' : 'morceaux'}
                        {songs.filter(s => s.phrases?.length > 0).length > 0 && (
                            <span> · {songs.filter(s => s.phrases?.length > 0).length} avec phrases</span>
                        )}
                    </p>
                </div>

                {/* Action Buttons - hidden on mobile (FAB instead) */}
                {!isMobile && (
                    <div style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                    }}>
                        <button onClick={handleOpenLibraryModal}>
                            Import/Export
                        </button>

                        <button
                            onClick={onNewSong}
                            className="btn-primary"
                        >
                            Nouveau Morceau
                        </button>
                    </div>
                )}
            </div>

            {/* Empty State */}
            {songs.length === 0 ? (
                <div className="card" style={{
                    textAlign: 'center',
                    padding: '4rem 2rem'
                }}>
                    <h3 style={{
                        color: 'var(--text-primary)',
                        marginBottom: '0.75rem',
                        fontSize: '1.25rem',
                        fontWeight: '400'
                    }}>
                        Votre bibliothèque est vide
                    </h3>
                    <p style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '0.9375rem',
                        maxWidth: '500px',
                        margin: '0 auto 2rem',
                        lineHeight: '1.6',
                        fontWeight: '300'
                    }}>
                        Créez votre premier morceau et commencez votre voyage musical
                    </p>
                    {onNewSong && (
                        <button
                            onClick={onNewSong}
                            className="btn-primary"
                            style={{
                                padding: '0.75rem 2rem'
                            }}
                        >
                            Commencer maintenant
                        </button>
                    )}
                </div>
            ) : (
                /* Song Cards Grid */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: isMobile ? '0.5rem' : '1rem'
                }}>
                    {songs.map((song) => (
                        <div
                            key={song.id}
                            onClick={() => isMobile ? setActionSheetSong(song) : onLoadSong(song.id)}
                            className="card"
                            style={{
                                cursor: 'pointer',
                                padding: '1rem',
                                minHeight: isMobile ? '56px' : undefined,
                                position: 'relative',
                                display: 'flex',
                                gap: '0.75rem',
                                alignItems: 'flex-start',
                            }}
                        >
                            <Cover id={song.id} title={song.title} size={isMobile ? 44 : 52} />

                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Song Title */}
                                <h3 style={{
                                    margin: 0,
                                    color: 'var(--text-primary)',
                                    fontSize: isMobile ? '0.95rem' : '1rem',
                                    fontWeight: 600,
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.3,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {song.title}
                                </h3>

                                {/* Song Metadata */}
                                <p style={{
                                    margin: '2px 0 6px',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-tertiary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {song.artist || 'Artiste inconnu'}
                                </p>

                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Pill style={{ padding: '2px 7px', fontSize: 10 }}>
                                        {getFrenchKeyName(song.key)}
                                    </Pill>
                                    <span style={{
                                        fontSize: 10,
                                        color: 'var(--text-muted)',
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 600,
                                    }}>
                                        {song.tempo} BPM
                                    </span>
                                </div>

                                <p style={{
                                    fontSize: '0.7rem',
                                    margin: '6px 0 0',
                                    color: 'var(--text-muted)',
                                    fontFamily: 'var(--font-mono)',
                                }}>
                                    {new Date(song.updatedAt || song.createdAt).toLocaleDateString('fr-FR')}
                                </p>

                                {/* Song Actions */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                    gap: '0.35rem',
                                    paddingTop: '0.6rem',
                                    marginTop: '0.6rem',
                                    borderTop: '1px solid var(--hairline)'
                                }}>
                                    <button
                                        onClick={(e) => handleExportMidi(song, e)}
                                        style={{
                                            padding: '0.25rem 0.6rem',
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--r-sm)',
                                            fontSize: '0.7rem',
                                            fontFamily: 'inherit',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        MIDI
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(song.id, e)}
                                        style={{
                                            padding: '0.25rem 0.6rem',
                                            background: 'transparent',
                                            color: 'var(--error)',
                                            border: '1px solid var(--error)',
                                            borderRadius: 'var(--r-sm)',
                                            fontSize: '0.7rem',
                                            fontFamily: 'inherit',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Mobile FAB with expandable menu */}
            {isMobile && (
                <div style={{
                    position: 'fixed',
                    bottom: 'calc(70px + var(--safe-bottom) + 16px)',
                    right: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.75rem',
                    zIndex: 50
                }}>
                    {showFabMenu && (
                        <>
                            <button
                                onClick={() => { handleOpenLibraryModal(); setShowFabMenu(false); }}
                                style={{
                                    height: '44px',
                                    borderRadius: '22px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0 1rem',
                                    minHeight: 'unset',
                                    boxShadow: 'var(--shadow-lg)',
                                    fontSize: '0.875rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Importer
                            </button>
                            {onNewSong && (
                                <button
                                    onClick={() => { onNewSong(); setShowFabMenu(false); }}
                                    style={{
                                        height: '44px',
                                        borderRadius: '22px',
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0 1rem',
                                        minHeight: 'unset',
                                        boxShadow: 'var(--shadow-lg)',
                                        fontSize: '0.875rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Nouveau
                                </button>
                            )}
                        </>
                    )}
                    <button
                        onClick={() => setShowFabMenu(!showFabMenu)}
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            background: 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            minHeight: 'unset',
                            boxShadow: '0 8px 24px -4px var(--accent), 0 2px 6px rgba(0,0,0,0.3)',
                            fontSize: '1.5rem',
                            transform: showFabMenu ? 'rotate(45deg)' : 'none',
                            transition: 'transform 0.2s ease',
                            cursor: 'pointer',
                        }}
                        title="Actions"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Mobile Song Detail Sheet (design-aligned bottom sheet) */}
            {actionSheetSong && isMobile && (
                <SongDetailSheet
                    song={actionSheetSong}
                    onClose={() => setActionSheetSong(null)}
                    onLearn={() => { onLoadSong(actionSheetSong.id); setActionSheetSong(null); }}
                    onLivePlay={() => { (onLoadSongToLivePlay || onLoadSong)(actionSheetSong.id); setActionSheetSong(null); }}
                    onDelete={() => { handleDelete(actionSheetSong.id, { stopPropagation: () => {} }); setActionSheetSong(null); }}
                />
            )}

            {/* Library Import/Export Modal */}
            {showLibraryModal && (
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
                onClick={() => setShowLibraryModal(false)}
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
                            Import / Export Bibliothèque
                        </h2>

                        {/* Merge Option */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <input
                                type="checkbox"
                                id="merge-library"
                                checked={mergeOnImport}
                                onChange={(e) => setMergeOnImport(e.target.checked)}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer'
                                }}
                            />
                            <label htmlFor="merge-library" style={{
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                color: 'var(--text-primary)',
                                fontWeight: '400'
                            }}>
                                Fusionner avec la bibliothèque existante
                            </label>
                        </div>

                        {/* JSON Section */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{
                                marginBottom: '1rem',
                                fontSize: '1.125rem',
                                fontWeight: '500'
                            }}>
                                Export / Import JSON
                            </h3>
                            <p style={{
                                color: 'var(--text-tertiary)',
                                marginBottom: '1.25rem',
                                fontSize: '0.875rem',
                                lineHeight: '1.6',
                                fontWeight: '300'
                            }}>
                                Format JSON pour sauvegarder toute votre bibliothèque
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={async () => {
                                        const result = await StorageService.exportLibrary();
                                        if (result.success && !result.cancelled) {
                                            const message = result.path
                                                ? `Bibliothèque exportée !\n${result.path}`
                                                : 'Bibliothèque exportée !';
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
                                        onChange={handleImportLibraryJson}
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

                        {/* MIDI Section */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '500' }}>
                                Import MIDI
                            </h3>
                            <p style={{
                                color: 'var(--text-tertiary)',
                                marginBottom: '1.25rem',
                                fontSize: '0.875rem',
                                lineHeight: '1.6',
                                fontWeight: '300'
                            }}>
                                Importer un fichier .mid pour créer un nouveau morceau dans la bibliothèque
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <input
                                        type="file"
                                        accept=".mid,.midi"
                                        onChange={handleImportMidi}
                                        disabled={midiImportStatus === 'loading'}
                                        style={{
                                            position: 'absolute',
                                            top: 0, left: 0,
                                            width: '100%', height: '100%',
                                            opacity: 0,
                                            cursor: midiImportStatus === 'loading' ? 'not-allowed' : 'pointer',
                                            zIndex: 10
                                        }}
                                    />
                                    <button disabled={midiImportStatus === 'loading'}>
                                        {midiImportStatus === 'loading' ? 'Import...' : 'Importer MIDI'}
                                    </button>
                                </div>
                                {midiImportStatus === 'success' && (
                                    <span style={{ color: 'var(--accent-success)', fontSize: '0.875rem' }}>Importé !</span>
                                )}
                                {midiImportStatus === 'error' && (
                                    <span style={{ color: 'var(--accent-danger)', fontSize: '0.875rem' }}>Erreur d'import</span>
                                )}
                            </div>
                        </div>

                        {/* Close Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button onClick={() => setShowLibraryModal(false)}>
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── SongDetailSheet — design-aligned bottom sheet ────────────────────────────
function SongDetailSheet({ song, onClose, onLearn, onLivePlay, onDelete }) {
    const phraseCount = song?.phrases?.length || 0;
    const created = song?.createdAt ? new Date(song.createdAt).toLocaleDateString('fr-FR') : null;
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'flex-end',
                zIndex: 1000,
                animation: 'design-fadeIn 220ms var(--ease-out)',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
                    width: '100%',
                    padding: '12px 20px calc(20px + var(--safe-bottom))',
                    maxHeight: '85%',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    animation: 'design-slideUp 280ms var(--ease-out)',
                }}
            >
                {/* Drag handle */}
                <div style={{
                    width: 40, height: 4, background: 'var(--border-strong)',
                    borderRadius: 999, margin: '0 auto 16px',
                }} />

                {/* Hero — cover + title + artist */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <Cover id={song.id} title={song.title} size={72} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                            fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{song.title || 'Sans titre'}</div>
                        <div style={{
                            fontSize: 13, color: 'var(--text-secondary)', marginTop: 2,
                        }}>{song.artist || 'Artiste inconnu'}</div>
                    </div>
                </div>

                {/* Stats grid */}
                <div style={{
                    marginTop: 18,
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--r-md)',
                    padding: '10px 4px',
                }}>
                    <SheetStat label="Phrases" value={phraseCount} />
                    <SheetStat label="Tempo" value={song.tempo} unit="bpm" divider />
                    <SheetStat label="Tonalité" value={getFrenchKeyName(song.key).split(' ')[0]} divider />
                </div>

                {created && (
                    <div style={{
                        marginTop: 10,
                        fontSize: 11, color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                        textAlign: 'center',
                    }}>
                        Créé le {created}
                    </div>
                )}

                {/* Action buttons */}
                <div style={{
                    marginTop: 16,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                }}>
                    <ActionBtn onClick={onLearn} primary label="Apprendre" icon={<ActionIcon kind="learn" />} />
                    <ActionBtn onClick={onLivePlay} label="LivePlay" icon={<ActionIcon kind="liveplay" />} />
                </div>

                <button
                    onClick={onDelete}
                    style={{
                        marginTop: 10,
                        width: '100%',
                        padding: '12px',
                        background: 'transparent',
                        color: 'var(--error)',
                        border: '1px solid var(--error)',
                        borderRadius: 'var(--r-md)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                    }}
                >
                    Supprimer
                </button>

                <button
                    onClick={onClose}
                    style={{
                        marginTop: 8,
                        width: '100%',
                        padding: '12px',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        border: 'none',
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                    }}
                >
                    Annuler
                </button>
            </div>
        </div>
    );
}

function SheetStat({ label, value, unit, divider }) {
    return (
        <div style={{
            textAlign: 'center',
            borderLeft: divider ? '1px solid var(--border)' : 'none',
            padding: '2px 0',
        }}>
            <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 16,
                color: 'var(--text-primary)',
            }}>
                {value}
                {unit && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 1 }}>{unit}</span>}
            </div>
            <div style={{
                fontSize: 9, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2,
            }}>{label}</div>
        </div>
    );
}

function ActionBtn({ icon, label, primary, onClick }) {
    return (
        <button onClick={onClick} style={{
            padding: '14px 6px',
            borderRadius: 'var(--r-md)',
            background: primary ? 'var(--accent)' : 'var(--surface-2)',
            color: primary ? '#fff' : 'var(--text-primary)',
            border: primary ? 'none' : '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
        }}>
            {icon}
            <span>{label}</span>
        </button>
    );
}

function ActionIcon({ kind }) {
    if (kind === 'learn') {
        return (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="14" width="4" height="8" rx="0.5"/>
                <rect x="7" y="10" width="3" height="12" rx="0.5"/>
                <rect x="11" y="14" width="4" height="8" rx="0.5"/>
                <rect x="16" y="10" width="3" height="12" rx="0.5"/>
                <rect x="20" y="14" width="4" height="8" rx="0.5"/>
                <circle cx="12" cy="5" r="2"/>
                <path d="M10 5l-3 3"/>
                <path d="M14 5l3 3"/>
            </svg>
        );
    }
    // liveplay
    return (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="18" rx="2"/>
            <path d="M8 3v12"/>
            <path d="M16 3v12"/>
            <rect x="2" y="15" width="20" height="6"/>
            <path d="M6 15v6"/>
            <path d="M10 15v6"/>
            <path d="M14 15v6"/>
            <path d="M18 15v6"/>
        </svg>
    );
}
