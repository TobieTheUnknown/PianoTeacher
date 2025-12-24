import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/StorageService';
import { getFrenchKeyName } from '../models/song';

export function SongLibrary({ onLoadSong, onNewSong }) {
    const [songs, setSongs] = useState([]);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [mergeOnImport, setMergeOnImport] = useState(false);

    useEffect(() => {
        loadSongs();
    }, []);

    const loadSongs = () => {
        setSongs(StorageService.getSongs());
    };

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
            } catch (error) {
                alert('Erreur lors de l\'import du fichier JSON.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="song-library">
            {/* Premium Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2.5rem',
                paddingBottom: '1.5rem',
                borderBottom: '1.5px solid var(--border-light)',
                position: 'relative'
            }}>
                {/* Header glow effect */}
                <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    right: '0',
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
                    opacity: 0.5
                }} />

                <div style={{ animation: 'slideInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    <h2 style={{
                        fontSize: '2rem',
                        marginBottom: '0.5rem',
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        fontWeight: '800',
                        letterSpacing: '-0.02em'
                    }}>
                        Ma Bibliothèque
                    </h2>
                    <p style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '1rem',
                        margin: 0,
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            fontSize: '0.8125rem',
                            fontWeight: '700'
                        }}>
                            {songs.length}
                        </span>
                        {songs.length === 1 ? 'morceau' : 'morceaux'}
                    </p>
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    animation: 'fadeInScale 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s backwards'
                }}>
                    <button
                        onClick={handleOpenLibraryModal}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1.5px solid var(--border-light)',
                            borderRadius: 'var(--radius-2xl)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all var(--transition-normal)',
                            color: 'var(--text-primary)',
                            boxShadow: 'var(--shadow-md)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
                            e.currentTarget.style.borderColor = 'var(--border-accent)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            e.currentTarget.style.borderColor = 'var(--border-light)';
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>📁</span>
                        <span>Import/Export</span>
                    </button>

                    <button
                        onClick={onNewSong}
                        style={{
                            padding: '0.75rem 2rem',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-2xl)',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            boxShadow: 'var(--shadow-glow-sm), var(--shadow-lg)',
                            transition: 'all var(--transition-normal)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-glow), var(--shadow-xl)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'var(--shadow-glow-sm), var(--shadow-lg)';
                        }}
                    >
                        <span style={{ fontSize: '1.25rem', fontWeight: '400' }}>+</span>
                        <span>Nouveau Morceau</span>
                    </button>
                </div>
            </div>

            {/* Empty State - Premium Design */}
            {songs.length === 0 ? (
                <div className="card" style={{
                    textAlign: 'center',
                    padding: '3.5rem 2rem',
                    background: 'var(--glass-bg-strong)',
                    border: '2px dashed var(--border-light)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Decorative background elements */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '500px',
                        height: '500px',
                        background: 'radial-gradient(circle, rgba(167, 139, 250, 0.08) 0%, transparent 70%)',
                        filter: 'blur(60px)',
                        pointerEvents: 'none'
                    }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{
                            fontSize: '3.5rem',
                            marginBottom: '1rem',
                            animation: 'float 4s ease-in-out infinite',
                            filter: 'drop-shadow(0 10px 30px rgba(167, 139, 250, 0.3))'
                        }}>
                            🎼
                        </div>
                        <h3 style={{
                            color: 'var(--text-primary)',
                            marginBottom: '0.75rem',
                            fontSize: '1.5rem',
                            fontWeight: '700'
                        }}>
                            Votre bibliothèque est vide
                        </h3>
                        <p style={{
                            color: 'var(--text-tertiary)',
                            fontSize: '1rem',
                            maxWidth: '500px',
                            margin: '0 auto 2rem',
                            lineHeight: '1.8'
                        }}>
                            Créez votre premier morceau et commencez votre voyage musical
                        </p>
                        <button
                            onClick={onNewSong}
                            style={{
                                padding: '0.875rem 2.25rem',
                                background: 'var(--gradient-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-2xl)',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '1rem',
                                boxShadow: 'var(--shadow-glow), var(--shadow-xl)',
                                transition: 'all var(--transition-normal)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-glow-lg)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'var(--shadow-glow), var(--shadow-xl)';
                            }}
                        >
                            Commencer maintenant
                        </button>
                    </div>
                </div>
            ) : (
                /* Premium Song Cards Grid */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '2rem'
                }}>
                    {songs.map((song, index) => (
                        <div
                            key={song.id}
                            onClick={() => onLoadSong(song.id)}
                            className="card"
                            style={{
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
                                border: '1.5px solid var(--border-light)',
                                transition: 'all var(--transition-normal)',
                                animation: `fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s backwards`
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = 'var(--border-accent-strong)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-2xl), var(--shadow-glow-sm)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.borderColor = 'var(--border-light)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
                            }}
                        >
                            {/* Gradient accent bar - Premium style */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '5px',
                                background: 'var(--gradient-primary)',
                                boxShadow: '0 2px 10px rgba(167, 139, 250, 0.3)'
                            }} />

                            {/* Card glow on hover */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '120%',
                                height: '120%',
                                background: 'radial-gradient(circle, rgba(167, 139, 250, 0.1) 0%, transparent 70%)',
                                filter: 'blur(40px)',
                                opacity: 0,
                                transition: 'opacity var(--transition-normal)',
                                pointerEvents: 'none'
                            }} />

                            {/* Music note icon with gradient */}
                            <div style={{
                                fontSize: '2.25rem',
                                marginBottom: '1rem',
                                marginTop: '0.5rem',
                                background: 'var(--gradient-secondary)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                filter: 'drop-shadow(0 0 20px rgba(167, 139, 250, 0.3))'
                            }}>
                                🎵
                            </div>

                            {/* Song Title */}
                            <h3 style={{
                                marginBottom: '1rem',
                                color: 'var(--text-primary)',
                                fontSize: '1.375rem',
                                fontWeight: '700',
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
                                fontSize: '0.9375rem',
                                color: 'var(--text-tertiary)',
                                marginBottom: '2rem',
                                lineHeight: '2'
                            }}>
                                <p style={{
                                    margin: '0.5rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--glass-bg-strong)',
                                        fontSize: '0.875rem'
                                    }}>👤</span>
                                    <span style={{ fontWeight: '500' }}>{song.artist || 'Artiste inconnu'}</span>
                                </p>
                                <p style={{
                                    margin: '0.5rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        padding: '0.375rem 0.75rem',
                                        background: 'var(--glass-bg-strong)',
                                        borderRadius: 'var(--radius-lg)',
                                        fontSize: '0.875rem',
                                        fontWeight: '600'
                                    }}>
                                        🎹 {getFrenchKeyName(song.key)}
                                    </span>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        padding: '0.375rem 0.75rem',
                                        background: 'var(--glass-bg-strong)',
                                        borderRadius: 'var(--radius-lg)',
                                        fontSize: '0.875rem',
                                        fontWeight: '600'
                                    }}>
                                        ⏱️ {song.tempo} BPM
                                    </span>
                                </p>
                                <p style={{
                                    fontSize: '0.8125rem',
                                    marginTop: '1rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: '500'
                                }}>
                                    Modifié le {new Date(song.updatedAt || song.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                            </div>

                            {/* Delete Button - Enhanced */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                paddingTop: '1.25rem',
                                borderTop: '1.5px solid var(--border-light)'
                            }}>
                                <button
                                    onClick={(e) => handleDelete(song.id, e)}
                                    style={{
                                        padding: '0.625rem 1.25rem',
                                        background: 'transparent',
                                        color: 'var(--accent-danger)',
                                        border: '1.5px solid var(--accent-danger)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        transition: 'all var(--transition-normal)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.stopPropagation();
                                        e.currentTarget.style.background = 'var(--gradient-danger)';
                                        e.currentTarget.style.color = 'white';
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                        e.currentTarget.style.boxShadow = '0 0 20px rgba(248, 113, 113, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--accent-danger)';
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <span>🗑️</span>
                                    <span>Supprimer</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Library Import/Export Modal - Premium Design */}
            {showLibraryModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(5, 8, 17, 0.85)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '2rem',
                    animation: 'fadeIn 0.3s ease-out'
                }}
                onClick={() => setShowLibraryModal(false)}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: '900px',
                            width: '100%',
                            maxHeight: '85vh',
                            overflow: 'auto',
                            padding: '2rem',
                            background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
                            boxShadow: 'var(--shadow-2xl), var(--shadow-glow)',
                            animation: 'fadeInScale 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{
                            marginBottom: '2rem',
                            background: 'var(--gradient-primary)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            fontSize: '1.75rem',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>📁</span>
                            <span>Import / Export Bibliothèque</span>
                        </h2>

                        {/* Merge Option - Enhanced */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.25rem',
                            background: 'var(--glass-bg-strong)',
                            borderRadius: 'var(--radius-xl)',
                            border: '1.5px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem'
                        }}>
                            <input
                                type="checkbox"
                                id="merge-library"
                                checked={mergeOnImport}
                                onChange={(e) => setMergeOnImport(e.target.checked)}
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    cursor: 'pointer',
                                    accentColor: 'var(--accent-primary)'
                                }}
                            />
                            <label htmlFor="merge-library" style={{
                                cursor: 'pointer',
                                fontSize: '0.9375rem',
                                color: 'var(--text-primary)',
                                fontWeight: '600'
                            }}>
                                Fusionner avec la bibliothèque existante (au lieu de remplacer)
                            </label>
                        </div>

                        {/* JSON Section - Premium */}
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-xl)',
                            border: '1.5px solid var(--border-light)'
                        }}>
                            <h3 style={{
                                marginBottom: '1rem',
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ fontSize: '1.125rem' }}>📄</span>
                                <span>Export / Import JSON</span>
                            </h3>
                            <p style={{
                                color: 'var(--text-tertiary)',
                                marginBottom: '1.25rem',
                                fontSize: '0.9375rem',
                                lineHeight: '1.6'
                            }}>
                                Format JSON pour sauvegarder toute votre bibliothèque
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => {
                                        StorageService.exportLibrary();
                                        alert('Bibliothèque exportée !');
                                    }}
                                    style={{
                                        background: 'var(--gradient-success)',
                                        color: 'white',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: 'var(--radius-xl)',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '0.875rem',
                                        boxShadow: 'var(--shadow-lg)',
                                        transition: 'all var(--transition-normal)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-xl), 0 0 30px rgba(52, 211, 153, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                    }}
                                >
                                    <span style={{ fontSize: '1rem' }}>📤</span>
                                    <span>Exporter JSON</span>
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
                                    <button style={{
                                        backgroundColor: 'var(--bg-card)',
                                        border: '1.5px solid var(--border-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: 'var(--radius-xl)',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '0.875rem',
                                        color: 'var(--text-primary)',
                                        boxShadow: 'var(--shadow-md)',
                                        transition: 'all var(--transition-normal)'
                                    }}>
                                        <span style={{ fontSize: '1rem' }}>📥</span>
                                        <span>Importer JSON</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Close Button - Premium */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setShowLibraryModal(false)}
                                style={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    border: '1.5px solid var(--border-light)',
                                    padding: '0.75rem 2rem',
                                    borderRadius: 'var(--radius-xl)',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-primary)',
                                    boxShadow: 'var(--shadow-md)',
                                    transition: 'all var(--transition-normal)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
                                    e.currentTarget.style.borderColor = 'var(--border-accent)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    e.currentTarget.style.borderColor = 'var(--border-light)';
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
