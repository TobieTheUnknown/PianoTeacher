import React, { useMemo, useState } from 'react';
import { getFrenchNoteName, getPianoRollKeys } from '../models/song';
import { audioEngine } from '../services/AudioEngine';

export function LiveLearning({ song, onToggleHighlight }) {
    const [showDetails, setShowDetails] = useState(false);

    // Analyze and structure the song data
    const analysis = useMemo(() => {
        if (!song || !song.phrases || song.phrases.length === 0) {
            return null;
        }

        const measures = [];
        const allNotes = new Set();
        const phraseBreaks = []; // Track where each phrase starts

        song.phrases.forEach((phrase, phraseIndex) => {
            // Mark the start of this phrase
            if (phraseIndex > 0) {
                phraseBreaks.push({
                    measureIndex: measures.length,
                    phraseName: phrase.name
                });
            }

            const phraseMeasures = getMeasuresFromPhrase(phrase);

            phraseMeasures.forEach(measure => {
                // Collect unique notes
                measure.melody.forEach(n => allNotes.add(n.pitch.slice(0, -1)));
                measure.chords.forEach(n => allNotes.add(n.pitch.slice(0, -1)));

                // Build measure summary - get ALL chord groups
                const chordGroups = groupNotesByTime(measure.chords);

                measures.push({
                    number: measures.length + 1,
                    chordGroups, // All chord groups in this measure
                    melodyCount: measure.melody.length,
                    hasChord: chordGroups.length > 0,
                    melody: measure.melody,
                    chords: measure.chords
                });
            });
        });

        return {
            measures,
            phraseBreaks,
            totalMeasures: measures.length,
            key: song.key,
            tempo: song.tempo,
            uniqueNotes: Array.from(allNotes).sort()
        };
    }, [song]);

    const handlePlayMeasure = async (measure) => {
        await audioEngine.initialize();

        // Combine melody and chords for playback
        const allNotes = [...measure.melody, ...measure.chords];

        if (allNotes.length > 0) {
            audioEngine.playNotes(allNotes, song.tempo);
        }
    };

    if (!analysis) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                Aucun morceau chargé. Importez un fichier MIDI pour commencer.
            </div>
        );
    }

    // Group measures by 4
    const measureGroups = [];
    for (let i = 0; i < analysis.measures.length; i += 4) {
        measureGroups.push(analysis.measures.slice(i, i + 4));
    }

    const highlightedMeasures = song.highlightedMeasures || [];

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

            {/* Quick Reference */}
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

                {/* Instructions */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        marginBottom: '1rem',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        💡 Mode d'emploi
                    </h3>
                    <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>🎵 <strong>Cliquez sur une mesure</strong> pour l'écouter</div>
                        <div>🔢 <strong>Cliquez sur le numéro</strong> pour surligner</div>
                        <div>👁️ <strong>Activez les détails</strong> pour voir les notes</div>
                    </div>
                </div>
            </div>

            {/* Main Timeline View */}
            <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{
                        color: 'var(--accent-primary)',
                        fontSize: '1.3rem',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        🎵 Progression complète du morceau
                    </h3>

                    {/* Toggle Details Button */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        style={{
                            background: showDetails ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                            color: showDetails ? 'white' : 'var(--text-primary)',
                            border: showDetails ? 'none' : '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: showDetails ? 'var(--shadow-glow)' : 'var(--shadow-sm)'
                        }}
                    >
                        <span>{showDetails ? '👁️' : '👁️‍🗨️'}</span>
                        <span>{showDetails ? 'Masquer les détails' : 'Afficher les détails'}</span>
                    </button>
                </div>

                {/* Measures grouped by 4 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {measureGroups.map((group, groupIdx) => {
                        // Check if there's a phrase break in this group
                        const phraseBreakInGroup = analysis.phraseBreaks.find(
                            pb => pb.measureIndex >= group[0].number - 1 && pb.measureIndex < group[group.length - 1].number
                        );
                        const breakIndex = phraseBreakInGroup ? phraseBreakInGroup.measureIndex - (group[0].number - 1) : -1;

                        return (
                            <div key={groupIdx}>
                                {/* Phrase separator if this group starts with a new phrase */}
                                {analysis.phraseBreaks.some(pb => pb.measureIndex === group[0].number - 1) && (
                                    <div style={{
                                        marginBottom: '1rem',
                                        padding: '0.75rem 1.5rem',
                                        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                                        borderLeft: '4px solid var(--accent-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 'bold',
                                        fontSize: '1.1rem',
                                        color: 'var(--text-primary)'
                                    }}>
                                        🎵 {analysis.phraseBreaks.find(pb => pb.measureIndex === group[0].number - 1).phraseName}
                                    </div>
                                )}

                                {/* Group label */}
                                <div style={{
                                    marginBottom: '0.75rem',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 'bold'
                                }}>
                                    Mesures {group[0].number} - {group[group.length - 1].number}
                                </div>

                                {/* 4 measures per row */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '1rem'
                                }}>
                                    {group.map((measure, idx) => (
                                        <React.Fragment key={measure.number}>
                                            {/* Insert phrase separator mid-group if needed */}
                                            {idx === breakIndex && (
                                                <div style={{
                                                    gridColumn: '1 / -1',
                                                    marginTop: '1rem',
                                                    marginBottom: '1rem',
                                                    padding: '0.75rem 1.5rem',
                                                    background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                                                    borderLeft: '4px solid var(--accent-primary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: 'bold',
                                                    fontSize: '1.1rem',
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    🎵 {phraseBreakInGroup.phraseName}
                                                </div>
                                            )}
                                            <MeasureCard
                                                measure={measure}
                                                isHighlighted={highlightedMeasures.includes(measure.number)}
                                                onToggleHighlight={onToggleHighlight}
                                                onPlay={handlePlayMeasure}
                                                showDetails={showDetails}
                                            />
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
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
                        text="Surlignez les mesures difficiles pour les retrouver facilement"
                    />
                    <TipCard
                        icon="🎵"
                        text="Écoutez chaque mesure avant de la jouer pour mémoriser la mélodie"
                    />
                    <TipCard
                        icon="⏱️"
                        text={`Commencez à ${Math.round(analysis.tempo * 0.6)} BPM puis augmentez progressivement`}
                    />
                    <TipCard
                        icon="🔄"
                        text="Travaillez par groupes de 4 mesures pour respecter la structure musicale"
                    />
                </div>
            </div>
        </div>
    );
}

// Helper component for measure cards
function MeasureCard({ measure, isHighlighted, onToggleHighlight, onPlay, showDetails }) {
    return (
        <div
            onClick={() => onPlay(measure)}
            style={{
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: isHighlighted
                    ? '3px solid var(--accent-primary)'
                    : '2px solid var(--border-color)',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: isHighlighted ? 'var(--shadow-glow)' : 'none',
                minHeight: showDetails ? '160px' : '120px'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = isHighlighted ? 'var(--shadow-glow)' : 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isHighlighted ? 'var(--shadow-glow)' : 'none';
            }}
        >
            {/* Measure number badge - clickable to highlight */}
            <div
                onClick={(e) => {
                    e.stopPropagation(); // Prevent playing when clicking number
                    onToggleHighlight(measure.number);
                }}
                style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: isHighlighted ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                    color: 'white',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: '2px solid ' + (isHighlighted ? 'var(--accent-primary)' : 'var(--border-light)'),
                    transition: 'all var(--transition-fast)',
                    zIndex: 10
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                {measure.number}
            </div>

            {/* Chord info - show ALL chords in measure */}
            <div style={{ marginBottom: '0.75rem', paddingRight: '2rem' }}>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                }}>
                    Accords {measure.chordGroups.length > 1 && `(${measure.chordGroups.length})`}
                </div>

                {measure.hasChord ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {measure.chordGroups.map((chordGroup, idx) => {
                            const chordName = getFrenchNoteName(chordGroup.notes[0].pitch).split(/\d/)[0];

                            return (
                                <div key={idx}>
                                    <div style={{
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        color: 'var(--text-primary)'
                                    }}>
                                        {chordName}
                                    </div>

                                    {/* Show chord notes when details are enabled */}
                                    {showDetails && (
                                        <div style={{
                                            fontSize: '0.65rem',
                                            color: 'var(--text-secondary)',
                                            marginTop: '0.15rem',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '0.2rem'
                                        }}>
                                            {chordGroup.notes.map((n, i) => (
                                                <span key={i} style={{
                                                    background: 'var(--bg-primary)',
                                                    padding: '0.1rem 0.25rem',
                                                    borderRadius: '3px',
                                                    border: '1px solid var(--border-color)'
                                                }}>
                                                    {getFrenchNoteName(n.pitch)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        color: 'var(--text-tertiary)'
                    }}>
                        -
                    </div>
                )}
            </div>

            {/* Melody info */}
            <div>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                }}>
                    Mélodie ({measure.melodyCount} notes)
                </div>

                {showDetails ? (
                    // Show actual melody notes when details are enabled
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.25rem',
                        maxHeight: '60px',
                        overflowY: 'auto'
                    }}>
                        {measure.melody.length > 0 ? (
                            measure.melody.sort((a, b) => a.startTime - b.startTime).map((n, i) => (
                                <span key={i} style={{
                                    fontSize: '0.7rem',
                                    background: 'var(--bg-primary)',
                                    padding: '0.1rem 0.3rem',
                                    borderRadius: '3px',
                                    border: '1px solid var(--accent-secondary)',
                                    color: 'var(--text-primary)'
                                }}>
                                    {getFrenchNoteName(n.pitch)}
                                </span>
                            ))
                        ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                Aucune
                            </span>
                        )}
                    </div>
                ) : (
                    // Show density dots when details are hidden
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
                )}
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
    const keys = getPianoRollKeys(1, 5);

    // Helper to get applicable separator for a measure
    const getSeparatorForMeasure = (measureIndex) => {
        const handSeparators = phrase.handSeparators || [];
        if (handSeparators.length === 0) return null;

        const applicable = handSeparators
            .filter(s => s.fromMeasure <= measureIndex)
            .sort((a, b) => b.fromMeasure - a.fromMeasure);
        return applicable[0] || null;
    };

    // Helper to split notes by hand using separator
    const splitNotesByHand = (notes, separatorPitch) => {
        if (!separatorPitch) {
            // No separator: use default tracks
            return {
                rightHand: notes.filter(n => n.trackName === 'melody'),
                leftHand: notes.filter(n => n.trackName === 'chords')
            };
        }

        // Use separator: notes above separator = right hand, below = left hand
        const separatorIndex = keys.indexOf(separatorPitch);
        return {
            rightHand: notes.filter(n => keys.indexOf(n.pitch) < separatorIndex),
            leftHand: notes.filter(n => keys.indexOf(n.pitch) >= separatorIndex)
        };
    };

    // Combine all notes with track information
    const allNotes = [
        ...phrase.tracks.melody.map(n => ({ ...n, trackName: 'melody' })),
        ...phrase.tracks.chords.map(n => ({ ...n, trackName: 'chords' }))
    ];

    for (let i = 0; i < phrase.length; i++) {
        const measureStart = i * 4;
        const measureEnd = (i + 1) * 4;

        const measuresNotes = allNotes.filter(n =>
            n.startTime >= measureStart - EPSILON &&
            n.startTime < measureEnd - EPSILON
        );

        const separator = getSeparatorForMeasure(i);
        const { rightHand, leftHand } = splitNotesByHand(measuresNotes, separator?.pitch);

        measures.push({
            melody: rightHand,
            chords: leftHand
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
