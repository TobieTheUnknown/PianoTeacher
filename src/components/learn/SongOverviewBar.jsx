import React from 'react';

const SECTION_COLORS = [
    'rgba(99, 102, 241, 0.25)',   // indigo
    'rgba(139, 92, 246, 0.25)',   // purple
    'rgba(34, 211, 238, 0.2)',    // cyan
    'rgba(236, 72, 153, 0.2)',    // pink
    'rgba(16, 185, 129, 0.2)',    // emerald
    'rgba(245, 158, 11, 0.2)',    // amber
];

export const SongOverviewBar = React.memo(function SongOverviewBar({ phrases, totalMeasures, currentMeasure, highlightedMeasures }) {
    if (!phrases || phrases.length === 0 || totalMeasures === 0) return null;

    return (
        <div style={{
            width: '100%',
            background: 'var(--bg-secondary)',
            padding: '0.6rem 0.75rem',
            borderRadius: 'var(--radius-2xl)',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 0.15rem',
            }}>
                <span style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                }}>
                    Structure du morceau
                </span>
                <span style={{
                    fontSize: '0.6rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-indigo-light)',
                }}>
                    {totalMeasures} mesures
                </span>
            </div>

            <div style={{
                height: '22px',
                width: '100%',
                background: 'var(--bg-primary)',
                borderRadius: '6px',
                overflow: 'hidden',
                display: 'flex',
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.05)',
            }}>
                {phrases.map((phrase, i) => {
                    const width = (phrase.length / totalMeasures) * 100;
                    return (
                        <div
                            key={i}
                            style={{
                                width: `${width}%`,
                                background: SECTION_COLORS[i % SECTION_COLORS.length],
                                borderRight: i < phrases.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.5rem',
                                fontWeight: 700,
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                            }}
                            title={`${phrase.name} (${phrase.length} mesures)`}
                        >
                            {width > 8 ? phrase.name : ''}
                        </div>
                    );
                })}

                {/* Highlighted measure indicators */}
                {highlightedMeasures && highlightedMeasures.map(m => (
                    <div
                        key={`h-${m}`}
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${((m - 1) / totalMeasures) * 100}%`,
                            width: `${(1 / totalMeasures) * 100}%`,
                            background: 'rgba(255,255,255,0.15)',
                            pointerEvents: 'none',
                        }}
                    />
                ))}

                {/* Current measure cursor */}
                {currentMeasure > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: 'white',
                            boxShadow: '0 0 8px rgba(255,255,255,0.6)',
                            transition: 'left 0.3s ease',
                            left: `${((currentMeasure - 0.5) / totalMeasures) * 100}%`,
                        }}
                    />
                )}
            </div>
        </div>
    );
});
