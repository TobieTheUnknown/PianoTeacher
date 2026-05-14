import React from 'react';

/**
 * MobileHeader — shared compact header bar used at the top of every
 * mobile screen. Mirrors the design prototype's window.MobileHeader.
 *
 * - title: large bold display (26px) — typically a page or song name
 * - subtitle: small tertiary text below (13px) — metadata, counts, etc.
 * - right: optional element(s) anchored to the right (icon buttons,
 *   toggles…); aligned with the baseline of the title.
 */
export function MobileHeader({ title, subtitle, right }) {
    return (
        <header
            style={{
                padding: '12px 20px 8px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0,
            }}
        >
            <div style={{ minWidth: 0, flex: 1 }}>
                <h1
                    style={{
                        fontSize: 26,
                        fontWeight: 700,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p
                        style={{
                            margin: '3px 0 0',
                            fontSize: 13,
                            color: 'var(--text-tertiary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
            {right && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {right}
                </div>
            )}
        </header>
    );
}

export default MobileHeader;
