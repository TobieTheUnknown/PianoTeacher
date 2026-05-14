import React from 'react';

/** Generic pill — used in song metadata, filter chips, etc. */
export function Pill({ children, color, dim, border, style, ...rest }) {
    return (
        <span
            {...rest}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: 'var(--r-pill)',
                background: dim || 'var(--surface-2)',
                color: color || 'var(--text-secondary)',
                border: border ? `1px solid ${border}` : '1px solid var(--border)',
                ...style,
            }}
        >
            {children}
        </span>
    );
}
