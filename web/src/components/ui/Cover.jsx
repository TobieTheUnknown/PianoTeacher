import React from 'react';

/**
 * Procedural song cover — gradient + piano stripe overlay + initials.
 * Ported from the design package.
 */
const COVER_GRADIENTS = {
    'gradient-1': 'linear-gradient(135deg, #6366f1 0%, #312e81 100%)',
    'gradient-2': 'linear-gradient(135deg, #ec4899 0%, #831843 100%)',
    'gradient-3': 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
    'gradient-4': 'linear-gradient(135deg, #f59e0b 0%, #78350f 100%)',
    'gradient-5': 'linear-gradient(135deg, #22d3ee 0%, #155e75 100%)',
    'gradient-6': 'linear-gradient(135deg, #a855f7 0%, #581c87 100%)',
    'gradient-7': 'linear-gradient(135deg, #f43f5e 0%, #881337 100%)',
    'gradient-8': 'linear-gradient(135deg, #14b8a6 0%, #134e4a 100%)',
};

/** Stable gradient picker — same id always → same gradient. */
export function gradientForId(id) {
    if (!id) return COVER_GRADIENTS['gradient-1'];
    if (COVER_GRADIENTS[id]) return COVER_GRADIENTS[id];
    // Hash any string id to one of 8 gradients
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const keys = Object.keys(COVER_GRADIENTS);
    return COVER_GRADIENTS[keys[Math.abs(h) % keys.length]];
}

export function Cover({ id, size = 56, title = '' }) {
    const grad = gradientForId(id);
    const initials = title
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || '')
        .join('')
        .toUpperCase() || '♪';

    return (
        <div
            style={{
                width: size,
                height: size,
                background: grad,
                borderRadius: 'var(--r-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: 800,
                fontSize: size * 0.32,
                letterSpacing: '-0.02em',
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                        'repeating-linear-gradient(90deg, transparent 0 6px, rgba(255,255,255,0.08) 6px 7px)',
                }}
            />
            <span style={{ position: 'relative' }}>{initials}</span>
        </div>
    );
}
