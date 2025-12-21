import React, { useMemo } from 'react';
import { getFrenchNoteName } from '../models/song';

export function LiveLearning({ song }) {
    // Analyze the song to extract key information
    const analysis = useMemo(() => {
        if (!song || !song.phrases || song.phrases.length === 0) {
            return null;
        }

        // Collect all unique notes from melody and chords
        const allNotes = new Set();
        const chordProgression = [];
        const melodyNotes = [];

        song.phrases.forEach(phrase => {
            // Extract melody notes
            phrase.tracks.melody.forEach(note => {
                const noteName = note.pitch.slice(0, -1); // Remove octave
                allNotes.add(noteName);
                melodyNotes.push(note.pitch);
            });

            // Extract chord notes and build progression
            const chordsByMeasure = groupChordsByMeasure(phrase);
            chordsByMeasure.forEach(measure => {
                measure.chords.forEach(chord => {
                    chord.notes.forEach(note => {
                        const noteName = note.pitch.slice(0, -1);
                        allNotes.add(noteName);
                    });

                    // Identify chord type
                    const chordName = identifyChord(chord.notes);
                    if (chordName && !chordProgression.some(c => c.name === chordName)) {
                        chordProgression.push({ name: chordName, notes: chord.notes });
                    }
                });
            });
        });

        // Detect alterations (sharps/flats)
        const alterations = Array.from(allNotes).filter(note =>
            note.includes('#') || note.includes('b')
        );

        // Count note frequencies for melody
        const noteFrequency = {};
        melodyNotes.forEach(note => {
            noteFrequency[note] = (noteFrequency[note] || 0) + 1;
        });

        // Get most common notes
        const topNotes = Object.entries(noteFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([note]) => note);

        return {
            key: song.key,
            tempo: song.tempo,
            allNotes: Array.from(allNotes).sort(),
            chordProgression,
            alterations,
            topNotes,
            totalMeasures: song.phrases.reduce((sum, p) => sum + p.length, 0)
        };
    }, [song]);

    if (!analysis) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                Aucun morceau chargé. Importez un fichier MIDI pour commencer.
            </div>
        );
    }

    return (
        <div className="live-learning">
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                    Live Learning
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    Vue d'ensemble de "{song.title}"
                </p>
            </div>

            {/* Main Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem',
                maxWidth: '1400px',
                margin: '0 auto'
            }}>
                {/* Key & Tempo Card */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>🎼</span>
                        Informations de base
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <InfoRow label="Tonalité" value={analysis.key} />
                        <InfoRow label="Tempo" value={`${analysis.tempo} BPM`} />
                        <InfoRow label="Mesures" value={analysis.totalMeasures} />
                    </div>
                </div>

                {/* Scale/Notes Card */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>🎹</span>
                        Notes utilisées
                    </h3>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '1.5rem'
                    }}>
                        {analysis.allNotes.map(note => (
                            <span key={note} style={{
                                padding: '0.5rem 1rem',
                                background: 'var(--gradient-primary)',
                                color: 'white',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                boxShadow: 'var(--shadow-md)'
                            }}>
                                {note}
                            </span>
                        ))}
                    </div>

                    {analysis.alterations.length > 0 && (
                        <>
                            <h4 style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem',
                                marginBottom: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Altérations importantes
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {analysis.alterations.map(note => (
                                    <span key={note} style={{
                                        padding: '0.4rem 0.8rem',
                                        background: 'var(--bg-tertiary)',
                                        border: '2px solid var(--accent-secondary)',
                                        color: 'var(--accent-secondary)',
                                        borderRadius: '6px',
                                        fontWeight: 'bold'
                                    }}>
                                        {note}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Chord Progression Card */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>🎸</span>
                        Progression d'accords
                    </h3>

                    {analysis.chordProgression.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {analysis.chordProgression.map((chord, idx) => (
                                <div key={idx} style={{
                                    padding: '1rem',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '8px',
                                    borderLeft: '4px solid var(--accent-secondary)'
                                }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.3rem' }}>
                                        {chord.name}
                                    </div>
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        gap: '0.5rem',
                                        flexWrap: 'wrap'
                                    }}>
                                        {chord.notes.map((note, i) => (
                                            <span key={i}>{getFrenchNoteName(note.pitch)}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Pas d'accords détectés
                        </p>
                    )}
                </div>

                {/* Top Melody Notes Card */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>⭐</span>
                        Notes principales de la mélodie
                    </h3>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                        gap: '0.75rem'
                    }}>
                        {analysis.topNotes.map((note, idx) => (
                            <div key={idx} style={{
                                padding: '1rem',
                                background: `linear-gradient(135deg, ${
                                    idx === 0 ? 'var(--accent-primary)' : 'var(--accent-secondary)'
                                } 0%, ${
                                    idx === 0 ? 'var(--accent-secondary)' : 'var(--bg-tertiary)'
                                } 100%)`,
                                color: idx < 3 ? 'white' : 'var(--text-primary)',
                                borderRadius: '12px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                fontSize: '1.1rem',
                                boxShadow: idx < 3 ? 'var(--shadow-md)' : 'none',
                                border: idx >= 3 ? '2px solid var(--border-color)' : 'none'
                            }}>
                                {getFrenchNoteName(note)}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Tips Card */}
                <div className="card" style={{
                    padding: '2rem',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                    border: '2px solid var(--accent-primary)'
                }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.5rem' }}>💡</span>
                        Conseils d'apprentissage
                    </h3>

                    <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        <li style={{ display: 'flex', gap: '0.5rem' }}>
                            <span>📍</span>
                            <span>Commencez par apprendre les notes principales en gras</span>
                        </li>
                        <li style={{ display: 'flex', gap: '0.5rem' }}>
                            <span>🎵</span>
                            <span>Pratiquez les accords un par un avant de jouer la progression</span>
                        </li>
                        <li style={{ display: 'flex', gap: '0.5rem' }}>
                            <span>🎹</span>
                            <span>Familiarisez-vous avec les altérations (# et ♭)</span>
                        </li>
                        <li style={{ display: 'flex', gap: '0.5rem' }}>
                            <span>⏱️</span>
                            <span>Utilisez un métronome à {Math.round(analysis.tempo * 0.7)} BPM pour débuter</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

// Helper component for info rows
function InfoRow({ label, value }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px'
        }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{label}</span>
            <span style={{
                fontWeight: 'bold',
                fontSize: '1.1rem',
                color: 'var(--text-primary)'
            }}>
                {value}
            </span>
        </div>
    );
}

// Helper function to group chords by measure
function groupChordsByMeasure(phrase) {
    const measures = [];
    const EPSILON = 0.001;

    for (let i = 0; i < phrase.length; i++) {
        const measureStart = i * 4;
        const measureEnd = (i + 1) * 4;

        const chordNotes = phrase.tracks.chords.filter(n =>
            n.startTime >= measureStart - EPSILON &&
            n.startTime < measureEnd - EPSILON
        );

        // Group notes by start time
        const groups = [];
        const sorted = [...chordNotes].sort((a, b) => a.startTime - b.startTime);

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

        measures.push({
            index: i + 1,
            chords: groups
        });
    }

    return measures;
}

// Helper function to identify chord type (simplified)
function identifyChord(notes) {
    if (notes.length === 0) return null;

    // Get root note (bass/lowest note)
    const root = notes[0].pitch.slice(0, -1);

    // Simple chord identification based on number of notes
    if (notes.length === 1) {
        return root;
    } else if (notes.length === 2) {
        return `${root} (powerchord)`;
    } else if (notes.length >= 3) {
        return `${root} (accord)`;
    }

    return root;
}
