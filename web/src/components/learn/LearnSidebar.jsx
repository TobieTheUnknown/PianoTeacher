import React from 'react';
import { getFrenchNoteName } from '../../models/song';

/**
 * LearnSidebar — desktop right rail for LiveLearning.
 *
 * Mirrors the design's LearnDS sidebar:
 *   • Eyebrow "Mesure X · notes à jouer"
 *   • HandGuide right (cyan)
 *   • HandGuide left  (pink) with optional chord chip
 *   • Mini keyboard preview showing active notes for the measure
 *
 * 340px wide, full-height column, color-mix surface-1 background.
 */
export function LearnSidebar({ measure, keySignature, displayNoteName }) {
    if (!measure) {
        return (
            <aside style={sidebarStyle}>
                <div style={eyebrow}>Sélectionne une mesure</div>
                <p style={{
                    margin: 0, fontSize: 13, color: 'var(--text-tertiary)',
                    lineHeight: 1.5,
                }}>
                    Clique sur une carte mesure dans la grille pour voir les notes à jouer ici.
                </p>
            </aside>
        );
    }

    const rightNotes = uniquePitchLabels(measure.melody, displayNoteName, keySignature);
    const leftNotes = uniquePitchLabels(measure.chords, displayNoteName, keySignature);
    const chordChip = measure.detectedChord?.displayName || null;

    // Set of active midi numbers for the mini keyboard.
    const activeRight = new Set((measure.melody || []).map((n) => n.pitch));
    const activeLeft = new Set((measure.chords || []).map((n) => n.pitch));

    return (
        <aside style={sidebarStyle}>
            <div style={eyebrow}>Mesure {measure.number} · notes à jouer</div>

            <HandGuide hand="right" notes={rightNotes} count={rightNotes.length} />
            <div style={{ height: 10 }} />
            <HandGuide hand="left" notes={leftNotes} count={leftNotes.length} chord={chordChip} />

            <div style={{
                marginTop: 18,
                padding: 12,
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
            }}>
                <div style={eyebrow}>Clavier</div>
                <MiniKeyboard startMidi={48} octaves={3} activeRight={activeRight} activeLeft={activeLeft} />
            </div>
        </aside>
    );
}

const sidebarStyle = {
    width: 340,
    flexShrink: 0,
    borderLeft: '1px solid var(--border)',
    background: 'color-mix(in oklab, var(--surface-1), transparent 30%)',
    overflowY: 'auto',
    padding: '20px 18px',
};

const eyebrow = {
    fontSize: 10,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
    marginBottom: 10,
};

function uniquePitchLabels(notes, displayNoteName, keySignature) {
    if (!notes || notes.length === 0) return [];
    const seen = new Set();
    const out = [];
    for (const n of [...notes].sort((a, b) => (a.startTime || 0) - (b.startTime || 0))) {
        if (seen.has(n.pitch)) continue;
        seen.add(n.pitch);
        const label = displayNoteName
            ? displayNoteName(n.pitch, keySignature)
            : getFrenchNoteName(n.pitch).replace(/[0-9-]/g, '');
        out.push(label);
        if (out.length >= 8) break;
    }
    return out;
}

function HandGuide({ hand, notes, count, chord }) {
    const isRight = hand === 'right';
    const color = isRight ? 'var(--hand-right)' : 'var(--hand-left)';
    const dim = isRight ? 'var(--hand-right-dim)' : 'var(--hand-left-dim)';
    const border = isRight ? 'var(--hand-right-border)' : 'var(--hand-left-border)';
    return (
        <div style={{
            background: 'var(--surface-1)',
            border: `1px solid ${border}`,
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
        }}>
            <div style={{
                background: dim,
                padding: '6px 12px',
                borderBottom: `1px solid ${border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: 27,
            }}>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color,
                }}>
                    <HandIcon hand={hand} />
                    {isRight ? 'Main droite' : 'Main gauche'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {count} note{count > 1 ? 's' : ''}
                </span>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                {chord && (
                    <span style={{
                        padding: '3px 10px',
                        borderRadius: 'var(--r-pill)',
                        background: color,
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                    }}>{chord}</span>
                )}
                {notes.length === 0 ? (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>
                ) : (
                    notes.map((n, i) => {
                        const isFirst = i === 0 && !chord;
                        return (
                            <span key={`${n}-${i}`} style={{
                                padding: '3px 9px',
                                borderRadius: 'var(--r-pill)',
                                background: isFirst ? color : 'var(--surface-2)',
                                color: isFirst ? '#fff' : color,
                                border: isFirst ? '2px solid #fff' : `1px solid ${border}`,
                                fontSize: 11,
                                fontWeight: isFirst ? 700 : 500,
                            }}>{n}</span>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function HandIcon({ hand }) {
    return (
        <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={hand === 'left' ? { transform: 'scaleX(-1)' } : undefined}
            aria-hidden
        >
            <path d="M9 11v-7a2 2 0 1 1 4 0v7" />
            <path d="M13 11v-2a2 2 0 1 1 4 0v6" />
            <path d="M17 14v-1a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 18V5a2 2 0 1 1 4 0v6" />
        </svg>
    );
}

function MiniKeyboard({ startMidi, octaves, activeRight, activeLeft }) {
    // Wider keys + scrollable so users can pan to see active notes
    // outside the default 3-octave window. Auto-scroll to first active
    // note when the measure changes.
    const whiteWidth = 22;
    const totalWhites = octaves * 7;
    const totalWidth = totalWhites * whiteWidth;
    const height = 86;
    const blackHeight = height * 0.62;
    const blackWidthRatio = 0.6;
    const scrollRef = React.useRef(null);

    const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);

    // Build white-key index map
    const whiteIndex = {};
    let wi = 0;
    for (let i = 0; i < octaves * 12; i++) {
        const m = startMidi + i;
        if (!isBlack(m)) whiteIndex[m] = wi++;
    }

    const colorFor = (m) => {
        if (activeRight?.has(m)) return 'var(--hand-right)';
        if (activeLeft?.has(m)) return 'var(--hand-left)';
        return null;
    };

    // Auto-scroll to centre the first active note when set changes.
    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const firstActive =
            (activeRight && activeRight.size ? Math.min(...activeRight) : null) ??
            (activeLeft && activeLeft.size ? Math.min(...activeLeft) : null);
        if (firstActive == null) return;
        // Approx X of the key (white index * whiteWidth, or based on prev white for black).
        const localIdx = firstActive - startMidi;
        let px;
        if (!isBlack(firstActive)) {
            px = (whiteIndex[firstActive] ?? 0) * whiteWidth;
        } else {
            const prev = whiteIndex[firstActive - 1] ?? whiteIndex[firstActive + 1] ?? 0;
            px = prev * whiteWidth + whiteWidth - (whiteWidth * blackWidthRatio) / 2;
        }
        const scaled = (px / totalWidth) * (el.scrollWidth);
        const targetScroll = scaled - el.clientWidth / 2 + whiteWidth / 2;
        el.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    }, [activeRight, activeLeft, startMidi, totalWidth, blackWidthRatio]);

    return (
        <div
            ref={scrollRef}
            style={{
                position: 'relative',
                width: '100%',
                height,
                marginTop: 8,
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
            }}
        >
            <svg
                viewBox={`0 0 ${totalWidth} ${height}`}
                width={totalWidth}
                height={height}
                preserveAspectRatio="xMinYMin meet"
                style={{ display: 'block' }}
            >
                {/* White keys */}
                {Array.from({ length: octaves * 12 }, (_, i) => startMidi + i)
                    .filter((m) => !isBlack(m))
                    .map((m) => {
                        const x = whiteIndex[m] * whiteWidth;
                        const fill = colorFor(m) || 'var(--key-white, #f2f4f8)';
                        return (
                            <rect
                                key={`w${m}`}
                                x={x}
                                y={0}
                                width={whiteWidth - 0.5}
                                height={height}
                                fill={fill}
                                stroke="var(--key-white-shadow, #cbd0d8)"
                                strokeWidth={0.5}
                            />
                        );
                    })}
                {/* Black keys */}
                {Array.from({ length: octaves * 12 }, (_, i) => startMidi + i)
                    .filter((m) => isBlack(m))
                    .map((m) => {
                        const prevWhite = m - 1;
                        const x = whiteIndex[prevWhite] * whiteWidth + whiteWidth - (whiteWidth * blackWidthRatio) / 2;
                        const w = whiteWidth * blackWidthRatio;
                        const fill = colorFor(m) || 'var(--key-black, #1a1d24)';
                        return (
                            <rect key={`b${m}`} x={x} y={0} width={w} height={blackHeight} fill={fill} />
                        );
                    })}
            </svg>
        </div>
    );
}

export default LearnSidebar;
