import React from 'react';

/**
 * Mono-font numeric stat with optional unit + label. Used in the song
 * detail sheet (Durée, Tempo, Mesure, Tonalité) and various dashboards.
 */
export function MonoStat({ value, unit, label, color }) {
    return (
        <div style={{ textAlign: 'left' }}>
            <div
                style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    fontSize: 18,
                    color: color || 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 3,
                }}
            >
                {value}
                {unit && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{unit}</span>
                )}
            </div>
            {label && (
                <div
                    style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginTop: 2,
                    }}
                >
                    {label}
                </div>
            )}
        </div>
    );
}
