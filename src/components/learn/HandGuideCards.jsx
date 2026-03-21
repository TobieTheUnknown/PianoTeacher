import React from 'react';

export const HandGuideCards = React.memo(function HandGuideCards({
    measure, displayNoteName, keySignature, isMobile
}) {
    if (!measure) return null;

    const melodyNotes = measure.sortedMelody || [];
    const chordName = measure.detectedChord?.displayName;
    const chordNotes = measure.chords || [];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '0.75rem',
        }}>
            {/* Right hand (Melody) */}
            <div className="card" style={{
                padding: '0.75rem',
                borderLeft: '3px solid #60a5fa',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                }}>
                    <span style={{
                        fontSize: '0.75rem',
                        color: '#60a5fa',
                        fontWeight: 600,
                    }}>
                        🎵 Main Droite (Mélodie)
                    </span>
                    <span style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-tertiary)',
                    }}>
                        {melodyNotes.length} notes
                    </span>
                </div>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.3rem',
                    minHeight: '1.5rem',
                }}>
                    {melodyNotes.length > 0 ? (
                        melodyNotes.slice(0, 8).map((n, i) => (
                            <span key={n.id || i} style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: i === 0 ? '#60a5fa' : 'var(--bg-primary)',
                                border: i === 0 ? '1px solid #60a5fa' : '1px solid var(--border-color)',
                                color: i === 0 ? 'white' : 'var(--text-primary)',
                                fontSize: '0.75rem',
                                fontWeight: i === 0 ? 'bold' : 'normal',
                            }}>
                                {displayNoteName(n.pitch, keySignature)}
                            </span>
                        ))
                    ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Aucune
                        </span>
                    )}
                    {melodyNotes.length > 8 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                            +{melodyNotes.length - 8}
                        </span>
                    )}
                </div>
            </div>

            {/* Left hand (Chords) */}
            <div className="card" style={{
                padding: '0.75rem',
                borderLeft: '3px solid #f472b6',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                }}>
                    <span style={{
                        fontSize: '0.75rem',
                        color: '#f472b6',
                        fontWeight: 600,
                    }}>
                        🎹 Main Gauche (Accords)
                    </span>
                    <span style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-tertiary)',
                    }}>
                        {measure.chordGroups?.length || 0} notes
                    </span>
                </div>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.3rem',
                    minHeight: '1.5rem',
                }}>
                    {chordName && (
                        <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: '#f472b6',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                        }}>
                            {chordName}
                        </span>
                    )}
                    {chordNotes.length > 0 ? (
                        // Show unique pitches
                        [...new Set(chordNotes.map(n => n.pitch))].slice(0, 6).map((pitch, i) => (
                            <span key={i} style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: !chordName && i === 0 ? '#f472b6' : 'var(--bg-primary)',
                                border: !chordName && i === 0 ? '1px solid #f472b6' : '1px solid var(--border-color)',
                                color: !chordName && i === 0 ? 'white' : 'var(--text-primary)',
                                fontSize: '0.75rem',
                                fontWeight: !chordName && i === 0 ? 'bold' : 'normal',
                            }}>
                                {displayNoteName(pitch, keySignature)}
                            </span>
                        ))
                    ) : (
                        !chordName && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Aucune
                            </span>
                        )
                    )}
                </div>
            </div>
        </div>
    );
});
