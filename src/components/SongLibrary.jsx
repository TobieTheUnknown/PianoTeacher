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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Ma Bibliothèque</h2>
                <button
                    onClick={onNewSong}
                    style={{
                        padding: '0.8rem 1.5rem',
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    + Nouveau Morceau
                </button>
            </div>

            {songs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <p>Aucun morceau sauvegardé.</p>
                    <p>Créez un nouveau morceau et sauvegardez-le pour le voir apparaître ici.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    {songs.map(song => (
                        <div
                            key={song.id}
                            onClick={() => onLoadSong(song.id)}
                            className="card"
                            style={{
                                cursor: 'pointer',
                                transition: 'transform 0.2s, border-color 0.2s',
                                border: '1px solid var(--border-color)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                        >
                            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{song.title}</h3>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                <p>{song.artist || 'Artiste inconnu'}</p>
                                <p>{song.key} • {song.tempo} BPM</p>
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                    Modifié le {new Date(song.updatedAt || song.createdAt).toLocaleDateString()}
                                </p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={(e) => handleDelete(song.id, e)}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        backgroundColor: 'transparent',
                                        color: '#ff4444',
                                        border: '1px solid #ff4444',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
