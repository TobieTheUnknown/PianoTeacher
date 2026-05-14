import React from 'react';

/**
 * Difficulty level pill — Débutant / Intermédiaire / Avancé.
 * Colour-coded.
 */
const LEVEL_MAP = {
    'Débutant':       { bg: 'rgba(16, 185, 129, 0.14)', fg: '#34d399', label: 'Débutant' },
    'Intermédiaire':  { bg: 'rgba(251, 191, 36, 0.14)', fg: '#fbbf24', label: 'Intermédiaire' },
    'Avancé':         { bg: 'rgba(239, 68, 68, 0.14)',  fg: '#fb7185', label: 'Avancé' },
};

export function LevelPill({ level }) {
    const m = LEVEL_MAP[level] || LEVEL_MAP['Débutant'];
    return (
        <span
            style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '3px 7px',
                borderRadius: 'var(--r-pill)',
                background: m.bg,
                color: m.fg,
            }}
        >
            {m.label}
        </span>
    );
}
