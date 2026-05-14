import React from 'react';

/**
 * Hand-coloured note guide for one hand (right = melody, left = chords).
 *
 * Refined per design feedback: thin 3px vertical bar at the left edge
 * replaces the full-width tinted header, compact uppercase label, and
 * outline-only note pills (the first one keeps the solid-colour fill).
 */
export const HandGuideCard = React.memo(function HandGuideCard({
    hand, // 'right' | 'left'
    notes, // sorted note array
    chordName, // detected chord name (for left hand)
    displayNoteName,
    keySignature,
    noteCount,
}) {
    const isRight = hand === 'right';
    const color = isRight ? 'var(--hand-right)' : 'var(--hand-left)';
    const colorDim = isRight ? 'var(--hand-right-dim)' : 'var(--hand-left-dim)';
    const colorBorder = isRight ? 'var(--hand-right-border)' : 'var(--hand-left-border)';
    const label = isRight ? 'Main Droite' : 'Main Gauche';
    const sublabel = isRight ? 'Mélodie' : 'Accords';

    const displayNotes = notes.slice(0, 6);
    const hasMore = notes.length > 6;

    return (
        <div style={{
            background: 'var(--surface-1)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            position: 'relative',
            paddingLeft: 11, // 3px bar + 8px content gap
        }}>
            {/* 3px vertical hand-colour signal */}
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

            {/* Compact header — label CAPS + subtle sublabel + note count */}
            <div style={{
                padding: '6px 10px 4px 0',
                display: 'flex',
                alignItems: 'center',
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
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>{sublabel}</span>
                </div>
                <span style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                }}>
                    {noteCount} notes
                </span>
            </div>

            {/* Note pills */}
            <div style={{
                padding: '2px 10px 8px 0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
                alignItems: 'center',
                minHeight: '2rem',
            }}>
                {chordName && (
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill)',
                        background: color,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                    }}>
                        {chordName}
                    </span>
                )}
                {displayNotes.length > 0 ? (
                    displayNotes.map((n, i) => {
                        const name = displayNoteName(n.pitch, keySignature);
                        const isFirst = i === 0 && !chordName;
                        return (
                            <span key={n.id || i} style={{
                                padding: '2px 7px',
                                borderRadius: 'var(--r-pill)',
                                background: isFirst ? color : 'transparent',
                                border: isFirst ? `1px solid ${color}` : `1px solid ${colorBorder}`,
                                color: isFirst ? '#fff' : color,
                                fontSize: 11,
                                fontWeight: isFirst ? 700 : 500,
                            }}>
                                {name}
                            </span>
                        );
                    })
                ) : (
                    <span style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                    }}>
                        Aucune
                    </span>
                )}
                {hasMore && (
                    <span style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                    }}>
                        +{notes.length - 6}
                    </span>
                )}
            </div>
        </div>
    );
});
