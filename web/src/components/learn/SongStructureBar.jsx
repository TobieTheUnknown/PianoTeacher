import React from 'react';

const SEGMENT_COLORS = [
    'rgba(255,255,255,0.06)',
    'rgba(255,255,255,0.03)',
    'rgba(255,255,255,0.08)',
    'rgba(255,255,255,0.04)',
    'rgba(255,255,255,0.07)',
    'rgba(255,255,255,0.05)',
];

export const SongStructureBar = React.memo(function SongStructureBar({
    phrases, totalMeasures, currentMeasure, highlightedMeasures, onPhraseClick
}) {
    if (!phrases || phrases.length === 0 || totalMeasures === 0) return null;

    return (
        <div className="card" style={{ padding: '0.75rem' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
            }}>
                <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 400,
                }}>
                    🎼 Structure du morceau
                </span>
                <span style={{
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                }}>
                    Mesure {currentMeasure} / {totalMeasures}
                </span>
            </div>

            <div style={{
                height: '24px',
                width: '100%',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                display: 'flex',
                position: 'relative',
                border: '1px solid var(--border-color)',
            }}>
                {phrases.map((phrase, i) => {
                    const width = (phrase.length / totalMeasures) * 100;
                    return (
                        <div
                            key={i}
                            onClick={() => onPhraseClick && onPhraseClick(i)}
                            style={{
                                width: `${width}%`,
                                background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                                borderRight: i < phrases.length - 1 ? '1px solid var(--border-color)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6rem',
                                fontWeight: 400,
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                cursor: onPhraseClick ? 'pointer' : 'default',
                                transition: 'background var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = SEGMENT_COLORS[i % SEGMENT_COLORS.length]; }}
                            title={`${phrase.name} (${phrase.length} mesures)`}
                        >
                            {width > 10 ? phrase.name : ''}
                        </div>
                    );
                })}

                {/* Highlighted measure markers */}
                {highlightedMeasures && highlightedMeasures.map(m => (
                    <div
                        key={`h-${m}`}
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${((m - 1) / totalMeasures) * 100}%`,
                            width: `${(1 / totalMeasures) * 100}%`,
                            background: 'rgba(245, 245, 245, 0.1)',
                            pointerEvents: 'none',
                        }}
                    />
                ))}

                {/* Current measure cursor */}
                {currentMeasure > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        background: 'var(--accent-primary)',
                        boxShadow: '0 0 6px rgba(245, 245, 245, 0.4)',
                        transition: 'left 0.2s ease',
                        left: `${((currentMeasure - 0.5) / totalMeasures) * 100}%`,
                    }} />
                )}
            </div>
        </div>
    );
});
