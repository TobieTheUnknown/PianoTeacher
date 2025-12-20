import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/StorageService';

export function SongLibrary({ onLoadSong, onNewSong }) {
    const [songs, setSongs] = useState([]);

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

    return (
        <div className="song-library">
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '3rem'
            }}>
                <div>
                    <h2 style={{
                        fontSize: '2.5rem',
                        marginBottom: '0.5rem',
                        background: 'var(--gradient-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        Ma Bibliothèque
                    </h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '1rem',
                        margin: 0
                    }}>
                        {songs.length} {songs.length === 1 ? 'morceau' : 'morceaux'}
                    </p>
                </div>
                <button
                    onClick={onNewSong}
                    style={{
                        padding: '1rem 2rem',
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: 'var(--shadow-glow)',
                        transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-xl), var(--shadow-glow)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                    }}
                >
                    <span style={{ fontSize: '1.2rem' }}>+</span>
                    <span>Nouveau Morceau</span>
                </button>
            </div>

            {songs.length === 0 ? (
                <div className="card" style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    background: 'var(--glass-bg)',
                    border: '2px dashed var(--border-light)'
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎼</div>
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
                        Aucun morceau sauvegardé
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
                        Créez votre premier morceau et commencez votre voyage musical
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '2rem'
                }}>
                    {songs.map(song => (
                        <div
                            key={song.id}
                            onClick={() => onLoadSong(song.id)}
                            className="card"
                            style={{
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                background: 'linear-gradient(145deg, var(--bg-secondary) 0%, rgba(30, 36, 53, 0.8) 100%)',
                                border: '1px solid var(--border-color)',
                                transition: 'all var(--transition-normal)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-xl), 0 0 30px rgba(139, 92, 246, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                            }}
                        >
                            {/* Gradient accent bar */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '4px',
                                background: 'var(--gradient-primary)'
                            }} />

                            {/* Music note icon */}
                            <div style={{
                                fontSize: '2.5rem',
                                marginBottom: '1rem',
                                opacity: 0.9
                            }}>
                                🎵
                            </div>

                            <h3 style={{
                                marginBottom: '1rem',
                                color: 'var(--text-primary)',
                                fontSize: '1.5rem',
                                fontWeight: '700'
                            }}>
                                {song.title}
                            </h3>

                            <div style={{
                                fontSize: '0.9375rem',
                                color: 'var(--text-secondary)',
                                marginBottom: '1.5rem',
                                lineHeight: '1.8'
                            }}>
                                <p style={{ margin: '0.25rem 0' }}>
                                    👤 {song.artist || 'Artiste inconnu'}
                                </p>
                                <p style={{ margin: '0.25rem 0' }}>
                                    🎹 {song.key} • ⏱️ {song.tempo} BPM
                                </p>
                                <p style={{
                                    fontSize: '0.8125rem',
                                    marginTop: '0.75rem',
                                    color: 'var(--text-tertiary)'
                                }}>
                                    Modifié le {new Date(song.updatedAt || song.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                            </div>

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
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        transition: 'all var(--transition-fast)'
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
                                    🗑️ Supprimer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
