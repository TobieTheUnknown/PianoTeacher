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

// ─── Color palette (matches Theme.kt indigo/cyan/pink defaults) ──────────────

export const COLOR_MELODY = '#22D3EE';      // CyanMelody — right hand (treble)
export const COLOR_CHORDS = '#EC4899';      // PinkChords — left hand (bass)
export const COLOR_PLAYING = '#6366F1';     // IndigoAccent — currently playing
export const COLOR_STAFF_LINE = 'rgba(255, 255, 255, 0.32)';
export const COLOR_STAFF_LINE_KEY = (handColor) => handColor; // key line uses hand color
export const COLOR_LEDGER = 'rgba(255, 255, 255, 0.5)';
export const COLOR_CLEF = 'rgba(255, 255, 255, 0.35)';
export const COLOR_KEYSIG = 'rgba(255, 255, 255, 0.6)';
export const COLOR_BRACKET = 'rgba(255, 255, 255, 0.35)';
export const COLOR_BAR = 'rgba(255, 255, 255, 0.28)';
export const COLOR_MEASURE_NUM = '#64748B';
export const COLOR_NOTE_ALPHA = 0.72;       // applied to melody/chord note color

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
    anchorFrac: 0.20,
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
    for (let m = 0; m < length; m++) {
        const measureStart = m * beatsPerMeasure;
        const melody = (phrase.tracks?.melody || []).filter((n) => {
            const t = n.startTime ?? 0;
            return t >= measureStart && t < measureStart + beatsPerMeasure;
        });
        const chords = (phrase.tracks?.chords || []).filter((n) => {
            const t = n.startTime ?? 0;
            return t >= measureStart && t < measureStart + beatsPerMeasure;
        });
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
    } = opts;

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
    const staffH       = Math.min(totalAvail / 2.5, staffHMax);
    const lineSpacing  = staffH / 4;
    const gap          = lineSpacing * 2; // exactly 2 line spacings — middle C falls between staves
    const totalStavesH = staffH * 2 + gap;
    const stavesOriginY = topPad + (totalAvail - totalStavesH) / 2;

    const showKeySig = showClefs && clefMode !== 'AUTO';
    const numAccidentals = showKeySig ? keySignatureAccidentalCount(keySig) : 0;
    const ksW = numAccidentals > 0 ? numAccidentals * dp(7) + dp(4) : 0;
    const clefW = showClefs ? Math.max(staffH * 0.26, dp(22)) + ksW : 0;
    const pureClefW = clefW - ksW;
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
    ctx.fillStyle = isPlaying ? COLOR_PLAYING : COLOR_MEASURE_NUM;
    ctx.font = `${isPlaying ? '700 ' : '400 '}${dp(13)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${measureNumber}`, w / 2, dp(4));

    // Left bracket
    const bracketX = isLandscape ? 0 : dp(1);
    ctx.strokeStyle = COLOR_BRACKET;
    ctx.lineWidth = dp(3);
    ctx.beginPath();
    ctx.moveTo(bracketX, stavesOriginY);
    ctx.lineTo(bracketX, stavesOriginY + totalStavesH);
    ctx.stroke();

    // Draw both staves
    const staffTops = [stavesOriginY, stavesOriginY + staffH + gap];
    const staffClefs = [upperClef, lowerClef];
    const staffNotes = [
        upperNotes.map(n => ({ note: n, color: COLOR_MELODY })),
        lowerNotes.map(n => ({ note: n, color: COLOR_CHORDS })),
    ];
    const staffShifts = [upperOctaveShift, lowerOctaveShift];

    for (let si = 0; si < 2; si++) {
        const clef = staffClefs[si];
        const lineTop = staffTops[si];
        const topDiatonic = clef.lines[clef.lines.length - 1];
        const bottomDiatonic = clef.lines[0];

        // Staff lines (5)
        for (let li = 0; li <= 4; li++) {
            const y = lineTop + li * lineSpacing;
            const lineDiatonic = clef.lines[4 - li];
            const isKey = lineDiatonic === clef.keyDiatonic;
            if (isKey) {
                ctx.strokeStyle = si === 0 ? COLOR_MELODY : COLOR_CHORDS;
                ctx.globalAlpha = COLOR_NOTE_ALPHA;
                ctx.lineWidth = dp(1.6);
            } else {
                ctx.strokeStyle = COLOR_STAFF_LINE;
                ctx.globalAlpha = 1;
                ctx.lineWidth = dp(1.2);
            }
            ctx.beginPath();
            ctx.moveTo(bracketX + dp(2), y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Clef glyph
        if (showClefs) {
            const clefFontPx = staffH * clef.fontScale;
            ctx.fillStyle = COLOR_CLEF;
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
                ctx.fillStyle = COLOR_KEYSIG;
                ctx.font = `700 ${lineSpacing * 0.9}px system-ui, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                for (let i = 0; i < numAccidentals; i++) {
                    const d = positions[i];
                    const ax = pureClefW + dp(2) + i * dp(7);
                    const ay = lineTop + (topDiatonic - d) * (lineSpacing / 2);
                    ctx.fillText(accLabel, ax, ay);
                }
            }
        }

        // Octave shift label
        const octShift = staffShifts[si];
        if (showClefs && octShift !== 0) {
            const lbl = octaveShiftLabel(octShift);
            if (lbl) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.font = `700 ${dp(9)}px system-ui, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                const labelY = octShift > 0
                    ? lineTop + 4 * lineSpacing + dp(3)
                    : lineTop - dp(9) - dp(2);
                ctx.fillText(lbl, dp(2), labelY);
            }
        }

        // Notes
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        for (const { note, color } of staffNotes[si]) {
            const midi = normalizePitch(note.pitch);
            if (midi == null) continue;
            const d = midiToDiatonic(midi, useFlats) + octShift;
            const frac = Math.max(0, Math.min(1,
                ((note.startTime - measureStart) / beatsPerMeasure)
            ));
            const leftPad = barPad + dotR * 2;
            const noteAreaStart = clefW + leftPad;
            const noteAreaEnd = w - barPad - dotR;
            const x = noteAreaStart + frac * (noteAreaEnd - noteAreaStart);
            const y = lineTop + (topDiatonic - d) * (lineSpacing / 2);

            // Note head
            ctx.globalAlpha = COLOR_NOTE_ALPHA;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Ledger lines above
            if (d > topDiatonic + 1) {
                ctx.strokeStyle = COLOR_LEDGER;
                ctx.lineWidth = 0.9;
                for (let ld = topDiatonic + 2; ld <= d; ld += 2) {
                    const ly = lineTop + (topDiatonic - ld) * (lineSpacing / 2);
                    ctx.beginPath();
                    ctx.moveTo(x - dotR * 1.5, ly);
                    ctx.lineTo(x + dotR * 1.5, ly);
                    ctx.stroke();
                }
            }
            // Ledger lines below
            if (d < bottomDiatonic - 1) {
                ctx.strokeStyle = COLOR_LEDGER;
                ctx.lineWidth = 0.9;
                for (let ld = bottomDiatonic - 2; ld >= d; ld -= 2) {
                    const ly = lineTop + (topDiatonic - ld) * (lineSpacing / 2);
                    ctx.beginPath();
                    ctx.moveTo(x - dotR * 1.5, ly);
                    ctx.lineTo(x + dotR * 1.5, ly);
                    ctx.stroke();
                }
            }

            // Accidental (#/b) for black keys
            if (isBlackKey(midi)) {
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.95;
                ctx.font = `700 ${dp(9)}px system-ui, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                const label = useFlats ? 'b' : '#';
                ctx.fillText(label, x + dotR * 1.3, y - dotR);
                ctx.globalAlpha = 1;
            }
        }
    }

    // Right bar line
    const barMargin = dp(4);
    ctx.strokeStyle = COLOR_BAR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w - 1, stavesOriginY + barMargin);
    ctx.lineTo(w - 1, stavesOriginY + totalStavesH - barMargin);
    ctx.stroke();
}
