import React from 'react';
import { getFrenchNoteName } from '../models/song';

import { audioEngine } from '../services/AudioEngine';

export function SongViewer({ song }) {
    // Helper to group notes by measure
    const getMeasures = (phrase) => {
        const measures = [];
        for (let i = 0; i < phrase.length; i++) {
            measures.push({
                index: i + 1,
                melody: phrase.tracks.melody.filter(n => n.startTime >= i * 4 && n.startTime < (i + 1) * 4),
                chords: phrase.tracks.chords.filter(n => n.startTime >= i * 4 && n.startTime < (i + 1) * 4)
            });
        }
        return measures;
    };

    // Helper to group notes by start time (chords)
    const groupNotes = (notes) => {
        const groups = [];
        const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

        sorted.forEach(note => {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup && Math.abs(lastGroup.startTime - note.startTime) < 0.1) {
                lastGroup.notes.push(note);
            } else {
                groups.push({
                    startTime: note.startTime,
                    notes: [note]
                });
            }
        });
        return groups;
    };

    const handlePlayNotes = async (notes) => {
        await audioEngine.initialize();
        audioEngine.playNotes(notes, song.tempo);
    };

    return (
        <div className="song-viewer">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{song.title}</h2>
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <span>Tonalité: <strong style={{ color: 'var(--text-primary)' }}>{song.key}</strong></span>
                    <span>Tempo: <strong style={{ color: 'var(--text-primary)' }}>{song.tempo} BPM</strong></span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                {song.phrases.map((phrase) => (
                    <div key={phrase.id}>
                        <h3 style={{
                            color: 'var(--accent-primary)',
                            borderBottom: '2px solid var(--bg-tertiary)',
                            paddingBottom: '0.5rem',
                            marginBottom: '1.5rem'
                        }}>
                            {phrase.name}
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {getMeasures(phrase).map((measure) => (
                                <div key={measure.index} className="card" style={{ padding: '1.5rem' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '1rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        paddingBottom: '0.5rem'
                                    }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>Mesure {measure.index}</span>
                                    </div>

                                    {/* Left Hand (Chords) - NOW FIRST */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                backgroundColor: 'var(--accent-secondary)'
                                            }} />
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Main Gauche (Accords)</span>
                                            <button
                                                onClick={() => handlePlayNotes(measure.chords)}
                                                style={{
                                                    marginLeft: 'auto',
                                                    padding: '0.2rem 0.5rem',
                                                    fontSize: '0.8rem',
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid var(--accent-secondary)',
                                                    color: 'var(--accent-secondary)',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ▶
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                            {measure.chords.length > 0 ? (
                                                groupNotes(measure.chords).map((group, i) => (
                                                    <div key={i} style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        backgroundColor: 'var(--bg-tertiary)',
                                                        padding: '0.5rem',
                                                        borderRadius: '4px',
                                                        borderLeft: '3px solid var(--accent-secondary)'
                                                    }}>
                                                        {/* Main Note (Root/Bass) */}
                                                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                                            {getFrenchNoteName(group.notes[0].pitch)}
                                                        </span>
                                                        {/* Details if multiple notes */}
                                                        {group.notes.length > 1 && (
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                ({group.notes.map(n => getFrenchNoteName(n.pitch)).join(', ')})
                                                            </span>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>Silence</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Hand (Melody) */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                backgroundColor: 'var(--accent-primary)'
                                            }} />
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Main Droite (Mélodie)</span>
                                            <button
                                                onClick={() => handlePlayNotes(measure.melody)}
                                                style={{
                                                    marginLeft: 'auto',
                                                    padding: '0.2rem 0.5rem',
                                                    fontSize: '0.8rem',
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid var(--accent-primary)',
                                                    color: 'var(--accent-primary)',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ▶
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {measure.melody.length > 0 ? (
                                                measure.melody.sort((a, b) => a.startTime - b.startTime).map(n => (
                                                    <span key={n.id} style={{
                                                        fontWeight: 'bold',
                                                        color: 'var(--text-primary)',
                                                        backgroundColor: 'var(--bg-tertiary)',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px'
                                                    }}>
                                                        {getFrenchNoteName(n.pitch)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>Silence</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Visual Timeline Bar (Simplified) */}
                                    <div style={{
                                        marginTop: '1.5rem',
                                        height: '4px',
                                        backgroundColor: 'var(--bg-tertiary)',
                                        position: 'relative',
                                        borderRadius: '2px'
                                    }}>
                                        {/* Melody Dots */}
                                        {measure.melody.map(n => (
                                            <div key={n.id} style={{
                                                position: 'absolute',
                                                left: `${((n.startTime % 4) / 4) * 100}%`,
                                                top: '-3px',
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--accent-primary)',
                                                border: '2px solid var(--bg-secondary)'
                                            }} title={`MD: ${getFrenchNoteName(n.pitch)}`} />
                                        ))}
                                        {/* Chord Dots */}
                                        {measure.chords.map(n => (
                                            <div key={n.id} style={{
                                                position: 'absolute',
                                                left: `${((n.startTime % 4) / 4) * 100}%`,
                                                bottom: '-3px',
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--accent-secondary)',
                                                border: '2px solid var(--bg-secondary)'
                                            }} title={`MG: ${getFrenchNoteName(n.pitch)}`} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
