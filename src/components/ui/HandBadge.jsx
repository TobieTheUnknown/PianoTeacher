import React from 'react';

/**
 * Hand badge — right (cyan) / left (pink) with hand icon + label.
 * Uses tokens so it reacts to data-hands preset changes.
 */

function HandRightIcon({ size = 12, strokeWidth = 1.6 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M7 11V5a1.5 1.5 0 0 1 3 0v6M10 11V4a1.5 1.5 0 0 1 3 0v7M13 11V5a1.5 1.5 0 0 1 3 0v6M16 11V7a1.5 1.5 0 0 1 3 0v9c0 3-2.5 5-6 5s-6-2-6-5l-4-7" />
        </svg>
    );
}

function HandLeftIcon({ size = 12, strokeWidth = 1.6 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M17 11V5a1.5 1.5 0 0 0-3 0v6M14 11V4a1.5 1.5 0 0 0-3 0v7M11 11V5a1.5 1.5 0 0 0-3 0v6M8 11V7a1.5 1.5 0 0 0-3 0v9c0 3 2.5 5 6 5s6-2 6-5l4-7" />
        </svg>
    );
}

export function HandBadge({ hand, label, size = 'sm' }) {
    const isRight = hand === 'right';
    const color = isRight ? 'var(--hand-right)' : 'var(--hand-left)';
    const dim = isRight ? 'var(--hand-right-dim)' : 'var(--hand-left-dim)';
    const border = isRight ? 'var(--hand-right-border)' : 'var(--hand-left-border)';
    const text = label ?? (isRight ? 'Main Droite' : 'Main Gauche');
    const padding = size === 'lg' ? '6px 12px' : '3px 8px';
    const fontSize = size === 'lg' ? 12 : 9;
    const iconSize = size === 'lg' ? 14 : 12;
    const Icon = isRight ? HandRightIcon : HandLeftIcon;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize,
                fontWeight: 700,
                padding,
                borderRadius: 'var(--r-pill)',
                background: dim,
                color,
                border: `1px solid ${border}`,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
            }}
        >
            <Icon size={iconSize} strokeWidth={2} />
            {text}
        </span>
    );
}

export { HandRightIcon, HandLeftIcon };
