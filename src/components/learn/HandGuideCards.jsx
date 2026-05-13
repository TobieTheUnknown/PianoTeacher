import React from 'react';

/**
 * Per-measure side-by-side hand guides: right (cyan, melody) / left (pink,
 * chords). Refined per design feedback — 3px vertical token-coloured bar
 * instead of an emoji-prefixed header, outline-only secondary pills.
 */
export const HandGuideCards = React.memo(function HandGuideCards({
    measure, displayNoteName, keySignature, isMobile
}) {
    if (!measure) return null;

    const melodyNotes = measure.sortedMelody || [];
    const chordName = measure.detectedChord?.displayName;
    const chordNotes = measure.chords || [];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '0.6rem',
        }}>
            <HandPanel
                hand="right"
                label="Main Droite"
                sublabel="Mélodie"
                noteCount={melodyNotes.length}
                items={melodyNotes.slice(0, 8).map((n, i) => ({
                    key: n.id || i,
                    text: displayNoteName(n.pitch, keySignature),
                    primary: i === 0,
                }))}
                overflow={melodyNotes.length > 8 ? melodyNotes.length - 8 : 0}
            />
            <HandPanel
                hand="left"
                label="Main Gauche"
                sublabel="Accords"
                noteCount={measure.chordGroups?.length || 0}
                items={[
                    ...(chordName ? [{ key: 'chord', text: chordName, primary: true, isChord: true }] : []),
                    ...[...new Set(chordNotes.map(n => n.pitch))].slice(0, 6).map((pitch, i) => ({
                        key: pitch,
                        text: displayNoteName(pitch, keySignature),
                        primary: !chordName && i === 0,
                    })),
                ]}
                overflow={0}
            />
        </div>
    );
});

function HandPanel({ hand, label, sublabel, noteCount, items, overflow }) {
    const isRight = hand === 'right';
    const color = isRight ? 'var(--hand-right)' : 'var(--hand-left)';
    const colorBorder = isRight ? 'var(--hand-right-border)' : 'var(--hand-left-border)';

    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            position: 'relative',
            paddingLeft: 11,
            overflow: 'hidden',
        }}>
            <span
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: color,
                }}
            />
            <div style={{
                padding: '6px 10px 4px 0',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                    <span style={{
                        color,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.09em',
                        whiteSpace: 'nowrap',
                    }}>{label}</span>
                    <span style={{
                        color: 'var(--text-tertiary)',
                        fontSize: 10,
                        fontWeight: 500,
                    }}>{sublabel}</span>
                </div>
                <span style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                }}>{noteCount} notes</span>
            </div>
            <div style={{
                padding: '0 10px 8px 0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
                alignItems: 'center',
                minHeight: '1.75rem',
            }}>
                {items.length === 0 ? (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Aucune
                    </span>
                ) : items.map((it) => (
                    <span key={it.key} style={{
                        padding: '2px 7px',
                        borderRadius: 'var(--r-pill)',
                        background: it.primary ? color : 'transparent',
                        border: it.primary ? `1px solid ${color}` : `1px solid ${colorBorder}`,
                        color: it.primary ? '#fff' : color,
                        fontSize: 11,
                        fontWeight: it.primary ? 700 : 500,
                    }}>
                        {it.text}
                    </span>
                ))}
                {overflow > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{overflow}</span>
                )}
            </div>
        </div>
    );
}
