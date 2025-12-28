import React, { useMemo, useState } from 'react';
import { getFrenchNoteName, getFrenchKeyName, getPianoRollKeys, NOTE_NAMES, getEnharmonicNote, getNoteNameFromMidi } from '../models/song';
import { audioEngine } from '../services/AudioEngine';

export function LiveLearning({ song, onToggleHighlight }) {
    const [showDetails, setShowDetails] = useState(false);
    const [showOctaves, setShowOctaves] = useState(false);

    // Analyze and structure the song data
    const analysis = useMemo(() => {
        if (!song || !song.phrases || song.phrases.length === 0) {
            return null;
        }

        const measures = [];
        const allNotes = new Set();
        const phraseBreaks = []; // Track where each phrase starts

        // Helper to get raw note name (e.g. "C" from 60/"C4")
        const getRawNoteName = (pitch) => {
            const name = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;
            return name ? name.slice(0, -1) : '';
        };

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
                measure.melody.forEach(n => allNotes.add(getRawNoteName(n.pitch)));
                measure.chords.forEach(n => allNotes.add(getRawNoteName(n.pitch)));

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

    const handlePlayMeasure = async (measure, hand = 'both') => {
        await audioEngine.initialize();

        let notesToPlay = [];
        if (hand === 'both') {
            notesToPlay = [...measure.melody, ...measure.chords];
        } else if (hand === 'right') {
            notesToPlay = measure.melody;
        } else if (hand === 'left') {
            notesToPlay = measure.chords;
        }

        if (notesToPlay.length > 0) {
            audioEngine.playNotes(notesToPlay, song.tempo);
        }
    };

    // Helper to display note name with optional octave
    const displayNoteName = (pitch, keySignature) => {
        const fullName = getFrenchNoteName(pitch, keySignature);
        if (showOctaves) return fullName;
        // Remove the octave number (last character)
        return fullName.slice(0, -1);
    };

    if (!analysis) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                Aucun morceau chargé. Importez un fichier MIDI pour commencer.
            </div>
        );
    }

    // Group measures by phrase, then by 4 within each phrase
    const phrasesWithGroups = useMemo(() => {
        const result = [];
        let currentPhraseIndex = 0;

        song.phrases.forEach((phrase, phraseIdx) => {
            const phraseMeasures = getMeasuresFromPhrase(phrase);

            // Build measure objects for this phrase
            const measures = phraseMeasures.map((measure, idx) => {
                const chordGroups = groupNotesByTime(measure.chords);
                return {
                    number: currentPhraseIndex + idx + 1,
                    chordGroups,
                    melodyCount: measure.melody.length,
                    hasChord: chordGroups.length > 0,
                    melody: measure.melody,
                    chords: measure.chords
                };
            });

            // Group measures by 4
            const groups = [];
            for (let i = 0; i < measures.length; i += 4) {
                groups.push(measures.slice(i, i + 4));
            }

            result.push({
                phraseName: phrase.name,
                phraseIndex: phraseIdx,
                groups
            });

            currentPhraseIndex += phraseMeasures.length;
        });

        return result;
    }, [song]);

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
                    📚 Apprentissage
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
                    <span>🎼 <strong>{getFrenchKeyName(analysis.key)}</strong></span>
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
                        {analysis.uniqueNotes.map(note => {
                            const correctNote = getEnharmonicNote(note, analysis.key);
                            const frenchNote = NOTE_NAMES[correctNote] || correctNote;
                            return (
                                <span key={note} style={{
                                    padding: '0.4rem 0.8rem',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {frenchNote}
                                </span>
                            );
                        })}
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
                        <div>🎵 <strong>Cliquez sur une mesure</strong> pour jouer les deux mains</div>
                        <div>🎹 <strong>Boutons MG/MD</strong> pour jouer chaque main séparément</div>
                        <div>🔢 <strong>Cliquez sur le numéro</strong> pour surligner une mesure</div>
                        <div>👁️ <strong>Activez les détails</strong> pour voir toutes les notes</div>
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                            <strong>Timeline :</strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', marginLeft: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: '#f472b6',
                                        border: '2px solid var(--bg-elevated)'
                                    }}></div>
                                    <span>Main droite (MD)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: '#60a5fa',
                                        border: '2px solid var(--bg-elevated)'
                                    }}></div>
                                    <span>Main gauche (MG)</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: '#10b981',
                                        border: '2px solid var(--bg-elevated)'
                                    }}></div>
                                    <span>2 mains ensemble</span>
                                </div>
                            </div>
                        </div>
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

                    {/* Toggle Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => setShowOctaves(!showOctaves)}
                            style={{
                                background: showOctaves ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                                color: showOctaves ? 'white' : 'var(--text-primary)',
                                border: showOctaves ? 'none' : '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: showOctaves ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                                padding: '0.75rem 1.5rem',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                transition: 'all var(--transition-fast)'
                            }}
                            title={showOctaves ? 'Masquer les octaves' : 'Afficher les octaves'}
                        >
                            <span>🎹</span>
                            <span>{showOctaves ? 'Octaves' : 'Octaves'}</span>
                        </button>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            style={{
                                background: showDetails ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                                color: showDetails ? 'white' : 'var(--text-primary)',
                                border: showDetails ? 'none' : '1px solid var(--border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: showDetails ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                                padding: '0.75rem 1.5rem',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                transition: 'all var(--transition-fast)'
                            }}
                        >
                            <span>{showDetails ? '👁️' : '👁️‍🗨️'}</span>
                            <span>{showDetails ? 'Masquer les détails' : 'Afficher les détails'}</span>
                        </button>
                    </div>
                </div>

                {/* Measures grouped by phrase, then by 4 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                    {phrasesWithGroups.map((phrase) => (
                        <div key={phrase.phraseIndex}>
                            {/* Phrase Header */}
                            {phrase.phraseIndex > 0 && (
                                <div style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                                    borderLeft: '4px solid var(--accent-primary)',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: 'var(--text-primary)',
                                    marginBottom: '1.5rem'
                                }}>
                                    🎵 {phrase.phraseName}
                                </div>
                            )}

                            {/* Groups of 4 measures */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {phrase.groups.map((group, groupIdx) => (
                                    <div key={groupIdx}>
                                        {/* Group label with measure range */}
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
                                            {group.map((measure) => (
                                                <MeasureCard
                                                    key={measure.number}
                                                    measure={measure}
                                                    keySignature={song.key}
                                                    isHighlighted={highlightedMeasures.includes(measure.number)}
                                                    onToggleHighlight={onToggleHighlight}
                                                    onPlay={handlePlayMeasure}
                                                    showDetails={showDetails}
                                                    displayNoteName={displayNoteName}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
function MeasureCard({ measure, keySignature, isHighlighted, onToggleHighlight, onPlay, showDetails, displayNoteName }) {
    return (
        <div
            onClick={() => onPlay(measure, 'both')}
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
                minHeight: showDetails ? '200px' : '140px'
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
            {/* Measure number badge with highlight toggle */}
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleHighlight(measure.number);
                }}
                style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: isHighlighted
                        ? 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'
                        : 'var(--bg-elevated)',
                    color: 'white',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: isHighlighted
                        ? '2px solid var(--accent-primary)'
                        : '2px solid var(--border-light)',
                    transition: 'all var(--transition-fast)',
                    zIndex: 10,
                    boxShadow: isHighlighted ? 'var(--shadow-glow)' : 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    if (!isHighlighted) {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    if (!isHighlighted) {
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                    }
                }}
                title={isHighlighted ? "Cliquez pour désurligner" : "Cliquez pour surligner"}
            >
                {measure.number}
            </div>

            {/* Play buttons */}
            <div style={{
                display: 'flex',
                gap: '0.25rem',
                marginBottom: '0.75rem',
                paddingRight: '3rem' // Space for measure number badge
            }}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay(measure, 'left');
                    }}
                    style={{
                        flex: 1,
                        padding: '0.3rem',
                        fontSize: '0.7rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--accent-secondary)',
                        color: 'var(--accent-secondary)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--accent-secondary)';
                    }}
                    title="Jouer main gauche"
                >
                    ▶ MG
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay(measure, 'right');
                    }}
                    style={{
                        flex: 1,
                        padding: '0.3rem',
                        fontSize: '0.7rem',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--accent-primary)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--accent-primary)';
                    }}
                    title="Jouer main droite"
                >
                    ▶ MD
                </button>
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
                            const chordName = displayNoteName(chordGroup.notes[0].pitch, keySignature);

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
                                                    {displayNoteName(n.pitch, keySignature)}
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

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.25rem',
                    alignItems: 'center'
                }}>
                    {measure.melody.length > 0 ? (
                        <>
                            {/* First note with emphasis */}
                            {measure.melody.sort((a, b) => a.startTime - b.startTime).slice(0, 1).map((n, i) => (
                                <span key={i} style={{
                                    fontSize: '0.75rem',
                                    background: 'var(--bg-primary)',
                                    padding: '0.2rem 0.4rem',
                                    borderRadius: '4px',
                                    border: '2px solid var(--accent-primary)',
                                    color: 'var(--text-primary)',
                                    fontWeight: 'bold'
                                }}>
                                    {displayNoteName(n.pitch, keySignature)}
                                </span>
                            ))}

                            {showDetails ? (
                                // Show all remaining notes when details are enabled
                                measure.melody.sort((a, b) => a.startTime - b.startTime).slice(1).map((n, i) => (
                                    <span key={i + 1} style={{
                                        fontSize: '0.7rem',
                                        background: 'var(--bg-primary)',
                                        padding: '0.1rem 0.3rem',
                                        borderRadius: '3px',
                                        border: '1px solid var(--accent-primary)',
                                        color: 'var(--text-primary)'
                                    }}>
                                        {displayNoteName(n.pitch, keySignature)}
                                    </span>
                                ))
                            ) : (
                                // Show count when details are hidden
                                measure.melody.length > 1 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                        +{measure.melody.length - 1}
                                    </span>
                                )
                            )}
                        </>
                    ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                            Aucune
                        </span>
                    )}
                </div>
            </div>

            {/* Visual Timeline Bar */}
            <div style={{
                marginTop: '1rem',
                height: '4px',
                backgroundColor: 'var(--bg-primary)',
                position: 'relative',
                borderRadius: '2px'
            }}>
                {(() => {
                    // Helper function to check if two notes are simultaneous (within 0.15 beats)
                    const areSimultaneous = (time1, time2) => Math.abs(time1 - time2) < 0.15;

                    // Find simultaneous notes (both hands playing together)
                    const simultaneousTimes = new Set();
                    measure.melody.forEach(melodyNote => {
                        measure.chords.forEach(chordNote => {
                            if (areSimultaneous(melodyNote.startTime, chordNote.startTime)) {
                                simultaneousTimes.add(melodyNote.startTime);
                            }
                        });
                    });

                    // Filter out melody notes that are simultaneous
                    const soloMelodyNotes = measure.melody.filter(n =>
                        !Array.from(simultaneousTimes).some(t => areSimultaneous(n.startTime, t))
                    );

                    // Filter out chord notes that are simultaneous
                    const soloChordNotes = measure.chords.filter(n =>
                        !Array.from(simultaneousTimes).some(t => areSimultaneous(n.startTime, t))
                    );

                    return (
                        <>
                            {/* Solo Melody Dots (Right Hand - Top) */}
                            {soloMelodyNotes.map(n => (
                                <div key={`melody-${n.id}`} style={{
                                    position: 'absolute',
                                    left: `${((n.startTime % 4) / 4) * 100}%`,
                                    top: '-3px',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: '#f472b6',
                                    border: '2px solid var(--bg-tertiary)'
                                }} title={`Main droite: ${displayNoteName(n.pitch, keySignature)}`} />
                            ))}

                            {/* Solo Chord Dots (Left Hand - Bottom) */}
                            {soloChordNotes.map(n => (
                                <div key={`chord-${n.id}`} style={{
                                    position: 'absolute',
                                    left: `${((n.startTime % 4) / 4) * 100}%`,
                                    bottom: '-3px',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: '#60a5fa',
                                    border: '2px solid var(--bg-tertiary)'
                                }} title={`Main gauche: ${displayNoteName(n.pitch, keySignature)}`} />
                            ))}

                            {/* Both Hands Together (Center - Green) */}
                            {Array.from(simultaneousTimes).map((time, idx) => (
                                <div key={`both-${idx}`} style={{
                                    position: 'absolute',
                                    left: `${((time % 4) / 4) * 100}%`,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: '#10b981',
                                    border: '2px solid var(--bg-tertiary)'
                                }} title="2 mains ensemble" />
                            ))}
                        </>
                    );
                })()}
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
