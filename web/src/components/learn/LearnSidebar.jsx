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
        // Collect per-measure (min, max) pairs AND all pitches with their
        // event counts for the density vote — both hands must be included.
        const ranges = [];
        const allPitches = []; // flat list of every note pitch across all measures
        for (const m of (allMeasures || [])) {
            const all = [...(m.melody || []), ...(m.chords || [])];
            if (all.length === 0) continue;
            let min = Infinity, max = -Infinity;
            for (const n of all) {
                const p = typeof n.pitch === 'number' ? n.pitch : null;
                if (p === null) continue;
                if (p < min) min = p;
                if (p > max) max = p;
                allPitches.push(p);
            }
            if (isFinite(min)) ranges.push([min, max]);
        }
        return fixedKeyboardRange(ranges, allPitches);
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
                <MiniKeyboard fixedRange={keyboardInfo.windowSemis} densityAnchor={keyboardInfo.densityAnchor} activeRight={activeRight} activeLeft={activeLeft} keySignature={keySignature} />
            </div>
        </aside>
    );
}

/**
 * Compute a stable keyboard window for the whole song.
 *
 * Strategy:
 *  1. Measure the global pitch range (min/max across all measures, BOTH hands).
 *  2. Round UP to whole octaves — this is the window width.
 *  3. Add a minimum of one extra octave of padding (so the song does not
 *     sit wall-to-wall) but cap at 3 octaves total so the keys stay visible.
 *  4. Density vote: find the C-aligned window position that covers the most
 *     note events across the whole song. This anchors the keyboard over the
 *     busiest register rather than the extreme edges, while keeping the size
 *     fixed. For Departure the left-hand cluster (352 notes, ~46-56) wins.
 *
 * @param {Array<[number,number]>} perMeasureRanges - per-measure [min,max] pairs
 * @param {number[]} allPitches - flat list of every note pitch (both hands)
 * Returns { windowSemis, densityAnchor } where densityAnchor is the C-aligned
 * MIDI start of the best-fit window.
 */
function fixedKeyboardRange(perMeasureRanges, allPitches = []) {
    if (perMeasureRanges.length === 0) {
        return { windowSemis: 24, densityAnchor: 36 }; // C3
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

    // Density vote: sweep all C-aligned start positions that could contain
    // notes in [minP, maxP] and pick the one covering the most note events.
    // C boundaries are multiples of 12 in MIDI (C-1=0, C0=12, C1=24, …).
    const firstC = minP - ((((minP % 12) + 12) % 12)); // C at or below minP
    let bestStart = Math.max(12, firstC);
    let bestCount = 0;
    for (let s = Math.max(12, firstC); s <= maxP && s <= 108 - windowSemis; s += 12) {
        const endS = s + windowSemis - 1;
        let count = 0;
        for (const p of allPitches) {
            if (p >= s && p <= endS) count++;
        }
        if (count > bestCount) {
            bestCount = count;
            bestStart = s;
        }
    }
    // Clamp to valid keyboard range.
    const densityAnchor = Math.min(108 - windowSemis, Math.max(12, bestStart));
    return { windowSemis, densityAnchor };
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

function MiniKeyboard({ fixedRange, densityAnchor, activeRight, activeLeft, keySignature }) {
    // Fixed pitch window for the whole song. The keyboard never re-scales
    // when the focused measure changes; the window only shifts in octave
    // increments to keep active notes visible. Same approach as the
    // Android MiniKeyboard so the UX stays consistent across platforms.
    //
    // windowSemis is already rounded to whole octaves by fixedKeyboardRange.
    const windowSemis = Math.max(12, fixedRange ?? 24);

    // Persistent window start — anchored to the density-vote winner so the
    // keyboard is pre-positioned over the busiest register (e.g. the
    // left-hand chord cluster for Departure) rather than always starting at C3.
    // densityAnchor is already a C-aligned MIDI number from fixedKeyboardRange.
    const initialStart = React.useMemo(() => {
        if (densityAnchor != null && isFinite(densityAnchor)) {
            return Math.min(108 - windowSemis, Math.max(12, densityAnchor));
        }
        // Fallback: centre around C3 (MIDI 48).
        const raw = 48 - windowSemis / 2;
        const mod = ((raw % 12) + 12) % 12;
        return Math.max(12, raw - mod);
    }, [windowSemis, densityAnchor]);
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

        // Only shift the window if a note is actually outside the current view.
        // This is the "stable window" behavior: we do NOT force the window to
        // jump on every measure change; it only scrolls when needed.
        if (lo >= startMidi && hi <= startMidi + windowSemis - 1) return;

        // Compute a single stable target: the lowest C-aligned position that
        // covers both lo and hi. We start from the C just below `lo` and
        // move up by whole octaves until hi fits.
        const cBase = lo - (((lo % 12) + 12) % 12);
        let s = cBase;
        while (s + windowSemis - 1 < hi) s += 12;
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

    const whites = [];
    const blacks = [];

    // ── Octave-fold indicators ───────────────────────────────────────────────
    // For every note in the current measure that falls OUTSIDE [startMidi..endMidi],
    // fold it into the window by shifting ±12 repeatedly. The landing key gets the
    // hand color and a "+N" / "−N" label (proper Unicode minus) showing how many
    // octaves away the real note is.
    //
    // Collision rules:
    //  • Fold key also has a real note of the OTHER hand → split key top/bottom
    //    (top half = fold color, bottom half = real note color).
    //  • Fold key also has a real note of the SAME hand → single color, add label.
    //  • Two folded notes land on the same key → stack labels; split if diff hands.

    // foldedMap: midi → { foldHand, octaveOffset, realColorHand }
    // We track, for each window key, which fold(s) land on it.
    // Each entry: { hand: 'right'|'left', octaves: number }
    const foldEntries = new Map(); // key midi → [{ hand, octaves }]

    const collectFolds = (pitchSet, hand) => {
        if (!pitchSet) return;
        for (const p of pitchSet) {
            if (p >= startMidi && p <= endMidi) continue; // inside window, no fold
            let folded = p;
            if (p < startMidi) {
                while (folded < startMidi) folded += 12;
            } else {
                while (folded > endMidi) folded -= 12;
            }
            // Ensure it actually lands inside after folding (guard)
            if (folded < startMidi || folded > endMidi) continue;
            const octaves = (p - folded) / 12; // positive = real note is above fold key
            const existing = foldEntries.get(folded) || [];
            // De-dup: same hand + same octave offset already queued
            if (!existing.some((e) => e.hand === hand && e.octaves === octaves)) {
                existing.push({ hand, octaves });
            }
            foldEntries.set(folded, existing);
        }
    };
    collectFolds(activeRight, 'right');
    collectFolds(activeLeft, 'left');

    // Now rebuild the whites/blacks arrays with fold coloring + split key support.
    // We reuse the same loop structure but check foldEntries for each key.
    const foldLabels = []; // SVG text elements rendered on top of everything
    const labelFontSize = 9; // px (SVG units scaled to viewBox width 100)

    // Helper: octave label text
    const octaveLabel = (octaves) => {
        if (octaves > 0) return `+${octaves}`;
        if (octaves < 0) return `−${Math.abs(octaves)}`; // Unicode minus
        return '';
    };

    // Render all keys with fold coloring + split key support.
    for (let m = startMidi; m <= endMidi; m++) {
        const folds = foldEntries.get(m) || [];
        const realRight = activeRight?.has(m);
        const realLeft = activeLeft?.has(m);

        // Determine what color(s) to render:
        // A fold introduces an additional color on a key.
        // Priority for split: if a fold of one hand lands on a real note of the other hand.
        // We need to know the "effective" colors:
        //   topColor: color for top half of key (fold takes top)
        //   bottomColor: color for bottom half (real note or second fold)
        // If only one color source (no split needed), just use a single fill rect.

        let topColor = null;   // CSS color string or null
        let bottomColor = null;

        // Collect all color sources for this key:
        // Each source: { color: cssString, hand: 'right'|'left', isFold: bool }
        const sources = [];
        if (realRight) sources.push({ color: 'var(--hand-right)', hand: 'right', isFold: false });
        if (realLeft)  sources.push({ color: 'var(--hand-left)',  hand: 'left',  isFold: false });
        for (const { hand, octaves } of folds) {
            // Only add fold source if this hand doesn't already have a real note here
            const alreadyReal = (hand === 'right' && realRight) || (hand === 'left' && realLeft);
            if (!alreadyReal) {
                sources.push({ color: hand === 'right' ? 'var(--hand-right)' : 'var(--hand-left)', hand, isFold: true, octaves });
            }
        }

        // Determine split vs single:
        const hasRight = sources.some((s) => s.hand === 'right');
        const hasLeft  = sources.some((s) => s.hand === 'left');
        const needsSplit = hasRight && hasLeft;

        if (needsSplit) {
            // Top = fold color (whichever hand is folded), Bottom = real note color.
            // If both are folds (two different-hand folds on same key), top = right, bottom = left.
            const foldSrc = sources.find((s) => s.isFold);
            const realSrc = sources.find((s) => !s.isFold);
            topColor    = foldSrc  ? foldSrc.color  : 'var(--hand-right)';
            bottomColor = realSrc  ? realSrc.color   : 'var(--hand-left)';
        } else if (sources.length > 0) {
            topColor = sources[0].color;
            bottomColor = null; // single color, full key
        }

        const defaultFill = isBlack(m) ? 'var(--key-black, #1a1d24)' : 'var(--key-white, #f2f4f8)';

        if (!isBlack(m)) {
            const x = whiteIndex[m] * whiteWidth;
            if (needsSplit && topColor && bottomColor) {
                // Top half: fold color
                whites.push(
                    <rect key={`w${m}t`} x={x} y={0}         width={whiteWidth} height={height / 2} fill={topColor}    stroke="var(--key-white-shadow, #cbd0d8)" strokeWidth={1} vectorEffect="non-scaling-stroke" />,
                );
                // Bottom half: real note color
                whites.push(
                    <rect key={`w${m}b`} x={x} y={height / 2} width={whiteWidth} height={height / 2} fill={bottomColor} stroke="var(--key-white-shadow, #cbd0d8)" strokeWidth={1} vectorEffect="non-scaling-stroke" />,
                );
            } else {
                whites.push(
                    <rect key={`w${m}`} x={x} y={0} width={whiteWidth} height={height} fill={topColor || defaultFill} stroke="var(--key-white-shadow, #cbd0d8)" strokeWidth={1} vectorEffect="non-scaling-stroke" />,
                );
            }
        } else {
            const prev = m - 1;
            const x = whiteIndex[prev] * whiteWidth + whiteWidth - (whiteWidth * blackWidthRatio) / 2;
            if (needsSplit && topColor && bottomColor) {
                // Top half of black key
                blacks.push(
                    <rect key={`b${m}t`} x={x} y={0}              width={whiteWidth * blackWidthRatio} height={blackHeight / 2} fill={topColor}    stroke="var(--key-border, #0a0c10)" strokeWidth={1} vectorEffect="non-scaling-stroke" />,
                );
                // Bottom half of black key
                blacks.push(
                    <rect key={`b${m}b`} x={x} y={blackHeight / 2} width={whiteWidth * blackWidthRatio} height={blackHeight / 2} fill={bottomColor} stroke="var(--key-border, #0a0c10)" strokeWidth={1} vectorEffect="non-scaling-stroke" />,
                );
            } else {
                blacks.push(
                    <rect key={`b${m}`} x={x} y={0} width={whiteWidth * blackWidthRatio} height={blackHeight} fill={topColor || defaultFill} stroke="var(--key-border, #0a0c10)" strokeWidth={1} vectorEffect="non-scaling-stroke" />,
                );
            }
        }

        // Build fold labels for this key — drawn INSIDE the key, at its bottom
        // end: black text on white keys, white text on black keys (legibility).
        for (const { hand, octaves } of folds) {
            const onBlack = isBlack(m);
            const labelColor = onBlack ? '#ffffff' : '#0a0c10';
            const label = octaveLabel(octaves);
            if (!label) continue;

            // X center of key
            let cx;
            if (!onBlack) {
                cx = whiteIndex[m] * whiteWidth + whiteWidth / 2;
            } else {
                const prev = m - 1;
                cx = whiteIndex[prev] * whiteWidth + whiteWidth - (whiteWidth * blackWidthRatio) / 2 + (whiteWidth * blackWidthRatio) / 2;
            }

            // Stack labels if multiple folds on the same key (stack upward from the bottom)
            const stackIdx = folds.indexOf(folds.find((f) => f.hand === hand && f.octaves === octaves));
            const keyBottom = onBlack ? blackHeight : height;

            // HTML overlay (not SVG text): the SVG is stretched horizontally
            // (preserveAspectRatio "none"), which would distort any glyph drawn
            // inside it. cx is in viewBox units out of 100 → use it as a left %.
            foldLabels.push({
                id: `fl${m}-${hand}-${octaves}`,
                leftPct: cx,
                topPx: keyBottom - 11 - stackIdx * 9,
                color: labelColor,
                label,
            });
        }
    }

    return (
        <div style={{ position: 'relative', marginTop: 8 }}>
            <svg
                viewBox={`0 0 100 ${height}`}
                width="100%"
                height={height}
                preserveAspectRatio="none"
                style={{ display: 'block' }}
            >
                {whites}
                {blacks}
            </svg>
            {foldLabels.map((fl) => (
                <span
                    key={fl.id}
                    style={{
                        position: 'absolute',
                        left: `${fl.leftPct}%`,
                        top: fl.topPx,
                        transform: 'translateX(-50%)',
                        fontSize: 8,
                        lineHeight: '9px',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 700,
                        color: fl.color,
                        userSelect: 'none',
                        pointerEvents: 'none',
                    }}
                >{fl.label}</span>
            ))}
        </div>
    );
}

export default LearnSidebar;
