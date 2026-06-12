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
export function LearnSidebar({ measure, allMeasures, keySignature, displayNoteName }) {
    // Stable keyboard window: computed once from the whole song so the
    // keyboard never re-scales between measures; it only shifts in whole-
    // octave steps when a measure's notes fall outside the current window.
    const keyboardInfo = React.useMemo(() => {
        const ranges = (allMeasures || []).map((m) => {
            const all = [...(m.melody || []), ...(m.chords || [])];
            if (all.length === 0) return null;
            let min = Infinity, max = -Infinity;
            for (const n of all) {
                if (n.pitch < min) min = n.pitch;
                if (n.pitch > max) max = n.pitch;
            }
            return [min, max];
        }).filter(Boolean);
        return fixedKeyboardRange(ranges);
    }, [allMeasures]);

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
                <MiniKeyboard fixedRange={keyboardInfo.windowSemis} globalMin={keyboardInfo.globalMin} activeRight={activeRight} activeLeft={activeLeft} />
            </div>
        </aside>
    );
}

/**
 * Compute a stable keyboard window for the whole song.
 *
 * Strategy:
 *  1. Measure the global pitch range (min/max across all measures).
 *  2. Round UP to whole octaves — this is the window width.
 *  3. Add a minimum of one extra octave of padding (so the song does not
 *     sit wall-to-wall) but cap at 3 octaves total so the keys stay visible.
 *  4. Return { windowSemis, globalMin } so MiniKeyboard can anchor the
 *     initial window to the song's actual pitch centre rather than C3.
 *
 * Returns an object so callers receive both pieces of info.
 */
function fixedKeyboardRange(perMeasureRanges) {
    if (perMeasureRanges.length === 0) {
        return { windowSemis: 24, globalMin: 48 };
    }
    let minP = Infinity, maxP = -Infinity;
    for (const [a, b] of perMeasureRanges) {
        if (a < minP) minP = a;
        if (b > maxP) maxP = b;
    }
    // Round the full span up to the nearest octave boundary, then add one
    // octave of breathing room (capped at 36 = 3 octaves so keys stay legible).
    const span = maxP - minP + 1;
    const rounded = Math.ceil(span / 12) * 12;
    const windowSemis = Math.min(36, rounded + 12);
    return { windowSemis, globalMin: minP };
}

const sidebarStyle = {
    width: 340,
    flexShrink: 0,
    borderLeft: '1px solid var(--border)',
    background: 'color-mix(in oklab, var(--surface-1), transparent 30%)',
    // No overflowY here — let the page scroll so `position: sticky` works.
    padding: '20px 18px',
    // Sticky: mirrors how CoordinationTimeline pins to the top.
    position: 'sticky',
    top: 0,
    // align-self: flex-start is required so the sidebar's natural height is
    // used (not stretched to the parent's height), which allows sticky to
    // travel with the viewport scroll.
    alignSelf: 'flex-start',
    zIndex: 10,
    maxHeight: '100vh',
    overflowY: 'auto',
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
    // Use the base CSS var directly so ThemeService overrides propagate.
    // dim / border are derived via color-mix so they always track the base
    // hand color even when ThemeService JS sets --hand-right/left at runtime.
    const color = isRight ? 'var(--hand-right)' : 'var(--hand-left)';
    const dim = isRight
        ? 'color-mix(in oklab, var(--hand-right), transparent 82%)'
        : 'color-mix(in oklab, var(--hand-left), transparent 82%)';
    const border = isRight
        ? 'color-mix(in oklab, var(--hand-right), transparent 65%)'
        : 'color-mix(in oklab, var(--hand-left), transparent 65%)';
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

function MiniKeyboard({ fixedRange, globalMin, activeRight, activeLeft }) {
    // Fixed pitch window for the whole song. The keyboard never re-scales
    // when the focused measure changes; the window only shifts in octave
    // increments to keep active notes visible. Same approach as the
    // Android MiniKeyboard so the UX stays consistent across platforms.
    //
    // windowSemis is already rounded to whole octaves by fixedKeyboardRange.
    const windowSemis = Math.max(12, fixedRange ?? 24);

    // Persistent window start — anchored to the song's actual global minimum
    // pitch so the keyboard is pre-positioned over the real content rather
    // than always starting at C3. Snapped down to the nearest C boundary.
    const initialStart = React.useMemo(() => {
        if (globalMin != null && isFinite(globalMin)) {
            // Place the song content near the left edge with a small margin.
            const raw = globalMin - 6; // half-octave margin below the lowest note
            const mod = ((raw % 12) + 12) % 12;
            return Math.max(12, raw - mod);
        }
        // Fallback: centre around C3 (MIDI 48).
        const raw = 48 - windowSemis / 2;
        const mod = ((raw % 12) + 12) % 12;
        return Math.max(12, raw - mod);
    }, [windowSemis, globalMin]);
    const [startMidi, setStartMidi] = React.useState(initialStart);

    React.useEffect(() => {
        setStartMidi(initialStart);
    }, [initialStart]);

    React.useEffect(() => {
        const active = [
            ...(activeRight ? Array.from(activeRight) : []),
            ...(activeLeft ? Array.from(activeLeft) : []),
        ];
        if (active.length === 0) return;
        const hi = Math.max(...active);
        const lo = Math.min(...active);

        // Shift the window the MINIMUM number of octaves that makes BOTH lo
        // and hi visible at the same time. Since windowSemis >= (hi - lo + 1)
        // is guaranteed by fixedKeyboardRange (the window always fits the full
        // song span), a single direction is always sufficient — no oscillation.
        let s = startMidi;
        // 1. Shift up if hi is above the window's top.
        while (hi > s + windowSemis - 1) s += 12;
        // 2. Shift down if lo is below the window (won't fight step 1 because
        //    the window is guaranteed wide enough for the entire song range).
        while (lo < s) s -= 12;
        const clamped = Math.min(108 - windowSemis, Math.max(12, s));
        if (clamped !== startMidi) setStartMidi(clamped);
    }, [activeRight, activeLeft, startMidi, windowSemis]);

    const endMidi = startMidi + windowSemis - 1;
    const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

    const whiteIndex = {};
    let whiteCount = 0;
    for (let m = startMidi; m <= endMidi; m++) {
        if (!isBlack(m)) whiteIndex[m] = whiteCount++;
    }

    const whiteWidth = 100 / whiteCount; // percent units in viewBox
    const height = 52;
    const blackHeight = height * 0.62;
    const blackWidthRatio = 0.6;

    const colorFor = (m) => {
        if (activeRight?.has(m)) return 'var(--hand-right)';
        if (activeLeft?.has(m)) return 'var(--hand-left)';
        return null;
    };

    const whites = [];
    const blacks = [];
    for (let m = startMidi; m <= endMidi; m++) {
        if (isBlack(m)) {
            const prev = m - 1;
            const x = whiteIndex[prev] * whiteWidth + whiteWidth - (whiteWidth * blackWidthRatio) / 2;
            blacks.push(
                <rect
                    key={`b${m}`}
                    x={x}
                    y={0}
                    width={whiteWidth * blackWidthRatio}
                    height={blackHeight}
                    fill={colorFor(m) || 'var(--key-black, #1a1d24)'}
                    stroke="var(--key-border, #0a0c10)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />,
            );
        } else {
            const x = whiteIndex[m] * whiteWidth;
            whites.push(
                <rect
                    key={`w${m}`}
                    x={x}
                    y={0}
                    width={whiteWidth}
                    height={height}
                    fill={colorFor(m) || 'var(--key-white, #f2f4f8)'}
                    stroke="var(--key-white-shadow, #cbd0d8)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />,
            );
        }
    }

    return (
        <svg
            viewBox={`0 0 100 ${height}`}
            width="100%"
            height={height}
            preserveAspectRatio="none"
            style={{ display: 'block', marginTop: 8 }}
        >
            {whites}
            {blacks}
        </svg>
    );
}

export default LearnSidebar;
