import React from 'react';

/**
 * Circular progress ring — SVG, animated stroke-dasharray.
 * value: 0..1.
 */
export function ProgressRing({
    value = 0,
    size = 32,
    stroke = 3,
    color = 'var(--accent)',
    track = 'var(--surface-3)',
}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(1, value));
    const dash = c * clamped;

    return (
        <svg width={size} height={size} style={{ display: 'block' }} aria-hidden="true">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={track}
                strokeWidth={stroke}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${c}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dasharray 400ms ease-out' }}
            />
        </svg>
    );
}
