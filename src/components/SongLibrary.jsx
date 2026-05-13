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
                        fontSize: '1.75rem',
                        marginBottom: '0.5rem',
                        fontWeight: '300',
                        letterSpacing: '-0.02em'
                    }}>
                        Ma Bibliothèque
                    </h2>
                    <p style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '0.875rem',
                        margin: 0,
                        fontWeight: '300'
                    }}>
                        {songs.length} {songs.length === 1 ? 'morceau' : 'morceaux'}
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

            {/* Mobile Action Sheet */}
            {actionSheetSong && isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        zIndex: 1000
                    }}
                    onClick={() => setActionSheetSong(null)}
                >
                    <div
                        style={{
                            width: '100%',
                            background: 'var(--bg-elevated)',
                            borderRadius: '16px 16px 0 0',
                            padding: '1rem',
                            paddingBottom: 'calc(1rem + var(--safe-bottom))'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            width: 32,
                            height: 4,
                            background: 'var(--border-medium)',
                            borderRadius: 2,
                            margin: '0 auto 1rem'
                        }} />
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: '500',
                            marginBottom: '1rem',
                            color: 'var(--text-primary)',
                            textAlign: 'center'
                        }}>
                            {actionSheetSong.title}
                        </h3>
                        {[
                            { label: 'Jouer (LivePlay)', action: () => { if (onLoadSongToLivePlay) onLoadSongToLivePlay(actionSheetSong.id); else onLoadSong(actionSheetSong.id); setActionSheetSong(null); } },
                            { label: 'Apprendre', action: () => { onLoadSong(actionSheetSong.id); setActionSheetSong(null); } },
                            { label: 'Supprimer', action: () => { handleDelete(actionSheetSong.id, { stopPropagation: () => {} }); setActionSheetSong(null); }, danger: true },
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={item.action}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    marginBottom: '0.5rem',
                                    background: 'var(--bg-tertiary)',
                                    color: item.danger ? 'var(--accent-danger)' : 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-lg)',
                                    fontSize: '0.9375rem',
                                    fontWeight: '400',
                                    textAlign: 'center',
                                    minHeight: '48px'
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setActionSheetSong(null)}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                marginTop: '0.5rem',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-lg)',
                                fontSize: '0.9375rem',
                                minHeight: '48px'
                            }}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
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
