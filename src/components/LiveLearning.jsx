import React, { useMemo } from 'react';
import { getFrenchNoteName } from '../models/song';

export function LiveLearning({ song }) {
    // Analyze and structure the song data
    const analysis = useMemo(() => {
        if (!song || !song.phrases || song.phrases.length === 0) {
            return null;
        }

        const measures = [];
        const allNotes = new Set();
        const allChords = new Set();

        song.phrases.forEach(phrase => {
            const phraseMeasures = getMeasuresFromPhrase(phrase);

            phraseMeasures.forEach(measure => {
                // Collect unique notes
                measure.melody.forEach(n => allNotes.add(n.pitch.slice(0, -1)));
                measure.chords.forEach(n => allChords.add(n.pitch.slice(0, -1)));

                // Build measure summary
                const chordGroup = groupNotesByTime(measure.chords);
                const chordName = chordGroup.length > 0
                    ? getFrenchNoteName(chordGroup[0].notes[0].pitch).split(/\d/)[0]
                    : '-';

                const melodyCount = measure.melody.length;
                const complexity = melodyCount > 8 ? 'high' : melodyCount > 4 ? 'medium' : 'low';

                measures.push({
                    number: measures.length + 1,
                    chordName,
                    chordNotes: chordGroup.length > 0 ? chordGroup[0].notes : [],
                    melodyCount,
                    complexity,
                    hasChord: chordGroup.length > 0,
                    melody: measure.melody
                });
            });
        });

        return {
            measures,
            totalMeasures: measures.length,
            key: song.key,
            tempo: song.tempo,
            uniqueNotes: Array.from(allNotes).sort(),
            uniqueChords: Array.from(allChords).sort()
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
        <div className="live-learning" style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                textAlign: 'center',
                marginBottom: '3rem',
                padding: '2rem',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-color)'
            }}>
                <h2 style={{
                    fontSize: '2.5rem',
                    marginBottom: '0.5rem',
                    background: 'var(--gradient-primary)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    ⚡ Live Learning
                </h2>
                <p style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                    {song.title}
                </p>
                <div style={{
                    display: 'flex',
                    gap: '2rem',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    fontSize: '1rem'
                }}>
                    <span>🎼 <strong>{analysis.key}</strong></span>
                    <span>⏱️ <strong>{analysis.tempo} BPM</strong></span>
                    <span>📊 <strong>{analysis.totalMeasures} mesures</strong></span>
                </div>
            </div>

            {/* Quick Reference Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
                marginBottom: '3rem'
            }}>
                {/* Notes Used */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1rem',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        🎹 Notes utilisées ({analysis.uniqueNotes.length})
                    </h3>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        {analysis.uniqueNotes.map(note => (
                            <span key={note} style={{
                                padding: '0.4rem 0.8rem',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                border: '1px solid var(--border-color)'
                            }}>
                                {note}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Complexity Overview */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1rem',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        📈 Aperçu de complexité
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <ComplexityBar
                            label="Facile"
                            count={analysis.measures.filter(m => m.complexity === 'low').length}
                            total={analysis.totalMeasures}
                            color="#10b981"
                        />
                        <ComplexityBar
                            label="Moyen"
                            count={analysis.measures.filter(m => m.complexity === 'medium').length}
                            total={analysis.totalMeasures}
                            color="#f59e0b"
                        />
                        <ComplexityBar
                            label="Difficile"
                            count={analysis.measures.filter(m => m.complexity === 'high').length}
                            total={analysis.totalMeasures}
                            color="#ef4444"
                        />
                    </div>
                </div>
            </div>

            {/* Main Timeline View */}
            <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{
                    color: 'var(--accent-primary)',
                    marginBottom: '1.5rem',
                    fontSize: '1.3rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    🎵 Progression complète du morceau
                </h3>

                {/* Legend */}
                <div style={{
                    display: 'flex',
                    gap: '1.5rem',
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    flexWrap: 'wrap',
                    fontSize: '0.9rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '20px', height: '20px', background: '#10b981', borderRadius: '4px' }}></div>
                        <span>Facile (≤4 notes)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '20px', height: '20px', background: '#f59e0b', borderRadius: '4px' }}></div>
                        <span>Moyen (5-8 notes)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '20px', height: '20px', background: '#ef4444', borderRadius: '4px' }}></div>
                        <span>Difficile (&gt;8 notes)</span>
                    </div>
                </div>

                {/* Measures Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem'
                }}>
                    {analysis.measures.map((measure, idx) => (
                        <MeasureCard key={idx} measure={measure} />
                    ))}
                </div>
            </div>

            {/* Tips */}
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
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1rem'
                }}>
                    <TipCard
                        icon="📍"
                        text="Concentrez-vous d'abord sur les mesures vertes (faciles)"
                    />
                    <TipCard
                        icon="🎵"
                        text="Apprenez les accords de base avant d'ajouter la mélodie"
                    />
                    <TipCard
                        icon="⏱️"
                        text={`Commencez à ${Math.round(analysis.tempo * 0.6)} BPM puis augmentez progressivement`}
                    />
                    <TipCard
                        icon="🔄"
                        text="Répétez chaque section difficile (rouge) séparément"
                    />
                </div>
            </div>
        </div>
    );
}

// Helper component for measure cards
function MeasureCard({ measure }) {
    const complexityColors = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#ef4444'
    };

    return (
        <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: `3px solid ${complexityColors[measure.complexity]}`,
            transition: 'all var(--transition-fast)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
        }}
        >
            {/* Measure number badge */}
            <div style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: complexityColors[measure.complexity],
                color: 'white',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold'
            }}>
                {measure.number}
            </div>

            {/* Chord info */}
            <div style={{ marginBottom: '0.75rem', paddingRight: '2rem' }}>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                }}>
                    Accord
                </div>
                <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: measure.hasChord ? 'var(--text-primary)' : 'var(--text-tertiary)'
                }}>
                    {measure.chordName}
                </div>
                {measure.chordNotes.length > 1 && (
                    <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.25rem'
                    }}>
                        {measure.chordNotes.map(n => getFrenchNoteName(n.pitch)).join(', ')}
                    </div>
                )}
            </div>

            {/* Melody density indicator */}
            <div>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                }}>
                    Mélodie
                </div>
                <div style={{
                    display: 'flex',
                    gap: '2px',
                    flexWrap: 'wrap'
                }}>
                    {Array.from({ length: Math.min(measure.melodyCount, 12) }).map((_, i) => (
                        <div key={i} style={{
                            width: '6px',
                            height: '6px',
                            background: 'var(--accent-secondary)',
                            borderRadius: '50%'
                        }} />
                    ))}
                    {measure.melodyCount > 12 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            +{measure.melodyCount - 12}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper component for complexity bars
function ComplexityBar({ label, count, total, color }) {
    const percentage = (count / total) * 100;

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem',
                fontSize: '0.9rem'
            }}>
                <span>{label}</span>
                <span style={{ fontWeight: 'bold' }}>{count} / {total}</span>
            </div>
            <div style={{
                height: '8px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: color,
                    transition: 'width var(--transition-normal)'
                }} />
            </div>
        </div>
    );
}

// Helper component for tips
function TipCard({ icon, text }) {
    return (
        <div style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '1rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
        }}>
            <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            <span style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{text}</span>
        </div>
    );
}

// Helper functions
function getMeasuresFromPhrase(phrase) {
    const measures = [];
    const EPSILON = 0.001;

    for (let i = 0; i < phrase.length; i++) {
        const measureStart = i * 4;
        const measureEnd = (i + 1) * 4;

        measures.push({
            melody: phrase.tracks.melody.filter(n =>
                n.startTime >= measureStart - EPSILON &&
                n.startTime < measureEnd - EPSILON
            ),
            chords: phrase.tracks.chords.filter(n =>
                n.startTime >= measureStart - EPSILON &&
                n.startTime < measureEnd - EPSILON
            )
        });
    }

    return measures;
}

function groupNotesByTime(notes) {
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
}
