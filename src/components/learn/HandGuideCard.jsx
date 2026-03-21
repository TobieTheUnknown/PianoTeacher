import React from 'react';

export const HandGuideCard = React.memo(function HandGuideCard({
    hand, // 'right' | 'left'
    notes, // sorted note array
    chordName, // detected chord name (for left hand)
    displayNoteName,
    keySignature,
    noteCount,
}) {
    const isRight = hand === 'right';
    const color = isRight ? 'var(--color-cyan)' : 'var(--color-pink)';
    const colorBright = isRight ? 'var(--color-cyan)' : 'var(--color-pink-bright)';
    const colorDim = isRight ? 'var(--color-cyan-dim)' : 'var(--color-pink-dim)';
    const colorBorder = isRight ? 'var(--color-cyan-border)' : 'var(--color-pink-border)';
    const label = isRight ? 'Main Droite' : 'Main Gauche';
    const sublabel = isRight ? 'Mélodie' : 'Accords';

    const displayNotes = notes.slice(0, 6);
    const hasMore = notes.length > 6;

    return (
        <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-2xl)',
            border: `1px solid ${colorBorder}`,
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                background: colorDim,
                padding: '0.4rem 0.75rem',
                borderBottom: `1px solid ${colorBorder}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span style={{
                    color: colorBright,
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                }}>
                    {label} ({sublabel})
                </span>
                <span style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                }}>
                    {noteCount} notes
                </span>
            </div>

            {/* Note pills */}
            <div style={{
                padding: '0.6rem 0.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.35rem',
                alignItems: 'center',
                minHeight: '2.5rem',
            }}>
                {chordName && (
                    <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: color,
                        color: 'white',
                        fontSize: '0.7rem',
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
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                background: isFirst ? color : 'var(--bg-primary)',
                                border: isFirst ? '2px solid white' : `1px solid ${colorBorder}`,
                                color: isFirst ? 'white' : colorBright,
                                fontSize: '0.7rem',
                                fontWeight: isFirst ? 700 : 500,
                            }}>
                                {name}
                            </span>
                        );
                    })
                ) : (
                    <span style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                    }}>
                        Aucune
                    </span>
                )}
                {hasMore && (
                    <span style={{
                        fontSize: '0.6rem',
                        color: 'var(--text-tertiary)',
                    }}>
                        +{notes.length - 6}
                    </span>
                )}
            </div>
        </div>
    );
});
