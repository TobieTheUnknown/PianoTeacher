/**
 * Sheet music rendering helpers — JS port of utils/MusicUtils.kt + the staff
 * geometry in ui/learning/LearningScreen.kt (GrandStaffCanvas).
 *
 * Coordinate convention: "diatonic" indexes scale degrees on the staff, where
 * C4 (middle C) = 35 (octave 4 × 7 steps + step index 0). One staff line or
 * space is one half-step in diatonic units, so vertical position on the staff
 * is `(topDiatonic - d) * (lineSpacing / 2)`.
 */

import { getMidiNumber } from '../models/song';

// ─── Geometry constants (dp on Android, treated as px on web at 1× scale) ────

export const STAFF_NUM_AREA_DP = 22;
export const STAFF_BOTTOM_PAD_DP = 8;
export const STAFF_H_MAX_DP = 120;
export const STAFF_H_MAX_LANDSCAPE_DP = 70;

// ─── Color palette (fallbacks — live values come from CSS vars at runtime) ───
//
// The canvas can't read CSS custom properties directly, so the React layer
// resolves the theme tokens (see resolveSheetTheme) and passes them into
// renderMeasure() via opts.theme. These constants are only fallbacks used when
// no theme is supplied (e.g. in tests).

export const COLOR_MELODY = '#22D3EE';      // --hand-right (right hand / treble)
export const COLOR_CHORDS = '#EC4899';      // --hand-left  (left hand / bass)
export const COLOR_PLAYING = '#3b82f6';     // --accent — currently playing
export const COLOR_STAFF_LINE = 'rgba(255, 255, 255, 0.14)';
export const COLOR_LEDGER = 'rgba(255, 255, 255, 0.45)';
export const COLOR_CLEF = 'rgba(255, 255, 255, 0.42)';
export const COLOR_KEYSIG = 'rgba(255, 255, 255, 0.66)';
export const COLOR_BRACKET = 'rgba(255, 255, 255, 0.30)';
export const COLOR_BAR = 'rgba(255, 255, 255, 0.22)';
export const COLOR_MEASURE_NUM = '#64748B';

const DEFAULT_SHEET_THEME = {
    melody: COLOR_MELODY,
    chords: COLOR_CHORDS,
    accent: COLOR_PLAYING,
    staffLine: COLOR_STAFF_LINE,
    staffLineKey: 'rgba(255, 255, 255, 0.22)',
    ledger: COLOR_LEDGER,
    clef: COLOR_CLEF,
    keySig: COLOR_KEYSIG,
    bracket: COLOR_BRACKET,
    bar: COLOR_BAR,
    measureNum: COLOR_MEASURE_NUM,
};

/**
 * Read the live theme tokens from the DOM so the canvas renderer follows the
 * theme editor (accent / hand-color presets). Falls back to the static palette
 * when no document is available. Call from React and memoise on the theme key.
 */
export function resolveSheetTheme(rootEl) {
    if (typeof window === 'undefined' || !rootEl) return DEFAULT_SHEET_THEME;
    const cs = getComputedStyle(rootEl);
    const v = (name, fallback) => {
        const raw = cs.getPropertyValue(name);
        return raw && raw.trim() ? raw.trim() : fallback;
    };
    return {
        melody: v('--hand-right', COLOR_MELODY),
        chords: v('--hand-left', COLOR_CHORDS),
        accent: v('--accent', COLOR_PLAYING),
        staffLine: v('--sheet-staff-line', COLOR_STAFF_LINE),
        staffLineKey: v('--sheet-staff-key', 'rgba(255, 255, 255, 0.22)'),
        ledger: v('--sheet-ledger', COLOR_LEDGER),
        clef: v('--text-secondary', COLOR_CLEF),
        keySig: v('--text-secondary', COLOR_KEYSIG),
        bracket: v('--border-strong', COLOR_BRACKET),
        bar: v('--border-strong', COLOR_BAR),
        measureNum: v('--text-tertiary', COLOR_MEASURE_NUM),
    };
}

// ─── Duration → engraving classification ─────────────────────────────────────

/**
 * Classify a note duration (in quarter-note beats) into engraving attributes.
 * Pragmatic, not exhaustive: maps to the nearest standard value and detects
 * dotted notes (≈1.5× a base value).
 *
 * Returns:
 *   filled  — solid notehead (quarter and shorter) vs hollow (half / whole)
 *   stem    — whether the note carries a stem (whole notes don't)
 *   flags   — number of flags/beams (0 = quarter+, 1 = eighth, 2 = sixteenth…)
 *   dotted  — augmentation dot present
 */
export function classifyDuration(durationBeats) {
    const d = durationBeats > 0 ? durationBeats : 1;
    // Base values in quarter-note beats: whole=4, half=2, quarter=1, eighth=0.5…
    const BASES = [
        { beats: 4, filled: false, stem: false, flags: 0 }, // whole
        { beats: 2, filled: false, stem: true, flags: 0 },  // half
        { beats: 1, filled: true, stem: true, flags: 0 },   // quarter
        { beats: 0.5, filled: true, stem: true, flags: 1 }, // eighth
        { beats: 0.25, filled: true, stem: true, flags: 2 },// sixteenth
        { beats: 0.125, filled: true, stem: true, flags: 3 },
    ];
    let best = BASES[2];
    let bestErr = Infinity;
    let dotted = false;
    for (const base of BASES) {
        // plain
        let err = Math.abs(d - base.beats) / base.beats;
        if (err < bestErr) { bestErr = err; best = base; dotted = false; }
        // dotted (1.5×)
        err = Math.abs(d - base.beats * 1.5) / (base.beats * 1.5);
        if (err < bestErr) { bestErr = err; best = base; dotted = true; }
    }
    return { ...best, dotted };
}

// ─── Diatonic mapping ────────────────────────────────────────────────────────

const CHROMATIC_TO_DIATONIC_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const CHROMATIC_TO_DIATONIC_FLAT  = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];

/**
 * Convert a MIDI pitch to a diatonic index on the staff. Octave × 7 + step.
 * Step 0 = C, 1 = D, …, 6 = B. Useful for vertical positioning.
 */
export function midiToDiatonic(midi, useFlats = false) {
    const octave = Math.floor(midi / 12);
    const chroma = ((midi % 12) + 12) % 12;
    const table = useFlats ? CHROMATIC_TO_DIATONIC_FLAT : CHROMATIC_TO_DIATONIC_SHARP;
    return octave * 7 + table[chroma];
}

export function isBlackKey(midi) {
    const c = ((midi % 12) + 12) % 12;
    return c === 1 || c === 3 || c === 6 || c === 8 || c === 10;
}

/**
 * Normalize a note's pitch field to a MIDI integer.
 * Web stores pitch as either a number (already MIDI) or a string ("C4").
 */
export function normalizePitch(pitchField) {
    if (typeof pitchField === 'number') return pitchField;
    return getMidiNumber(pitchField);
}

// ─── Clef configurations ─────────────────────────────────────────────────────

/**
 * Diatonic values on each clef's staff lines, BOTTOM to TOP:
 * Treble: E4=37, G4=39, B4=41, D5=43, F5=45  (G clef anchors on G4=39, second line)
 * Bass:   G2=25, B2=27, D3=29, F3=31, A3=33  (F clef anchors on F3=31, fourth line)
 *
 * keyLineFromTop: which line (0 = topmost) the clef glyph anchors on.
 * anchorFrac:     vertical fraction of glyph height at which to anchor.
 * fontScale:      glyph font size as a fraction of staffH.
 */
export const TREBLE_CLEF = {
    name: 'Sol',
    glyph: '𝄞',
    keyDiatonic: 39,
    keyLineFromTop: 3,
    lines: [37, 39, 41, 43, 45],
    anchorFrac: 0.62,
    fontScale: 1.2,
    extraYOffset: 0,
};

export const BASS_CLEF = {
    name: 'Fa',
    glyph: '𝄢',
    keyDiatonic: 31,
    keyLineFromTop: 1,
    lines: [25, 27, 29, 31, 33],
    anchorFrac: 0.44,
    fontScale: 0.95,
    extraYOffset: -2,
};

export const ALTO_CLEF = {
    name: 'Ut3',
    glyph: '𝄡',
    keyDiatonic: 35,
    keyLineFromTop: 2,
    lines: [31, 33, 35, 37, 39],
    anchorFrac: 0.50,
    fontScale: 0.55,
    extraYOffset: 0,
};

export const TENOR_CLEF = {
    name: 'Ut4',
    glyph: '𝄡',
    keyDiatonic: 35,
    keyLineFromTop: 1,
    lines: [29, 31, 33, 35, 37],
    anchorFrac: 0.50,
    fontScale: 0.55,
    extraYOffset: 0,
};

const ALL_CLEFS = [TREBLE_CLEF, BASS_CLEF, ALTO_CLEF, TENOR_CLEF];

/**
 * Pick the clef that minimises the number of ledger lines for a set of notes.
 */
export function selectClef(notes, useFlats) {
    if (!notes || notes.length === 0) return TREBLE_CLEF;
    const diatonics = notes.map(n => midiToDiatonic(normalizePitch(n.pitch), useFlats));
    let best = TREBLE_CLEF;
    let bestCost = Infinity;
    for (const clef of ALL_CLEFS) {
        const top = clef.lines[clef.lines.length - 1];
        const bottom = clef.lines[0];
        const cost = diatonics.reduce((sum, d) => {
            if (d > top) return sum + Math.floor((d - top + 1) / 2);
            if (d < bottom) return sum + Math.floor((bottom - d + 1) / 2);
            return sum;
        }, 0);
        if (cost < bestCost) { bestCost = cost; best = clef; }
    }
    return best;
}

// ─── Key signature accidentals ───────────────────────────────────────────────

// Diatonic positions of accidentals on the treble staff, in canonical order.
// Sharps go FCGDAEB; flats go BEADGCF.
export const TREBLE_SHARP_POS = [45, 42, 46, 43, 40, 44, 41]; // F5,C5,G5,D5,A4,E5,B4
export const TREBLE_FLAT_POS  = [41, 44, 40, 43, 39, 42, 38]; // B4,E5,A4,D5,G4,C5,F4
// Bass staff is 14 diatonic steps (2 octaves) below treble.
export const BASS_SHARP_POS   = [31, 28, 32, 29, 26, 30, 27];
export const BASS_FLAT_POS    = [27, 30, 26, 29, 25, 28, 24];

/**
 * Number of sharps or flats for a given KeySignature-ish object.
 * Accepts either { root: 0..11, isMinor, useFlats } (Kotlin shape) or the web's
 * { note: 'C', mode: 'major' } shape — we convert to MIDI root + isMinor.
 */
export function keySignatureAccidentalCount(keySig) {
    if (!keySig) return 0;
    const { root, isMinor, useFlats } = toKotlinKeySig(keySig);
    const majorRoot = isMinor ? ((root + 3) % 12) : root;
    if (useFlats) {
        // Flat major keys: F(5)=1, Bb(10)=2, Eb(3)=3, Ab(8)=4, Db(1)=5, Gb(6)=6
        return ({ 5: 1, 10: 2, 3: 3, 8: 4, 1: 5, 6: 6 })[majorRoot] || 0;
    }
    // Sharp major keys: G(7)=1, D(2)=2, A(9)=3, E(4)=4, B(11)=5, F#(6)=6
    return ({ 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6 })[majorRoot] || 0;
}

const NOTE_NAME_TO_PITCHCLASS = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11,
};

const FLAT_KEYS_MAJOR = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);
const FLAT_KEYS_MINOR = new Set(['D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab']);

/** Convert a web-shape key (`{ note, mode }`) to the Kotlin shape. */
export function toKotlinKeySig(keySig) {
    if (!keySig) return null;
    // Already Kotlin shape
    if ('root' in keySig && 'isMinor' in keySig) return keySig;
    const note = keySig.note;
    const mode = keySig.mode;
    const root = NOTE_NAME_TO_PITCHCLASS[note] ?? 0;
    const isMinor = mode === 'minor';
    const useFlats = isMinor ? FLAT_KEYS_MINOR.has(note) : FLAT_KEYS_MAJOR.has(note);
    return { root, isMinor, useFlats, keyName: `${note}-${mode}` };
}

// ─── Octave shift heuristics (8va/8vb/15ma/15mb) ─────────────────────────────

/**
 * Suggest an octave shift (in diatonic steps, multiples of 7) for the upper
 * staff in STANDARD mode based on median pitch. Returns 0 if median is within
 * the staff center range; ±7 for one octave shift; ±14 for two.
 */
export function suggestUpperOctaveShift(melodyNotes, clef = TREBLE_CLEF, useFlats = false) {
    const ds = melodyNotes.map(n => midiToDiatonic(normalizePitch(n.pitch), useFlats));
    return medianOctaveShift(ds, clef);
}

export function suggestLowerOctaveShift(chordNotes, clef = BASS_CLEF, useFlats = false) {
    const ds = chordNotes.map(n => midiToDiatonic(normalizePitch(n.pitch), useFlats));
    return medianOctaveShift(ds, clef);
}

function medianOctaveShift(diatonics, clef) {
    if (diatonics.length === 0) return 0;
    const sorted = [...diatonics].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const staffCenter = (clef.lines[0] + clef.lines[clef.lines.length - 1]) / 2;
    const surplus = median - staffCenter;
    if (surplus >= 14)  return -14;
    if (surplus >= 7)   return -7;
    if (surplus <= -14) return 14;
    if (surplus <= -7)  return 7;
    return 0;
}

export function octaveShiftLabel(shift) {
    if (shift >= 14) return '15mb';
    if (shift >= 7)  return '8vb';
    if (shift <= -14) return '15ma';
    if (shift <= -7)  return '8va';
    return '';
}

// ─── Measure slicing ─────────────────────────────────────────────────────────

/**
 * Slice a phrase's tracks into per-measure note lists. Notes are split by the
 * integer measure their startTime falls into. startTime is preserved (absolute
 * within the phrase) so callers can compute fraction-of-measure as
 * `(note.startTime - measureIndex * beatsPerMeasure) / beatsPerMeasure`.
 */
export function slicePhraseIntoMeasures(phrase, beatsPerMeasure = 4) {
    if (!phrase) return [];
    const length = phrase.length || 1;
    const measures = [];
    // Snap notes within EPSILON of a measure boundary forward to the next
    // measure, mirroring measureUtils.getMeasuresFromPhrase. Without this, a
    // downbeat stored as e.g. 27.99999999999996 (FP noise from legacy imports)
    // would render at the very end of measure 6 instead of the start of 7.
    const EPSILON = 0.001;
    for (let m = 0; m < length; m++) {
        const measureStart = m * beatsPerMeasure;
        const measureEnd = measureStart + beatsPerMeasure;
        const inMeasure = (n) => {
            const t = n.startTime ?? 0;
            return t >= measureStart - EPSILON && t < measureEnd - EPSILON;
        };
        const melody = (phrase.tracks?.melody || []).filter(inMeasure);
        const chords = (phrase.tracks?.chords || []).filter(inMeasure);
        measures.push({ measureIndex: m, measureStart, melodyNotes: melody, chordNotes: chords });
    }
    return measures;
}

/**
 * Flatten a Song's phrases into a single list of measures, each tagged with
 * the phrase index and a globalIndex.
 */
export function flattenSongMeasures(song, beatsPerMeasure = 4) {
    if (!song || !song.phrases) return [];
    const out = [];
    let globalIndex = 0;
    song.phrases.forEach((phrase, phraseIndex) => {
        const measures = slicePhraseIntoMeasures(phrase, beatsPerMeasure);
        measures.forEach((m) => {
            out.push({
                ...m,
                phraseIndex,
                phraseName: phrase.name,
                globalIndex: globalIndex++,
            });
        });
    });
    return out;
}

// ─── Beam grouping ───────────────────────────────────────────────────────────

/**
 * Partition a time-ordered list of beamable chord-items (eighth or shorter,
 * i.e. dur.stem && dur.flags >= 1) into beam groups for a single staff.
 *
 * Android mirrors this — signature:
 *   computeBeamGroups(items, beatsPerMeasure) -> number[][]
 * where each `item` exposes { startBeat, durationBeats, flags } and the result
 * is a list of groups, each an array of indices INTO `items` (ascending).
 *
 * Cut rules (a group ends — next item starts a new group — when any holds):
 *   (a) time gap: next.startBeat > cur.startBeat + cur.durationBeats + 0.03
 *       (a rest or non-adjacent note sits between them).
 *   (b) beat-pair boundary: floor(startBeat / 2) changes — groups never cross
 *       the 1-2 → 3-4 half-bar boundary in 4/4. For runs whose items are ALL
 *       sixteenths-or-shorter (flags >= 2), cut per single beat instead
 *       (floor(startBeat) changes).
 * Non-beamable notes (quarter or longer) are simply not present in `items`, so
 * an intervening quarter manifests as a time gap (rule a) and cuts the group.
 *
 * @param {Array<{startBeat:number,durationBeats:number,flags:number}>} items
 * @returns {number[][]} groups of indices into `items`
 */
export function computeBeamGroups(items) {
    const groups = [];
    let cur = [];
    for (let i = 0; i < items.length; i++) {
        if (cur.length === 0) { cur = [i]; continue; }
        const prev = items[cur[cur.length - 1]];
        const it = items[i];
        // (a) time gap — a rest or a non-beamable note sits between.
        const gap = it.startBeat > prev.startBeat + prev.durationBeats + 0.03;
        // (b) beat boundary. Sixteenth-only runs cut per beat, else per beat-pair.
        const sixteenthRun = cur.every((idx) => items[idx].flags >= 2) && it.flags >= 2;
        const beatUnit = sixteenthRun ? 1 : 2;
        const crossedBeat =
            Math.floor(it.startBeat / beatUnit) !== Math.floor(prev.startBeat / beatUnit);
        if (gap || crossedBeat) {
            groups.push(cur);
            cur = [i];
        } else {
            cur.push(i);
        }
    }
    if (cur.length) groups.push(cur);
    return groups;
}

// ─── Header (clef + armure + time signature) geometry ───────────────────────
//
// The "header" is the fixed zone drawn at the LEFT of a system's first measure
// when showClefs is true: the clef glyph, the key-signature accidentals
// (armure) and — on the very first system — the time signature. Both
// renderMeasure() and the React layer need its exact pixel width so the four
// measures of a system can share equal MUSICAL widths and their barlines line
// up in a clean grid. To guarantee they never drift, renderMeasure() and
// computeHeaderWidth() derive every horizontal constant from the helpers below.

/**
 * Per-accidental horizontal advance in the key signature. Shared by the
 * renderer and the header-width calculator so they can't disagree.
 */
function accStepPx(dp) {
    return dp(9);
}

/** Width of the key-signature accidental block (0 when there are none). */
function keySigBlockWidth(numAccidentals, dp) {
    return numAccidentals > 0 ? numAccidentals * accStepPx(dp) + dp(5) : 0;
}

/** Width of the bare clef glyph zone (no key signature). */
function clefGlyphZoneWidth(staffH, dp) {
    return Math.max(staffH * 0.26, dp(22));
}

/** Width reserved for the stacked time-signature digits. */
function timeSigZoneWidth(lineSpacing, dp) {
    return lineSpacing * 2.4 + dp(6);
}

/**
 * Compute the px width of the header (clef + armure [+ time signature]) drawn
 * by renderMeasure when showClefs is true. This MUST exactly match what
 * renderMeasure lays out — both call the same private helpers above.
 *
 * @param {object} p
 *   - lineSpacing: resolved staff line spacing in px (see renderMeasure)
 *   - keySig: key signature (web or Kotlin shape) — for the accidental count
 *   - showTimeSig: include the time-signature zone in the width
 *   - clefMode: 'STANDARD' | 'TREBLE_X2' | 'AUTO' (AUTO hides the armure)
 *   - dp: dp→px scaler
 * @returns {number} header width in px
 */
export function computeHeaderWidth({ lineSpacing, keySig, showTimeSig = false, clefMode = 'STANDARD', dp = (n) => n }) {
    const staffH = lineSpacing * 4;
    const numAccidentals = clefMode !== 'AUTO' ? keySignatureAccidentalCount(keySig) : 0;
    const ksW = keySigBlockWidth(numAccidentals, dp);
    const tsW = showTimeSig ? timeSigZoneWidth(lineSpacing, dp) : 0;
    // trailing pad before the first note (breathing room after the armure/TS).
    const trailingPad = dp(8);
    return clefGlyphZoneWidth(staffH, dp) + ksW + tsW + trailingPad;
}

/**
 * Resolve the staff line spacing exactly as renderMeasure does, given the
 * canvas height. Exported so the React layer can compute a page-wide
 * headerWidth that matches the renderer without guessing.
 */
export function computeLineSpacing({ height: h, isLandscape = false, dp = (n) => n }) {
    const numAreaH  = dp(STAFF_NUM_AREA_DP);
    const topPad    = numAreaH + dp(8);
    const bottomPad = dp(STAFF_BOTTOM_PAD_DP);
    const totalAvail = h - topPad - bottomPad;
    const staffHMax = isLandscape ? dp(STAFF_H_MAX_LANDSCAPE_DP) : dp(STAFF_H_MAX_DP);
    const HEADROOM_STEPS = 7;
    const headroomUnitsPerStaff = HEADROOM_STEPS / 2;
    return Math.max(
        dp(7),
        Math.min(totalAvail / (10 + 2 * headroomUnitsPerStaff), staffHMax / 4),
    );
}

// ─── Pure render function (canvas 2D context) ────────────────────────────────

/**
 * Render a single measure on a 2D canvas context. Coordinates are in physical
 * pixels — callers handle devicePixelRatio scaling by scaling the context
 * before calling.
 *
 * Pixel-fidelity port of GrandStaffCanvas in LearningScreen.kt.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 *   - width, height: canvas dimensions in CSS px
 *   - measureNumber: 1-based for display
 *   - melodyNotes, chordNotes: arrays of { pitch, startTime, duration }
 *   - beatsPerMeasure: usually 4
 *   - useFlats: bool — affects diatonic step for black keys
 *   - showClefs: bool — first measure of a phrase typically shows them
 *   - isPlaying: bool — highlights background indigo
 *   - isFocused: bool — subtle white background
 *   - clefMode: 'STANDARD' | 'TREBLE_X2' | 'AUTO'
 *   - upperOctaveShift, lowerOctaveShift: diatonic shifts (multiples of 7)
 *   - keySig: { root, isMinor, useFlats } or { note, mode }
 *   - isLandscape: bool
 *   - dp: function (n) => px — scales dp to canvas px (handles DPR + density)
 *   - showStems: bool — when false, skip stems/flags/augmentation dots (default true)
 *   - showTimeSig: bool — draw the time signature after the armure (first system only)
 *   - timeSignature: { numerator, denominator } — defaults to 4/4
 *   - headerWidth: number — explicit px offset at which the musical content
 *       begins on showClefs measures. When provided it OVERRIDES the locally
 *       computed header so the React layer can share ONE page-wide header
 *       (including the first-system time signature) across every system, giving
 *       a pixel-equal 4-column grid. When omitted, the header is computed
 *       locally (back-compat: standalone renders still look right).
 */
export function renderMeasure(ctx, opts) {
    const {
        width: w,
        height: h,
        measureNumber,
        melodyNotes = [],
        chordNotes = [],
        beatsPerMeasure = 4,
        measureStart = 0,
        useFlats = false,
        showClefs = false,
        isPlaying = false,
        isFocused = false,
        clefMode = 'STANDARD',
        upperOctaveShift = 0,
        lowerOctaveShift = 0,
        keySig = null,
        isLandscape = false,
        dp = (n) => n, // 1 dp = 1 px by default
        theme = DEFAULT_SHEET_THEME,
        showStems = true,
        showTimeSig = false,
        timeSignature = null,
        headerWidth = null,
    } = opts;
    const T = theme || DEFAULT_SHEET_THEME;

    // Background
    if (isPlaying) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.10)';
        ctx.fillRect(0, 0, w, h);
    } else if (isFocused) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(0, 0, w, h);
    }

    const numAreaH  = dp(STAFF_NUM_AREA_DP);
    const topPad    = numAreaH + dp(8);
    const bottomPad = dp(STAFF_BOTTOM_PAD_DP);

    const totalAvail   = h - topPad - bottomPad;
    const staffHMax    = isLandscape ? dp(STAFF_H_MAX_LANDSCAPE_DP) : dp(STAFF_H_MAX_DP);
    // Reserve vertical headroom above the treble staff and below the bass staff
    // so notes (+ ledger lines + accidentals) that sit outside the staves —
    // e.g. C#2, well below the bass staff — aren't clipped by the canvas edge.
    // HEADROOM_STEPS counts ledger *steps* (half a line spacing each); 7 steps ≈
    // 3.5 ledger lines of clearance on each side. The staff block is
    // 10 line-spacings tall (2 staves of 4 + a 2-spacing gap), so the headroom
    // budget on each side is HEADROOM_STEPS/2 line-spacings.
    const HEADROOM_STEPS = 7;
    const headroomUnitsPerStaff = HEADROOM_STEPS / 2; // in line-spacings, per side
    // Solve for the largest lineSpacing whose staves + both headroom margins fit
    // the available height: 10·ls (staves) + 2·headroom·ls ≤ totalAvail.
    // Enforce a minimum of dp(7) so stems (3.2·ls ≈ 22 px) and noteheads remain
    // readable on compact mobile canvases (h=132 px).  At this floor the staves
    // still fit: topPad(30) + 10·7(70) + bottomPad(8) = 108 px < 132 px, with the
    // leftover split evenly as narrower-but-sufficient ledger-line headroom.
    const lineSpacing  = Math.max(
        dp(7),
        Math.min(
            totalAvail / (10 + 2 * headroomUnitsPerStaff),
            staffHMax / 4,
        ),
    );
    const staffH       = lineSpacing * 4;
    const gap          = lineSpacing * 2; // exactly 2 line spacings — middle C falls between staves
    const totalStavesH = staffH * 2 + gap;
    const stavesOriginY = topPad + (totalAvail - totalStavesH) / 2;

    const showKeySig = showClefs && clefMode !== 'AUTO';
    const numAccidentals = showKeySig ? keySignatureAccidentalCount(keySig) : 0;
    const accStep = accStepPx(dp);  // horizontal step between key-sig accidentals
    const ksW = keySigBlockWidth(numAccidentals, dp);
    const pureClefW = showClefs ? clefGlyphZoneWidth(staffH, dp) : 0;
    const showTS = showClefs && showTimeSig;
    // X (relative to staff left) where the time signature is drawn, after the
    // clef glyph + armure.
    const tsX = pureClefW + ksW + dp(2);
    // The header zone reserved before the musical content on showClefs measures.
    // Prefer the caller-supplied page-wide headerWidth (keeps the 4-column grid
    // identical across every system) and fall back to a locally computed one.
    const localHeader = showClefs
        ? computeHeaderWidth({ lineSpacing, keySig, showTimeSig: showTS, clefMode, dp })
        : 0;
    const headerW = showClefs ? (headerWidth != null ? headerWidth : localHeader) : 0;
    const barPad = dp(10);
    const dotR = lineSpacing * (isLandscape ? 0.45 : 0.42);

    // Resolve clefs + note assignment
    let upperClef, lowerClef, upperNotes, lowerNotes;
    if (clefMode === 'STANDARD') {
        upperClef = TREBLE_CLEF; lowerClef = BASS_CLEF;
        upperNotes = melodyNotes; lowerNotes = chordNotes;
    } else if (clefMode === 'TREBLE_X2') {
        upperClef = TREBLE_CLEF; lowerClef = TREBLE_CLEF;
        upperNotes = melodyNotes; lowerNotes = chordNotes;
    } else { // AUTO
        upperClef = selectClef(melodyNotes, useFlats);
        lowerClef = selectClef(chordNotes, useFlats);
        upperNotes = melodyNotes; lowerNotes = chordNotes;
    }

    // Measure number (top center)
    ctx.fillStyle = isPlaying ? T.accent : T.measureNum;
    ctx.font = `${isPlaying ? '600 ' : '500 '}${dp(12)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${measureNumber}`, w / 2, dp(5));

    // Left bracket
    const bracketX = isLandscape ? 0 : dp(1);
    ctx.strokeStyle = T.bracket;
    ctx.lineWidth = dp(2.5);
    ctx.beginPath();
    ctx.moveTo(bracketX, stavesOriginY);
    ctx.lineTo(bracketX, stavesOriginY + totalStavesH);
    ctx.stroke();

    // Draw both staves
    const staffTops = [stavesOriginY, stavesOriginY + staffH + gap];
    const staffClefs = [upperClef, lowerClef];
    const staffNotes = [
        upperNotes.map(n => ({ note: n, color: T.melody })),
        lowerNotes.map(n => ({ note: n, color: T.chords })),
    ];
    const staffShifts = [upperOctaveShift, lowerOctaveShift];

    for (let si = 0; si < 2; si++) {
        const clef = staffClefs[si];
        const lineTop = staffTops[si];
        const topDiatonic = clef.lines[clef.lines.length - 1];
        const bottomDiatonic = clef.lines[0];

        // Staff lines (5). The hand-coloured "key line" of the old design read
        // as a noisy stripe through the staff — hand identity now comes from
        // the notehead colour, so all lines are neutral and uniform. The clef's
        // anchor line gets a barely-stronger weight for a subtle reference.
        for (let li = 0; li <= 4; li++) {
            const y = lineTop + li * lineSpacing;
            const lineDiatonic = clef.lines[4 - li];
            const isKey = lineDiatonic === clef.keyDiatonic;
            ctx.strokeStyle = isKey ? T.staffLineKey : T.staffLine;
            ctx.globalAlpha = 1;
            ctx.lineWidth = isKey ? dp(1.1) : dp(0.9);
            ctx.beginPath();
            ctx.moveTo(bracketX + dp(2), y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Clef glyph
        if (showClefs) {
            const clefFontPx = staffH * clef.fontScale;
            ctx.fillStyle = T.clef;
            ctx.font = `${clefFontPx}px "Noto Music", "Bravura", "Symbola", "Times New Roman", serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            const clefMetrics = ctx.measureText(clef.glyph);
            // Use approx 1.0 of font px as height since canvas TextMetrics height varies.
            const clefHeight = clefFontPx;
            const keyY = lineTop + clef.keyLineFromTop * lineSpacing;
            const bassAdj = clef.name === 'Fa' ? (isLandscape ? dp(2) : dp(1)) : 0;
            // We want the clef anchor point (a fraction of its height) on keyY.
            // Convert from top-left baseline math: drawY (baseline) = clefY + height
            const clefTopY = keyY - clefHeight * clef.anchorFrac - dp(clef.extraYOffset) + bassAdj;
            const clefBaselineY = clefTopY + clefHeight * 0.85; // approx baseline offset for glyphs
            const clefX = Math.max((pureClefW - clefMetrics.width) / 2, dp(2));
            ctx.fillText(clef.glyph, clefX, clefBaselineY);

            // Key signature accidentals
            if (numAccidentals > 0 && keySig) {
                const ks = toKotlinKeySig(keySig);
                const isTreble = clef.name === 'Sol';
                const positions = ks.useFlats
                    ? (isTreble ? TREBLE_FLAT_POS : BASS_FLAT_POS)
                    : (isTreble ? TREBLE_SHARP_POS : BASS_SHARP_POS);
                const accLabel = ks.useFlats ? '♭' : '♯';
                ctx.fillStyle = T.keySig;
                ctx.font = `${lineSpacing * 1.9}px "Noto Music", "Bravura", "Times New Roman", serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                for (let i = 0; i < numAccidentals; i++) {
                    const d = positions[i];
                    const ax = pureClefW + dp(3) + i * accStep;
                    const ay = lineTop + (topDiatonic - d) * (lineSpacing / 2);
                    ctx.fillText(accLabel, ax, ay);
                }
            }

            // Time signature — stacked numerator/denominator, centered on this
            // staff, after the armure. First system only (showTS).
            if (showTS) {
                const num = timeSignature?.numerator ?? beatsPerMeasure ?? 4;
                const den = timeSignature?.denominator ?? 4;
                const staffMidY = lineTop + 2 * lineSpacing; // middle (3rd) line
                ctx.fillStyle = T.keySig;
                ctx.font = `bold ${lineSpacing * 2}px "Times New Roman", Georgia, serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const digitCenterX = tsX + timeSigZoneWidth(lineSpacing, dp) / 2 - dp(3);
                // numerator above the middle line, denominator below — each pair
                // half spans roughly one line-spacing from the centre.
                ctx.fillText(String(num), digitCenterX, staffMidY - lineSpacing);
                ctx.fillText(String(den), digitCenterX, staffMidY + lineSpacing);
            }
        }

        // Octave shift label
        const octShift = staffShifts[si];
        if (showClefs && octShift !== 0) {
            const lbl = octaveShiftLabel(octShift);
            if (lbl) {
                ctx.fillStyle = T.measureNum;
                ctx.font = `700 ${dp(9)}px system-ui, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                const labelY = octShift > 0
                    ? lineTop + 4 * lineSpacing + dp(3)
                    : lineTop - dp(9) - dp(2);
                ctx.fillText(lbl, dp(2), labelY);
            }
        }

        // Notes — duration-aware engraving.
        const color = si === 0 ? T.melody : T.chords;
        const midLineY = lineTop + 2 * lineSpacing;           // middle (3rd) line
        const headRx = dotR * 1.08;                            // notehead radii
        const headRy = dotR * 0.84;
        // Musical content begins after the header zone (clef + armure + time
        // signature) on showClefs measures, and after a small inset on the
        // rest. A consistent left inset (room for the first notehead) is added
        // beyond the header so noteheads never sit on the start barline, while
        // every measure's musical SPAN stays equal for a clean column grid.
        const leftPad = barPad + dotR * 2;
        const noteAreaStart = headerW + leftPad;
        const noteAreaEnd = w - barPad - dotR;

        const xForTime = (startTime) => {
            const frac = Math.max(0, Math.min(1, (startTime - measureStart) / beatsPerMeasure));
            return noteAreaStart + frac * (noteAreaEnd - noteAreaStart);
        };
        const yForDiatonic = (d) => lineTop + (topDiatonic - d) * (lineSpacing / 2);

        // Group notes sounding at the same time into chords (shared stem).
        const groups = new Map();
        for (const note of staffNotes[si].map((s) => s.note)) {
            const midi = normalizePitch(note.pitch);
            if (midi == null) continue;
            const key = Math.round((note.startTime ?? 0) * 1000) / 1000;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ note, midi });
        }

        const drawLedgers = (x, d, headDx = 0) => {
            ctx.strokeStyle = T.ledger;
            ctx.lineWidth = dp(1);
            // Cover the notehead even when it's been offset to the other side of
            // the stem (chord seconds): widen toward the offset direction.
            const lx0 = Math.min(x, x + headDx) - headRx - dp(2);
            const lx1 = Math.max(x, x + headDx) + headRx + dp(2);
            if (d > topDiatonic + 1) {
                for (let ld = topDiatonic + 2; ld <= d; ld += 2) {
                    const ly = yForDiatonic(ld);
                    ctx.beginPath(); ctx.moveTo(lx0, ly); ctx.lineTo(lx1, ly); ctx.stroke();
                }
            }
            if (d < bottomDiatonic - 1) {
                for (let ld = bottomDiatonic - 2; ld >= d; ld -= 2) {
                    const ly = yForDiatonic(ld);
                    ctx.beginPath(); ctx.moveTo(lx0, ly); ctx.lineTo(lx1, ly); ctx.stroke();
                }
            }
        };

        // Draw an oval notehead, filled or hollow. Slightly italicised look via
        // rotation gives the engraved feel without a music font.
        const drawHead = (x, y, filled, dx = 0) => {
            ctx.save();
            ctx.translate(x + dx, y);
            ctx.rotate(-0.32);
            ctx.beginPath();
            ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
            if (filled) {
                ctx.fillStyle = color;
                ctx.fill();
            } else {
                ctx.lineWidth = dp(1.7);
                ctx.strokeStyle = color;
                ctx.stroke();
            }
            ctx.restore();
        };

        const drawDot = (x, y, d) => {
            // Place the augmentation dot to the right, nudged into the nearest
            // space if the note sits on a line.
            const onLine = ((topDiatonic - d) % 2) === 0;
            const dy = onLine ? -lineSpacing / 2 : 0;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x + headRx + dp(4), y + dy, dp(1.6), 0, Math.PI * 2);
            ctx.fill();
        };

        // Mobile stem-length scaling: on compact canvases (lineSpacing at/near
        // the dp(7) floor) a 3.2× stem reads as comically tall. Shorten it.
        const isCompact = lineSpacing <= dp(8);
        const STEM_FACTOR = isCompact ? 2.6 : 3.2;   // × lineSpacing
        const MIN_STEM_FACTOR = isCompact ? 2.1 : 2.5; // minimum interior stem in beams

        // ── Pass 1: build one chord-item per onset (sorted bottom→top notes),
        // render noteheads / ledgers / dots / accidentals (always — both modes).
        const chordItems = [];
        for (const [, chord] of groups) {
            const items = chord.map(({ note, midi }) => {
                const d = midiToDiatonic(midi, useFlats) + octShift;
                return {
                    note, midi, d,
                    x: xForTime(note.startTime ?? 0),
                    y: yForDiatonic(d),
                    dur: classifyDuration(note.duration ?? 1),
                };
            }).sort((a, b) => a.d - b.d); // bottom → top

            const x = items[0].x;
            const avgY = items.reduce((s, it) => s + it.y, 0) / items.length;
            const stemUp = avgY >= midLineY;
            const anyStem = items.some((it) => it.dur.stem);
            const maxFlags = items.reduce((m, it) => Math.max(m, it.dur.flags), 0);
            const topY = items[items.length - 1].y; // smallest y (highest note)
            const botY = items[0].y;                 // largest y (lowest note)

            // Chord seconds: any two ADJACENT diatonic steps (|Δd| == 1) would
            // print their oval heads on top of each other. Standard engraving
            // displaces one head to the OTHER side of the stem. With stem up the
            // UPPER note of each colliding pair moves to the RIGHT of the stem;
            // with stem down the LOWER note moves to the LEFT. We walk
            // bottom→top and, whenever the current note sits on the step right
            // next to the previous (un-displaced) one, displace it — so runs of
            // clustered seconds alternate sides cleanly.
            const headDx = new Array(items.length).fill(0);
            const offset = headRx * 1.7; // full notehead width to the other side
            for (let k = 1; k < items.length; k++) {
                if (headDx[k - 1] === 0 && Math.abs(items[k].d - items[k - 1].d) === 1) {
                    // Displace the member that belongs on the far side of the stem.
                    if (stemUp) headDx[k] = offset;       // upper note → right
                    else headDx[k - 1] = -offset;         // lower note → left
                }
            }

            // Ledger lines + noteheads + dots + per-note accidentals. Each note
            // uses its OWN duration's head style (hollow half, filled quarter+).
            for (let k = 0; k < items.length; k++) {
                const it = items[k];
                const dx = headDx[k];
                drawLedgers(x, it.d, dx);
                drawHead(x, it.y, it.dur.filled, dx);
                if (showStems && it.dur.dotted) drawDot(x + dx, it.y, it.d);
                if (isBlackKey(it.midi)) {
                    // Accidental placed AFTER (right of) the altered note,
                    // as a small SUPERSCRIPT hugging its notehead — clearly
                    // above the staff line / ledger so it never reads as
                    // sitting "between" two beamed notes.
                    ctx.fillStyle = color;
                    ctx.font = `${lineSpacing * 1.3}px "Noto Music", "Bravura", "Times New Roman", serif`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillText(useFlats ? '♭' : '♯', x + Math.max(0, dx) + headRx + dp(1), it.y - lineSpacing * 0.55);
                }
            }

            chordItems.push({
                x, stemUp, anyStem, maxFlags, topY, botY, color,
                startBeat: (items[0].note.startTime ?? 0) - measureStart,
                durationBeats: items[0].note.duration ?? 1,
            });
        }

        // ── Pass 2: stems + flags + beams (detailed mode only).
        if (!showStems) continue;

        // Beamable items: have a stem AND >= 1 flag (eighth or shorter).
        const beamable = chordItems
            .filter((ci) => ci.anyStem && ci.maxFlags >= 1)
            .sort((a, b) => a.startBeat - b.startBeat);
        const beamIndexSet = new Set();
        const groupsOfIdx = computeBeamGroups(
            beamable.map((ci) => ({
                startBeat: ci.startBeat,
                durationBeats: ci.durationBeats,
                flags: ci.maxFlags,
            })),
        );

        // Helper: draw a single (non-beamed) chord's shared stem.
        const drawStem = (ci) => {
            const stemX = ci.stemUp ? ci.x + headRx - dp(0.5) : ci.x - headRx + dp(0.5);
            const yAttach = ci.stemUp ? ci.botY - headRy : ci.topY + headRy;
            const yTip = ci.stemUp
                ? ci.topY - lineSpacing * STEM_FACTOR
                : ci.botY + lineSpacing * STEM_FACTOR;
            ctx.strokeStyle = ci.color;
            ctx.lineWidth = dp(1.5);
            ctx.beginPath();
            ctx.moveTo(stemX, yAttach);
            ctx.lineTo(stemX, yTip);
            ctx.stroke();
        };

        const drawFlags = (ci) => {
            const stemX = ci.stemUp ? ci.x + headRx - dp(0.5) : ci.x - headRx + dp(0.5);
            const yTip = ci.stemUp
                ? ci.topY - lineSpacing * STEM_FACTOR
                : ci.botY + lineSpacing * STEM_FACTOR;
            const dir = ci.stemUp ? 1 : -1;
            ctx.fillStyle = ci.color;
            for (let f = 0; f < ci.maxFlags; f++) {
                const fy = yTip + f * lineSpacing * 0.9 * dir;
                ctx.beginPath();
                ctx.moveTo(stemX, fy);
                ctx.quadraticCurveTo(
                    stemX + dp(7), fy + dir * lineSpacing * 0.5,
                    stemX + dp(5), fy + dir * lineSpacing * 1.3,
                );
                ctx.quadraticCurveTo(
                    stemX + dp(6), fy + dir * lineSpacing * 0.6,
                    stemX, fy + dir * lineSpacing * 0.35,
                );
                ctx.closePath();
                ctx.fill();
            }
        };

        // Render beamed groups; remember which chord-items they consume.
        const dominantHandColor = color; // staff color (treble=melody, bass=chords)
        for (const grp of groupsOfIdx) {
            if (grp.length < 2) continue; // singletons fall through to flag path
            const members = grp.map((idx) => beamable[idx]);
            members.forEach((m) => beamIndexSet.add(m));

            // Group stem direction: majority vote by (midY − noteY) sum.
            const vote = members.reduce((s, m) => {
                const noteY = (m.topY + m.botY) / 2;
                return s + (midLineY - noteY);
            }, 0);
            const grpStemUp = vote >= 0; // ties → up

            const dir = grpStemUp ? -1 : 1; // tip offset sign (up = above = smaller y)
            // Each member's notehead reference for the stem tip + the beam.
            const stemXOf = (m) => (grpStemUp ? m.x + headRx - dp(0.5) : m.x - headRx + dp(0.5));
            // The notehead the stem grows FROM (outermost in stem direction).
            const headYOf = (m) => (grpStemUp ? m.topY : m.botY);

            const first = members[0];
            const last = members[members.length - 1];
            let tipFirstY = headYOf(first) + dir * lineSpacing * STEM_FACTOR;
            let tipLastY = headYOf(last) + dir * lineSpacing * STEM_FACTOR;

            // Slope clamp: |Δy| ≤ 0.5·lineSpacing, move the lower-magnitude end
            // (the end whose stem from its own notehead is shorter), so the
            // taller stem stays put and the flat-ish beam doesn't dip too far.
            const maxSlope = 0.5 * lineSpacing;
            const dy = tipLastY - tipFirstY;
            if (Math.abs(dy) > maxSlope) {
                const target = Math.sign(dy) * maxSlope; // signed clamped Δ
                const lenFirst = Math.abs(tipFirstY - headYOf(first));
                const lenLast = Math.abs(tipLastY - headYOf(last));
                if (lenFirst <= lenLast) {
                    // first end is shorter → move it, keep last
                    tipFirstY = tipLastY - target;
                } else {
                    tipLastY = tipFirstY + target;
                }
            }

            const xFirst = stemXOf(first);
            const xLast = stemXOf(last);
            const beamYAt = (x) => {
                if (xLast === xFirst) return tipFirstY;
                const t = (x - xFirst) / (xLast - xFirst);
                return tipFirstY + t * (tipLastY - tipFirstY);
            };

            // Ensure every interior stem is long enough; else push beam outward.
            const minStem = lineSpacing * MIN_STEM_FACTOR;
            let guard = 0;
            for (;;) {
                let worst = 0; // most-deficient (positive = too short by this much)
                for (const m of members) {
                    const by = beamYAt(stemXOf(m));
                    const len = Math.abs(by - headYOf(m));
                    if (len < minStem) worst = Math.max(worst, minStem - len);
                }
                if (worst <= 0.01 || guard++ > 8) break;
                const shove = dir * worst; // translate both anchors outward
                tipFirstY += shove;
                tipLastY += shove;
            }

            // Recompute beam endpoints after any shove.
            const yBeamFirst = beamYAt(xFirst);
            const yBeamLast = beamYAt(xLast);

            // Draw interior stems to the beam line.
            ctx.strokeStyle = dominantHandColor;
            ctx.lineWidth = dp(1.5);
            for (const m of members) {
                const sx = stemXOf(m);
                const yAttach = grpStemUp ? m.botY - headRy : m.topY + headRy;
                ctx.beginPath();
                ctx.moveTo(sx, yAttach);
                ctx.lineTo(sx, beamYAt(sx));
                ctx.stroke();
            }

            // PRIMARY beam — filled parallelogram, thickness 0.5·lineSpacing.
            const beamTh = lineSpacing * 0.5;
            // beam thickness grows from the tip toward the noteheads (inward).
            const inward = grpStemUp ? 1 : -1; // +y is inward for up-stems
            ctx.fillStyle = dominantHandColor;
            ctx.beginPath();
            ctx.moveTo(xFirst, yBeamFirst);
            ctx.lineTo(xLast, yBeamLast);
            ctx.lineTo(xLast, yBeamLast + inward * beamTh);
            ctx.lineTo(xFirst, yBeamFirst + inward * beamTh);
            ctx.closePath();
            ctx.fill();

            // SECONDARY beams (sixteenths): parallel beam 0.75·lineSpacing inward,
            // spanning adjacent runs where BOTH items have flags >= 2; isolated
            // sixteenths get a short stub toward their nearest neighbour.
            const secOff = inward * lineSpacing * 0.75;
            const secY = (x) => beamYAt(x) + secOff;
            const drawSecSeg = (xa, xb) => {
                ctx.beginPath();
                ctx.moveTo(xa, secY(xa));
                ctx.lineTo(xb, secY(xb));
                ctx.lineTo(xb, secY(xb) + inward * beamTh);
                ctx.lineTo(xa, secY(xa) + inward * beamTh);
                ctx.closePath();
                ctx.fill();
            };
            const stubLen = lineSpacing * 0.6;
            for (let k = 0; k < members.length; k++) {
                if (members[k].maxFlags < 2) continue;
                const prevSx = k > 0 && members[k - 1].maxFlags >= 2 ? stemXOf(members[k - 1]) : null;
                const nextSx = k < members.length - 1 && members[k + 1].maxFlags >= 2
                    ? stemXOf(members[k + 1]) : null;
                const sx = stemXOf(members[k]);
                if (nextSx != null) {
                    drawSecSeg(sx, nextSx); // run handled left-to-right
                } else if (prevSx == null) {
                    // isolated sixteenth → stub toward nearest neighbour
                    const leftN = k > 0 ? stemXOf(members[k - 1]) : null;
                    const rightN = k < members.length - 1 ? stemXOf(members[k + 1]) : null;
                    let toward = 1;
                    if (leftN != null && rightN != null) {
                        toward = (sx - leftN) <= (rightN - sx) ? -1 : 1;
                    } else if (leftN != null) toward = -1;
                    const xb = sx + toward * stubLen;
                    drawSecSeg(Math.min(sx, xb), Math.max(sx, xb));
                }
                // if prevSx != null and nextSx == null, the run was closed by the
                // previous iteration's drawSecSeg(prev, this) — nothing to add.
            }
        }

        // Non-beamed chords: single shared stem + (if applicable) flags.
        for (const ci of chordItems) {
            if (!ci.anyStem) continue;
            if (beamIndexSet.has(ci)) continue; // already beamed
            drawStem(ci);
            if (ci.maxFlags > 0) drawFlags(ci);
        }
    }

    // Right bar line
    const barMargin = dp(4);
    ctx.strokeStyle = T.bar;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w - 1, stavesOriginY + barMargin);
    ctx.lineTo(w - 1, stavesOriginY + totalStavesH - barMargin);
    ctx.stroke();

    // Playhead — when provided, drawn inside the note area so it aligns
    // exactly with note X positions (skipping clef + key signature on
    // measures that have them).
    if (opts.playheadFrac != null) {
        const playheadFrac = Math.max(0, Math.min(1, opts.playheadFrac));
        const leftPad = barPad + dotR * 2;
        const noteAreaStart = headerW + leftPad;
        const noteAreaEnd = w - barPad - dotR;
        const playX = noteAreaStart + playheadFrac * (noteAreaEnd - noteAreaStart);
        const top = stavesOriginY + barMargin;
        const bottom = stavesOriginY + totalStavesH - barMargin;
        // Soft halo
        ctx.fillStyle = T.accent;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(playX - dp(8), top, dp(16), bottom - top);
        // Sharp line
        ctx.globalAlpha = 0.9;
        ctx.fillRect(playX - 1, top, 2, bottom - top);
        ctx.globalAlpha = 1;
    }
}
