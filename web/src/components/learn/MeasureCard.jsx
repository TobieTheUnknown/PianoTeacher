import React from 'react';
import { STYLES } from './learnStyles';
import { ChordDisplay } from './ChordDisplay';
import { TimelineBar } from './TimelineBar';

export const MeasureCard = React.memo(function MeasureCard({
    measure, keySignature, isHighlighted, onToggleHighlight, onPlay,
    showDetails, displayNoteName, expandedChordReps, onToggleChordRep,
    isMelodyExpanded, onToggleMelodyExpand, isMobile
}) {
    const sortedMelody = measure.sortedMelody;

    const cardStyle = {
        ...STYLES.measureCardBase,
        borderColor: isHighlighted ? 'var(--color-indigo)' : 'rgba(255,255,255,0.05)',
        borderWidth: isHighlighted ? '2px' : '1px',
        boxShadow: isHighlighted ? '0 0 12px var(--color-indigo-dim), inset 0 0 0 1px var(--color-indigo-border)' : 'none',
        padding: isMobile ? '0.5rem' : '0.75rem',
    };

    const numberBadgeStyle = {
        ...STYLES.numberBadgeBase,
        background: isHighlighted
            ? 'var(--color-indigo)'
            : 'var(--bg-primary)',
        border: isHighlighted
            ? '2px solid var(--color-indigo-light)'
            : '1px solid rgba(255,255,255,0.1)',
        boxShadow: isHighlighted ? '0 0 8px var(--color-indigo-dim)' : 'none',
    };

    return (
        <div
            onClick={() => onPlay(measure, 'both')}
            style={cardStyle}
            onMouseEnter={(e) => {
                if (!isHighlighted) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                }
            }}
            onMouseLeave={(e) => {
                if (!isHighlighted) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                }
            }}
        >
            {/* Measure number badge */}
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleHighlight(measure.number);
                }}
                style={numberBadgeStyle}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
                title={isHighlighted ? "Cliquez pour d\u00E9surligner" : "Cliquez pour surligner"}
            >
                {measure.number}
            </div>

            {/* Play buttons */}
            <div style={{
                display: 'flex',
                gap: '0.2rem',
                marginBottom: '0.5rem',
                paddingRight: '2rem'
            }}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay(measure, 'left');
                    }}
                    style={{
                        ...STYLES.playButton,
                        border: '1px solid var(--color-pink-border)',
                        color: 'var(--color-pink-bright)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-pink-dim)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="Jouer main gauche"
                >
                    MG
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay(measure, 'right');
                    }}
                    style={{
                        ...STYLES.playButton,
                        border: '1px solid var(--color-cyan-border)',
                        color: 'var(--color-cyan)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-cyan-dim)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="Jouer main droite"
                >
                    MD
                </button>
            </div>

            {/* Chord info */}
            <ChordDisplay
                measure={measure}
                keySignature={keySignature}
                showDetails={showDetails}
                displayNoteName={displayNoteName}
                expandedChordReps={expandedChordReps}
                onToggleChordRep={onToggleChordRep}
                isMobile={isMobile}
            />

            {/* Melody info */}
            <div>
                <div style={STYLES.sectionLabel}>
                    Mélodie ({measure.melodyCount})
                </div>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.2rem',
                    alignItems: 'center'
                }}>
                    {sortedMelody.length > 0 ? (
                        <>
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleMelodyExpand(measure.number);
                                }}
                                style={STYLES.melodyBadgePrimary}
                                title="Cliquer pour voir les notes"
                            >
                                {displayNoteName(sortedMelody[0].pitch, keySignature)}
                            </span>

                            {(isMelodyExpanded || (!isMobile && showDetails)) ? (
                                sortedMelody.slice(1).map((n, i) => (
                                    <span key={i + 1} style={STYLES.melodyBadgeSecondary}>
                                        {displayNoteName(n.pitch, keySignature)}
                                    </span>
                                ))
                            ) : (
                                sortedMelody.length > 1 && (
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>
                                        +{sortedMelody.length - 1}
                                    </span>
                                )
                            )}
                        </>
                    ) : (
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Aucune
                        </span>
                    )}
                </div>
            </div>

            {/* Visual Timeline Bar */}
            <TimelineBar measure={measure} displayNoteName={displayNoteName} keySignature={keySignature} />
        </div>
    );
});
