import React, { useState, useEffect, useCallback } from 'react';
import { StorageService } from '../services/StorageService';
import { getFrenchKeyName } from '../models/song';

export function SongLibrary({ onLoadSong, onNewSong }) {
    const [songs, setSongs] = useState([]);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [mergeOnImport, setMergeOnImport] = useState(false);

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

                {/* Action Buttons */}
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
                    <button
                        onClick={onNewSong}
                        className="btn-primary"
                        style={{
                            padding: '0.75rem 2rem'
                        }}
                    >
                        Commencer maintenant
                    </button>
                </div>
            ) : (
                /* Song Cards Grid */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {songs.map((song) => (
                        <div
                            key={song.id}
                            onClick={() => onLoadSong(song.id)}
                            className="card"
                            style={{
                                cursor: 'pointer',
                                padding: '1.5rem'
                            }}
                        >
                            {/* Song Title */}
                            <h3 style={{
                                marginBottom: '1rem',
                                color: 'var(--text-primary)',
                                fontSize: '1.125rem',
                                fontWeight: '500',
                                letterSpacing: '-0.01em',
                                lineHeight: '1.3',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {song.title}
                            </h3>

                            {/* Song Metadata */}
                            <div style={{
                                fontSize: '0.875rem',
                                color: 'var(--text-tertiary)',
                                marginBottom: '1.5rem',
                                lineHeight: '1.8',
                                fontWeight: '300'
                            }}>
                                <p style={{ margin: '0.25rem 0' }}>
                                    {song.artist || 'Artiste inconnu'}
                                </p>
                                <p style={{
                                    margin: '0.5rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    <span style={{
                                        padding: '0.25rem 0.625rem',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.8125rem'
                                    }}>
                                        {getFrenchKeyName(song.key)}
                                    </span>
                                    <span style={{
                                        padding: '0.25rem 0.625rem',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.8125rem'
                                    }}>
                                        {song.tempo} BPM
                                    </span>
                                </p>
                                <p style={{
                                    fontSize: '0.8125rem',
                                    marginTop: '0.75rem',
                                    color: 'var(--text-muted)'
                                }}>
                                    {new Date(song.updatedAt || song.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                            </div>

                            {/* Delete Button */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                paddingTop: '1rem',
                                borderTop: '1px solid var(--border-color)'
                            }}>
                                <button
                                    onClick={(e) => handleDelete(song.id, e)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: 'transparent',
                                        color: 'var(--accent-danger)',
                                        border: '1px solid var(--accent-danger)',
                                        fontSize: '0.8125rem'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.stopPropagation();
                                        e.currentTarget.style.background = 'var(--accent-danger)';
                                        e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--accent-danger)';
                                    }}
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    ))}
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
