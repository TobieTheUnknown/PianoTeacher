import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { getFrenchNoteName, getFrenchKeyName, getNoteNameFromMidi } from '../models/song';
import {
    detectArpeggioMotifs, qualifyArpeggioMeasure,
    qualifyOstinatoMeasure, qualifyPedalMeasure, getMeasureHarmony,
} from '../utils/chordDetection';
import { getMeasuresFromPhrase, groupNotesByTime } from '../utils/measureUtils';
import { audioEngine } from '../services/AudioEngine';
import { useDeviceContext } from '../hooks/useDeviceContext';
import { CoordinationTimeline } from './learn/CoordinationTimeline';
import { PlaybackDock } from './PlaybackDock';
import { MobileHeader } from './MobileHeader';
import { LearnSidebar } from './learn/LearnSidebar';

// ── Constant styles extracted outside render ──────────────────────────────────

const STYLES = {
    tipCard: {
        display: 'flex',
        gap: '0.75rem',
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
    },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const TimelineBar = React.memo(function TimelineBar({ measure, displayNoteName, keySignature }) {
    return (
        <div style={{
            marginTop: '0.5rem',
            height: '20px',
            position: 'relative',
        }}>
            {/* MD dots above the bar */}
            {measure.melody.map(n => (
                <div key={`md-${n.id}`} style={{
                    position: 'absolute',
                    left: `${((n.startTime % 4) / 4) * 100}%`,
                    top: '0px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--hand-right)',
                }} title={`MD: ${displayNoteName(n.pitch, keySignature)}`} />
            ))}
            {/* Grey bar in the middle */}
            <div style={{
                position: 'absolute',
                top: '9px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: 'var(--border-medium)',
                borderRadius: '1px',
            }} />
            {/* MG dots below the bar */}
            {measure.chords.map(n => (
                <div key={`mg-${n.id}`} style={{
                    position: 'absolute',
                    left: `${((n.startTime % 4) / 4) * 100}%`,
                    bottom: '0px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--hand-left)',
                }} title={`MG: ${displayNoteName(n.pitch, keySignature)}`} />
            ))}
        </div>
    );
});


// Hand → theme-token trio (fill / border / text).
function handTokens(hand) {
    return hand === 'right'
        ? { bg: 'var(--hand-right-dim)', border: 'var(--hand-right-border)', fg: 'var(--hand-right)' }
        : { bg: 'var(--hand-left-dim)', border: 'var(--hand-left-border)', fg: 'var(--hand-left)' };
}

const ROLE_BADGE_STYLE = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 8,
    // Dense enough that "Ostinato Fa·Sib·La ×2" fits a 4-column card
    // without ellipsizing.
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.01em',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
};

// Repeating-wave glyph — reads as "ostinato" (a motif looping).
function OstinatoGlyph() {
    return (
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden
            style={{ flexShrink: 0 }}>
            <path d="M1 7 Q3 3 5 7 T9 7 T13 7" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" fill="none" />
            <path d="M1 10 Q3 6 5 10 T9 10 T13 10" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" fill="none" opacity="0.5" />
        </svg>
    );
}

const OstinatoBadge = React.memo(function OstinatoBadge({ ostInfo, hand = 'left' }) {
    // Unified badge for both chord-reducible arpeggios and literal motif ostinatos.
    // ostInfo shape:
    //   { kind: 'chord', label: 'Do', reps: 1, altered: false, alteredNoteName: null }
    //   { kind: 'motif', motifLabels: ['Fa','Sib','La'], repetitions: 2 }
    const t = handTokens(hand);

    let displayLabel, titleText, repsEl;

    if (ostInfo.kind === 'chord') {
        displayLabel = ostInfo.label; // icon conveys "ostinato"; tooltip carries the word
        const altMention = ostInfo.altered
            ? `${ostInfo.alteredNoteName ? ` — altération : ${ostInfo.alteredNoteName}` : ' — accord altéré/incomplet'}`
            : '';
        titleText = `Ostinato — accord ${ostInfo.label} égrené (arpège)${altMention}`;
        // ×N only when the exact ordered cycle repeats
        repsEl = ostInfo.reps > 1
            ? <span style={{ fontSize: '0.78em', opacity: 0.8, flexShrink: 0 }}>×{ostInfo.reps}</span>
            : null;
    } else {
        // kind === 'motif'
        const notes = ostInfo.motifLabels.join('·');
        displayLabel = notes; // icon conveys "ostinato"; tooltip carries the word
        titleText = `Ostinato — motif répété ${ostInfo.repetitions}× (${notes})`;
        repsEl = ostInfo.repetitions > 1
            ? <span style={{ fontSize: '0.78em', opacity: 0.8, flexShrink: 0 }}>×{ostInfo.repetitions}</span>
            : null;
    }

    return (
        <span
            title={titleText}
            style={{
                ...ROLE_BADGE_STYLE,
                background: t.bg, border: `2px solid ${t.border}`, color: t.fg,
                maxWidth: '100%', minWidth: 0,
            }}
        >
            <OstinatoGlyph />
            <span style={{
                minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {displayLabel}
            </span>
            {repsEl}
        </span>
    );
});

// Sustained-line glyph for a pédale (a single long held tone).
function PedalGlyph() {
    return (
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden
            style={{ flexShrink: 0 }}>
            <circle cx="3" cy="6" r="2" fill="currentColor" />
            <path d="M5 6 L15 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

const PedalBadge = React.memo(function PedalBadge({ pedal, hand = 'left' }) {
    // Icon conveys "pédale"; tooltip carries the word. Badge text: note label only.
    const t = handTokens(hand);
    return (
        <span
            title={pedal.octave ? 'Pédale jouée en octave (8va)' : 'Pédale — note tenue / répétée'}
            style={{ ...ROLE_BADGE_STYLE, background: t.bg, border: `2px solid ${t.border}`, color: t.fg }}
        >
            <PedalGlyph />
            {pedal.label}{pedal.octave ? ' · 8va' : ''}
        </span>
    );
});

// Combined-harmony badge — belongs to BOTH hands, so it is NEUTRAL (no hand
// color). Sits top-right next to the measure number. "SIB Maj7/Ré · VI".
// Watermark style: the harmony lives at the very top-right of the card as a
// discreet semi-transparent label (no border/box) — it reads as part of the
// card's background, never pushes the layout.
const HarmonyBadge = React.memo(function HarmonyBadge({ harmony, keySignature }) {
    if (!harmony) return null;
    const keyName = keySignature
        ? `${keySignature.note} ${keySignature.mode === 'minor' ? 'mineur' : 'majeur'}`
        : '';
    const text = harmony.degree ? `${harmony.label} · ${harmony.degree}` : harmony.label;
    return (
        <span
            title={`Harmonie de la mesure${keyName ? ` (${keyName})` : ''}${harmony.altered ? ' — accord altéré/incomplet' : ''}`}
            style={{
                position: 'absolute',
                top: 7, right: 10,
                maxWidth: '68%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em',
                color: 'var(--text-secondary)',
                opacity: 0.55,
                pointerEvents: 'auto',
                zIndex: 1,
            }}
        >{text}</span>
    );
});

// ── MotifRows ────────────────────────────────────────────────────────────────
// Détails ON for an ostinato hand: the note pills are grouped by MOTIF
// occurrence — one row per repetition (the last row may be the truncated
// prefix). "do ré mi fa do ré mi fa" → two rows of "do ré mi fa".
function MotifRows({ labels, motifLen, hand, isMobile }) {
    const rows = [];
    for (let i = 0; i < labels.length; i += motifLen) {
        rows.push(labels.slice(i, i + motifLen));
    }
    const pillStyle = {
        fontSize: isMobile ? 8.5 : 9.5, fontWeight: 600,
        padding: isMobile ? '1px 4px' : '2px 5px',
        borderRadius: 4,
        background: `var(--hand-${hand}-dim)`,
        color: `var(--hand-${hand})`,
        border: `1px solid var(--hand-${hand}-border)`,
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 3, minHeight: 18 }}>
            {rows.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 2 : 3 }}>
                    {row.map((n, i) => (
                        <span key={i} style={pillStyle}>{n}</span>
                    ))}
                </div>
            ))}
        </div>
    );
}

// Renders the resolved per-hand role badge (arpège / ostinato / pédale),
// or null when the hand has no special role (fallback handled by caller).
function HandRoleBadge({ role, hand }) {
    if (!role) return null;
    // Unified concept (user decision): every badged figure repeats across
    // ≥2 measures, so it IS an ostinato — "arpège" survives in the tooltip.
    if (role.kind === 'arpeggio') {
        return (
            <OstinatoBadge
                ostInfo={{
                    kind: 'chord',
                    label: role.badge.bareLabel ?? role.badge.label,
                    reps: role.badge.reps || 1,
                    altered: role.badge.altered,
                    alteredNoteName: role.badge.alteredNoteName,
                }}
                hand={hand}
            />
        );
    }
    if (role.kind === 'ostinato') {
        return (
            <OstinatoBadge
                ostInfo={{
                    kind: 'motif',
                    motifLabels: role.ostinato.motifLabels,
                    repetitions: role.ostinato.repetitions,
                }}
                hand={hand}
            />
        );
    }
    if (role.kind === 'pedal') return <PedalBadge pedal={role.pedal} hand={hand} />;
    return null;
}

// ── ArpeggioNotePills ────────────────────────────────────────────────────────
// The small, neutral outlined chips listed BELOW the arpeggio badge. They
// spell out the left-hand note sequence in played order. They are deliberately
// NOT hand-colored — they sit under an already-colored badge. When the exact
// motif repeats (motifInfo.exactCycle && repetitions > 1) we show only ONE
// cycle's notes (the ×N on the badge already says it repeats); otherwise we
// show the full sequence, capped with an ellipsis pill.

const ARP_PILL_CAP = 12;

function ArpeggioNotePills({ measure, displayNoteName, keySignature }) {
    const groups = measure.chordGroups || [];
    const motif = measure.motifInfo;

    let visibleCount = groups.length;
    if (motif?.exactCycle && motif.repetitions > 1 && motif.notesPerCycle) {
        visibleCount = motif.notesPerCycle;
    }

    const truncated = visibleCount > ARP_PILL_CAP;
    const shown = groups.slice(0, Math.min(visibleCount, ARP_PILL_CAP));

    if (shown.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, minHeight: 18 }}>
            {shown.map((g, i) => (
                <span key={`arp${i}`} style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 5,
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-strong)',
                    whiteSpace: 'nowrap',
                }}>
                    {displayNoteName(g.notes[0].pitch, keySignature)}
                </span>
            ))}
            {truncated && (
                <span style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 5,
                    color: 'var(--text-tertiary)',
                    border: '1px solid var(--border-strong)',
                }}>…</span>
            )}
        </div>
    );
}

// ── MeasureCard (memoized) — compact design-aligned card ─────────────────────

const MeasureCard = React.memo(function MeasureCard({
    measure, keySignature, isHighlighted, onToggleHighlight, onPlay,
    showDetails, displayNoteName,
    isMobile,
    isCurrent = false, isPlaying = false,
    // Real measure duration in seconds. Drives the beat-fill animation so
    // the progress bar lines up with audio (start of fill = start of
    // measure, end of fill = end of measure). Falls back to 1.6s.
    measureDurationSec = 1.6,
}) {
    // Pre-sorted melody (stable reference from getMeasuresFromPhrase)
    const sortedMelody = measure.sortedMelody;

    // Highlighted == manually starred (border accent), current == playback target
    const accentBorder = isCurrent || isHighlighted;

    const cardStyle = {
        position: 'relative',
        background: accentBorder ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `1.5px solid ${accentBorder ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '10px 11px',
        textAlign: 'left',
        transition: 'all var(--t-med)',
        boxShadow: accentBorder
            ? `0 0 0 3px var(--accent-dim), 0 4px 14px -4px var(--accent-dim)`
            : 'none',
        overflow: 'hidden',
        cursor: 'pointer',
        minHeight: 'auto',
    };

    // Notes are stored in "4 units per measure" convention. beatsPerMeasure
    // is purely visual (time signature numerator → division-line count).
    const beatsPerMeasure = measure.beatsPerMeasure || 4;
    const unitsPerMeasure = measure.unitsPerMeasure || 4;
    const measureStartUnits = (measure.number - 1) * unitsPerMeasure;
    const rightTimes = sortedMelody.map(n => Math.max(0, Math.min(1,
        ((n.startTime ?? 0) - measureStartUnits) / unitsPerMeasure
    )));
    const leftTimes = (measure.chordGroups || []).map(g => {
        const t = g.notes?.[0]?.startTime ?? 0;
        return Math.max(0, Math.min(1, (t - measureStartUnits) / unitsPerMeasure));
    });

    // Pitch labels in playback order — keep duplicates so a run like
    // "la si do la" shows all four notes, not three.
    const rightLabels = sortedMelody
        .slice(0, isMobile ? 8 : 12)
        .map(n => displayNoteName(n.pitch, keySignature));
    const leftLabels = [...(measure.chords || [])]
        .sort((a, b) => a.startTime - b.startTime)
        .slice(0, isMobile ? 8 : 12)
        .map(n => displayNoteName(n.pitch, keySignature));

    return (
        <div onClick={() => onPlay(measure, 'both')} style={cardStyle}>
            {/* Animated playing bar at top */}
            {isCurrent && isPlaying && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                    backgroundSize: '200% 100%',
                    animation: `design-playbarSlide ${measureDurationSec}s linear infinite`,
                }} />
            )}

            {/* Combined-harmony watermark — absolute at the card's very
                top-right, carries the harmonic degree exclusively. */}
            <HarmonyBadge harmony={measure.harmony} keySignature={keySignature} />

            {/* Top row: measure number. */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 6, marginBottom: 7,
            }}>
                <div
                    onClick={(e) => { e.stopPropagation(); onToggleHighlight(measure.number); }}
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11, fontWeight: 700,
                        color: accentBorder ? 'var(--accent)' : 'var(--text-tertiary)',
                        letterSpacing: '0.04em',
                        cursor: 'pointer',
                    }}
                    title="Surligner cette mesure"
                >
                    {String(measure.number).padStart(2, '0')}
                </div>
            </div>

            {/* Right hand.
                Détails OFF + a role (arpège/ostinato/pédale) → role badge only.
                Détails ON  + a role → badge on top, then grouped note rows.
                Otherwise → melody pills (a real melody IS the lesson). */}
            {(!showDetails && measure.rightRole) ? (
                <div style={{ marginBottom: 5, minHeight: 18, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <HandRoleBadge role={measure.rightRole} hand="right" />
                </div>
            ) : (showDetails && measure.rightRole && measure.rightOstinato && rightLabels.length > 0) ? (
                <div style={{ marginBottom: 5 }}>
                    <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <HandRoleBadge role={measure.rightRole} hand="right" />
                    </div>
                    <MotifRows
                        labels={rightLabels}
                        motifLen={measure.rightOstinato.motifPcs.length}
                        hand="right"
                        isMobile={isMobile}
                    />
                </div>
            ) : (showDetails && measure.rightOstinato && rightLabels.length > 0) ? (
                <div style={{ marginBottom: 5 }}>
                    <MotifRows
                        labels={rightLabels}
                        motifLen={measure.rightOstinato.motifPcs.length}
                        hand="right"
                        isMobile={isMobile}
                    />
                </div>
            ) : rightLabels.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 2 : 3, marginBottom: 5, minHeight: 18 }}>
                    {rightLabels.map((n, i) => (
                        <span key={`r${i}`} style={{
                            fontSize: isMobile ? 8.5 : 9.5, fontWeight: 600,
                            padding: isMobile ? '1px 4px' : '2px 5px',
                            borderRadius: 4,
                            background: 'var(--hand-right-dim)',
                            color: 'var(--hand-right)',
                            border: '1px solid var(--hand-right-border)',
                        }}>{n}</span>
                    ))}
                </div>
            ) : <div style={{ marginBottom: 5, minHeight: 18 }} />}

            {/* Left hand.
                Détails OFF + a role (arpège/ostinato/pédale) → role badge only.
                Détails OFF + no role + notes → up to 4 note pills + "…".
                Détails ON  + a role → badge on top, then grouped note rows.
                Détails ON  + no role → full raw note pills. */}
            {!showDetails ? (
                measure.leftRole ? (
                    <div style={{ minHeight: 18, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <HandRoleBadge role={measure.leftRole} hand="left" />
                    </div>
                ) : leftLabels.length > 0 ? (
                    <div style={{ minHeight: 18, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                        {leftLabels.slice(0, 4).map((n, i) => (
                            <span key={`lf${i}`} style={{
                                fontSize: 9.5, fontWeight: 600,
                                padding: '2px 5px',
                                borderRadius: 4,
                                background: 'var(--hand-left-dim)',
                                color: 'var(--hand-left)',
                                border: '1px solid var(--hand-left-border)',
                            }}>{n}</span>
                        ))}
                        {leftLabels.length > 4 && (
                            <span style={{
                                fontSize: 9.5, fontWeight: 600,
                                padding: '2px 5px',
                                borderRadius: 4,
                                color: 'var(--text-tertiary)',
                                border: '1px solid var(--hand-left-border)',
                            }}>…</span>
                        )}
                    </div>
                ) : <div style={{ minHeight: 18 }} />
            ) : (measure.leftRole && measure.leftOstinato && leftLabels.length > 0) ? (
                <div>
                    <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <HandRoleBadge role={measure.leftRole} hand="left" />
                    </div>
                    <MotifRows
                        labels={leftLabels}
                        motifLen={measure.leftOstinato.motifPcs.length}
                        hand="left"
                        isMobile={isMobile}
                    />
                </div>
            ) : (measure.leftRole && measure.arpeggioBadge && measure.motifInfo?.notesPerCycle && leftLabels.length > 0) ? (
                <div>
                    <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <HandRoleBadge role={measure.leftRole} hand="left" />
                    </div>
                    <MotifRows
                        labels={leftLabels}
                        motifLen={measure.motifInfo.notesPerCycle}
                        hand="left"
                        isMobile={isMobile}
                    />
                </div>
            ) : (measure.leftOstinato && leftLabels.length > 0) ? (
                <MotifRows
                    labels={leftLabels}
                    motifLen={measure.leftOstinato.motifPcs.length}
                    hand="left"
                    isMobile={isMobile}
                />
            ) : (measure.arpeggioBadge && measure.motifInfo?.notesPerCycle && leftLabels.length > 0) ? (
                <MotifRows
                    labels={leftLabels}
                    motifLen={measure.motifInfo.notesPerCycle}
                    hand="left"
                    isMobile={isMobile}
                />
            ) : leftLabels.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 2 : 3, minHeight: 18 }}>
                    {leftLabels.map((n, i) => (
                        <span key={`l${i}`} style={{
                            fontSize: isMobile ? 8.5 : 9.5, fontWeight: 600,
                            padding: isMobile ? '1px 4px' : '2px 5px',
                            borderRadius: 4,
                            background: 'var(--hand-left-dim)',
                            color: 'var(--hand-left)',
                            border: '1px solid var(--hand-left-border)',
                        }}>{n}</span>
                    ))}
                </div>
            ) : <div style={{ minHeight: 18 }} />}

            {/* Beat timeline with rhythm dots */}
            <div style={{ marginTop: 10, height: 14, position: 'relative' }}>
                {/* Track line */}
                <div style={{
                    position: 'absolute', left: 0, right: 0, top: '50%',
                    transform: 'translateY(-50%)',
                    height: 3,
                    background: 'var(--surface-3)',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}>
                    {Array.from({ length: beatsPerMeasure - 1 }, (_, i) => (i + 1) / beatsPerMeasure).map((p, i) => (
                        <div key={i} style={{
                            position: 'absolute', left: `${p * 100}%`, top: 0, bottom: 0, width: 1,
                            background: 'var(--border-strong)',
                        }} />
                    ))}
                    {isCurrent && isPlaying && (
                        <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            background: 'var(--accent)',
                            borderRadius: 2,
                            animation: `design-beatFill ${measureDurationSec}s linear infinite`,
                        }} />
                    )}
                </div>
                {rightTimes.map((t, i) => (
                    <div key={`rt${i}`} style={{
                        position: 'absolute', left: `${t * 100}%`, top: 0,
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--hand-right)',
                        border: '1.5px solid var(--surface-1)',
                        transform: 'translateX(-50%)',
                    }} />
                ))}
                {leftTimes.map((t, i) => (
                    <div key={`lt${i}`} style={{
                        position: 'absolute', left: `${t * 100}%`, bottom: 0,
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--hand-left)',
                        border: '1.5px solid var(--surface-1)',
                        transform: 'translateX(-50%)',
                    }} />
                ))}
            </div>

        </div>
    );
});

// ── TipCard (memoized) ────────────────────────────────────────────────────────

const TipCard = React.memo(function TipCard({ icon, text }) {
    return (
        <div style={STYLES.tipCard}>
            <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            <span style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{text}</span>
        </div>
    );
});

// Small toggle pill for header right-area actions (Oct, Détails)
function SmallToggleBtn({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 'var(--r-pill)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                minHeight: 0,
                transition: 'all var(--t-fast)',
            }}
        >
            {label}
        </button>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LiveLearning({ song, onToggleHighlight }) {
    const { isMobile } = useDeviceContext();
    const [showDetails, setShowDetails] = useState(false);
    const [showOctaves, setShowOctaves] = useState(false);
    const [focusedMeasure, setFocusedMeasure] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackHand, setPlaybackHand] = useState('both');
    const [currentBPM, setCurrentBPM] = useState(song?.tempo || 120);
    const [isLooping, setIsLooping] = useState(false);
    const [selectedPhraseIndex, setSelectedPhraseIndex] = useState('');
    const [loopConfig, setLoopConfig] = useState(null);
    const [playingMeasure, setPlayingMeasure] = useState(-1);
    const [isMetronomeOn, setIsMetronomeOn] = useState(false);
    const [metronomeSubdivision, setMetronomeSubdivision] = useState('quarter');
    const [loopEditorOpen, setLoopEditorOpen] = useState(false);
    const measureRefs = useRef({});
    const playbackIntervalRef = useRef(null);
    const playingMeasureRef = useRef(-1);


    // Reset BPM when song changes — intentional sync from prop, not a cascade
    useEffect(() => {
        /* eslint-disable-next-line react-hooks/set-state-in-effect */
        if (song?.tempo) setCurrentBPM(song.tempo);
    }, [song?.tempo]);

    // Analyze and structure the song data
    const analysis = useMemo(() => {
        if (!song || !song.phrases || song.phrases.length === 0) {
            return null;
        }

        const measures = [];
        const allNotes = new Set();
        const phraseBreaks = [];
        const beatsPerMeasure = song.timeSignature?.numerator || 4;

        const getRawNoteName = (pitch) => {
            const name = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;
            return name ? name.slice(0, -1) : '';
        };

        // Pitch → MIDI number (notes may store pitch as a number or a name).
        const toMidi = (pitch) => {
            if (typeof pitch === 'number') return pitch;
            if (typeof pitch !== 'string') return null;
            const m = pitch.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
            if (!m) return null;
            const off = {
                C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
                'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
            };
            const key = m[1][0].toUpperCase() + (m[1][1] || '');
            if (off[key] === undefined) return null;
            return 12 + parseInt(m[2], 10) * 12 + off[key];
        };

        song.phrases.forEach((phrase, phraseIndex) => {
            if (phraseIndex > 0) {
                phraseBreaks.push({
                    measureIndex: measures.length,
                    phraseName: phrase.name
                });
            }

            const phraseMeasures = getMeasuresFromPhrase(phrase, beatsPerMeasure);

            phraseMeasures.forEach(measure => {
                measure.melody.forEach(n => allNotes.add(getRawNoteName(n.pitch)));
                measure.chords.forEach(n => allNotes.add(getRawNoteName(n.pitch)));

                const chordGroups = groupNotesByTime(measure.chords);
                const melodyGroups = groupNotesByTime(measure.melody);
                const isArpeggio = chordGroups.length >= 2 && chordGroups.every(g => g.notes.length === 1);
                const motifInfo = isArpeggio ? detectArpeggioMotifs(chordGroups, song.key) : null;
                const detectedChord = motifInfo ? motifInfo.chord : null;

                const unitsPerMeasure = measure.unitsPerMeasure || 4;

                // Measure-level arpeggio qualifier (regular rhythm + all
                // pitch classes form exactly one chord). This is a superset
                // of the clean-cycle motif logic — it also catches irregular
                // patterns like Departure's do-mib-sol-mib… that have no
                // homogeneous cycle. Activation (badge) is decided AFTER all
                // measures exist, by the consecutive-measures pass below.
                const arpeggioMeasure = qualifyArpeggioMeasure(chordGroups, song.key);

                // Per-hand role qualifiers. Arpège + ostinato need the
                // consecutive-measures run rule (decided below); pédale does
                // not. We pre-compute the candidates per hand here.
                const leftOstinato = qualifyOstinatoMeasure(chordGroups, song.key);
                const rightOstinato = qualifyOstinatoMeasure(melodyGroups, song.key);
                const rightArpeggio = qualifyArpeggioMeasure(melodyGroups, song.key);
                const leftPedal = qualifyPedalMeasure(chordGroups, unitsPerMeasure, song.key);
                const rightPedal = qualifyPedalMeasure(melodyGroups, unitsPerMeasure, song.key);

                // Combined harmony across BOTH hands.
                const allPitches = [...measure.melody, ...measure.chords]
                    .map(n => toMidi(n.pitch))
                    .filter(p => p !== null);
                const harmony = getMeasureHarmony(allPitches, song.key);

                measures.push({
                    number: measures.length + 1,
                    chordGroups,
                    melodyGroups,
                    melodyCount: measure.melody.length,
                    hasChord: chordGroups.length > 0,
                    melody: measure.melody,
                    sortedMelody: [...measure.melody].sort((a, b) => a.startTime - b.startTime),
                    chords: measure.chords,
                    beatsPerMeasure: measure.beatsPerMeasure || beatsPerMeasure,
                    unitsPerMeasure,
                    isArpeggio,
                    detectedChord,
                    motifInfo,
                    arpeggioMeasure,
                    harmony,
                    // Per-hand role candidates (run-rule applied in the pass below).
                    leftOstinato, rightOstinato, rightArpeggio, leftPedal, rightPedal,
                    // Filled in by the consecutive-measures pass below.
                    arpeggioBadge: null,
                    leftRole: null,
                    rightRole: null,
                });
            });
        });

        // ── Consecutive-measures arpeggio trigger ──────────────────────────
        // The arpeggio badge only activates across a RUN of ≥2 consecutive
        // qualifying measures. Chords may differ between measures (m1 = do m,
        // m2 = fa m/do still counts); each measure then shows its OWN badge.
        let runStart = 0;
        while (runStart < measures.length) {
            if (!measures[runStart].arpeggioMeasure) { runStart++; continue; }
            let runEnd = runStart;
            while (runEnd + 1 < measures.length && measures[runEnd + 1].arpeggioMeasure) {
                runEnd++;
            }
            if (runEnd - runStart + 1 >= 2) {
                for (let i = runStart; i <= runEnd; i++) {
                    const m = measures[i];
                    const aq = m.arpeggioMeasure;
                    // Append ×N only when the existing clean-cycle motif logic
                    // found a homogeneous repeating cycle (repetitions > 1).
                    // The irregular fallback path shows no ×N.
                    // ×N only when the EXACT ordered note sequence repeats N
                    // times (motifInfo.exactCycle): the motif must literally
                    // repeat. The "distinct chords per cycle" branch also
                    // reports repetitions>1 but those are NOT motif repeats.
                    const reps = (m.motifInfo && m.motifInfo.exactCycle
                        && m.motifInfo.repetitions > 1
                        && m.motifInfo.notesPerCycle * m.motifInfo.repetitions === aq.noteCount)
                        ? m.motifInfo.repetitions : 1;
                    const label = reps > 1 ? `${aq.badge} ×${reps}` : aq.badge;
                    m.arpeggioBadge = {
                        label, bareLabel: aq.badge, chord: aq.chord, reps,
                        altered: aq.altered, alteredNoteName: aq.alteredNoteName,
                    };
                }
            }
            runStart = runEnd + 1;
        }

        // ── Run-rule helper ────────────────────────────────────────────────
        // Marks `flagKey=true` on every measure that belongs to a run of ≥2
        // consecutive measures where `pick(m)` is truthy AND (optionally) the
        // `sameSig(a,b)` predicate holds between neighbours.
        const applyRunRule = (pick, flagKey, sameSig) => {
            let s = 0;
            while (s < measures.length) {
                if (!pick(measures[s])) { s++; continue; }
                let e = s;
                while (e + 1 < measures.length && pick(measures[e + 1])
                    && (!sameSig || sameSig(measures[e], measures[e + 1]))) {
                    e++;
                }
                if (e - s + 1 >= 2) {
                    for (let i = s; i <= e; i++) measures[i][flagKey] = true;
                }
                s = e + 1;
            }
        };

        // Right-hand arpeggio run rule (left hand already handled above via
        // arpeggioBadge). Ostinato run rules per hand keyed by rhythm signature.
        applyRunRule(m => m.rightArpeggio, 'rightArpeggioActive');
        applyRunRule(
            m => m.leftOstinato, 'leftOstinatoActive',
            (a, b) => a.leftOstinato.rhythmSig === b.leftOstinato.rhythmSig,
        );
        applyRunRule(
            m => m.rightOstinato, 'rightOstinatoActive',
            (a, b) => a.rightOstinato.rhythmSig === b.rightOstinato.rhythmSig,
        );

        // ── Per-hand role resolution ───────────────────────────────────────
        // Priority: arpège → ostinato → pédale → (accords plaqués / fallback
        // resolved at render time). Pédale has no run requirement.
        //
        // Exception: a CLEAN (non-altered) arpège outranks an ostinato, but an
        // ALTERED/incomplete arpège (a weak guess on a 3-note set, e.g.
        // {Fa,Sib,La}) does NOT — a tight repeating motif is the better lesson,
        // so the ostinato wins. A genuine chord arpeggio (Departure's clean
        // Do min) keeps priority.
        for (const m of measures) {
            // LEFT hand
            const leftArpClean = m.arpeggioBadge && !m.arpeggioBadge.altered;
            if (m.arpeggioBadge && (leftArpClean || !m.leftOstinatoActive)) {
                m.leftRole = { kind: 'arpeggio', badge: m.arpeggioBadge };
            } else if (m.leftOstinatoActive) {
                m.leftRole = { kind: 'ostinato', ostinato: m.leftOstinato };
            } else if (m.leftPedal) {
                m.leftRole = { kind: 'pedal', pedal: m.leftPedal };
            }
            // RIGHT hand
            const rightArp = m.rightArpeggioActive && m.rightArpeggio ? m.rightArpeggio : null;
            const rightArpClean = rightArp && !rightArp.altered;
            if (rightArp && (rightArpClean || !m.rightOstinatoActive)) {
                m.rightRole = {
                    kind: 'arpeggio',
                    badge: {
                        label: rightArp.badge, bareLabel: rightArp.badge,
                        chord: rightArp.chord, reps: 1,
                        altered: rightArp.altered, alteredNoteName: rightArp.alteredNoteName,
                    },
                };
            } else if (m.rightOstinatoActive) {
                m.rightRole = { kind: 'ostinato', ostinato: m.rightOstinato };
            } else if (m.rightPedal) {
                m.rightRole = { kind: 'pedal', pedal: m.rightPedal };
            }
        }

        return {
            measures,
            phraseBreaks,
            totalMeasures: measures.length,
            key: song.key,
            tempo: song.tempo,
            uniqueNotes: Array.from(allNotes).sort()
        };
    }, [song]);

    // Group measures by phrase, then by 4 within each phrase
    const phrasesWithGroups = useMemo(() => {
        if (!analysis || !song?.phrases) return [];

        const result = [];
        let measureIdx = 0;

        song.phrases.forEach((phrase, phraseIdx) => {
            const phraseMeasureCount = phrase.length;
            const measures = analysis.measures.slice(measureIdx, measureIdx + phraseMeasureCount);
            measureIdx += phraseMeasureCount;

            const groups = [];
            for (let i = 0; i < measures.length; i += 4) {
                groups.push(measures.slice(i, i + 4));
            }

            result.push({
                phraseName: phrase.name,
                phraseIndex: phraseIdx,
                groups
            });
        });

        return result;
    }, [analysis, song]);

    // ── Stable callbacks ──────────────────────────────────────────────────────

    // Phrase measure ranges for loop selector
    const phraseMeasureRanges = useMemo(() => {
        if (!song || !song.phrases) return [];
        let startMeasure = 1;
        return song.phrases.map((phrase) => {
            const range = {
                name: phrase.name,
                startMeasure,
                endMeasure: startMeasure + phrase.length - 1,
            };
            startMeasure += phrase.length;
            return range;
        });
    }, [song]);

    // Build a combined phrase for continuous playback via playPhrase
    const combinedPhrase = useMemo(() => {
        if (!song || !song.phrases || song.phrases.length === 0) return null;
        const melody = [];
        const chords = [];
        let beatOffset = 0;
        // Notes are stored in the legacy "4 units per measure" convention,
        // regardless of song.timeSignature. Stick to it for slicing /
        // scheduling so non-4/4 songs still play back correctly.
        song.phrases.forEach(phrase => {
            phrase.tracks.melody.forEach(n => {
                melody.push({ ...n, startTime: n.startTime + beatOffset });
            });
            phrase.tracks.chords.forEach(n => {
                chords.push({ ...n, startTime: n.startTime + beatOffset });
            });
            beatOffset += phrase.length * 4;
        });
        const totalLength = song.phrases.reduce((sum, p) => sum + p.length, 0);
        return {
            tracks: { melody, chords },
            length: totalLength,
        };
    }, [song]);

    const handlePlayMeasure = useCallback(async (measure, hand = 'both') => {
        setFocusedMeasure(measure.number);
        await audioEngine.initialize();

        // Stop any full-song playback that may be running
        if (isPlaying) {
            audioEngine.stop();
            audioEngine.stopMetronome();
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
            setIsPlaying(false);
            setPlayingMeasure(-1);
            playingMeasureRef.current = -1;
        }

        let notesToPlay = [];
        if (hand === 'both') {
            notesToPlay = [...measure.melody, ...measure.chords];
        } else if (hand === 'right') {
            notesToPlay = measure.melody;
        } else if (hand === 'left') {
            notesToPlay = measure.chords;
        }

        if (notesToPlay.length === 0) return;

        audioEngine.playNotes(notesToPlay, currentBPM);

        // Drive the same progress indicators as the full-song path.
        // Show this card as "playing" for the real duration of one measure,
        // then clear the state once audio finishes.
        const measureDurationMs =
            ((measure.unitsPerMeasure || 4) / 4) * (60 / Math.max(currentBPM, 1)) * 4 * 1000;

        setPlayingMeasure(measure.number);
        playingMeasureRef.current = measure.number;
        setIsPlaying(true);

        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = setTimeout(() => {
            playingMeasureRef.current = -1;
            setPlayingMeasure(-1);
            setIsPlaying(false);
        }, measureDurationMs);
    }, [currentBPM, isPlaying]);

    const startPlaybackTracking = useCallback((startMeasure, endMeasure) => {
        // Clear any existing interval
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);

        setPlayingMeasure(startMeasure);

        // Use the 4-units-per-measure data convention for tracking.
        const UNITS_PER_MEASURE = 4;
        playbackIntervalRef.current = setInterval(() => {
            // Use getMusicSeconds (Transport.seconds - preroll) so the
            // tracked measure ignores the count-in bar when metronome is on.
            const musicSeconds = audioEngine.getMusicSeconds();
            if (musicSeconds <= 0) return; // Preroll or not started yet
            const beatsPerSecond = currentBPM / 60;
            const currentBeat = musicSeconds * beatsPerSecond + (startMeasure - 1) * UNITS_PER_MEASURE;
            const currentMsr = Math.floor(currentBeat / UNITS_PER_MEASURE) + 1;

            if (currentMsr > endMeasure) {
                // End of playback
                if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
                playingMeasureRef.current = -1;
                setPlayingMeasure(-1);
                setIsPlaying(false);
                audioEngine.stop();
                audioEngine.stopMetronome();
                return;
            }

            if (currentMsr !== playingMeasureRef.current) {
                playingMeasureRef.current = currentMsr;
                setPlayingMeasure(currentMsr);
                setFocusedMeasure(currentMsr);
            }
        }, 200);
    }, [currentBPM]);

    const handlePlayPause = useCallback(async () => {
        if (isPlaying) {
            audioEngine.stop();
            audioEngine.stopMetronome();
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
            setIsPlaying(false);
            setPlayingMeasure(-1);
            playingMeasureRef.current = -1;
        } else {
            if (!combinedPhrase || !analysis) return;
            await audioEngine.initialize();

            let endMeasure = analysis.totalMeasures;
            let effectiveStartMeasure = focusedMeasure;

            if (isLooping && loopConfig) {
                endMeasure = loopConfig.endMeasure;
                effectiveStartMeasure = Math.max(focusedMeasure, loopConfig.startMeasure);
            }

            const startPositionBeats = (effectiveStartMeasure - 1) * 4;

            // Build a filtered phrase if hand selection is not 'both'
            let phraseToPlay = combinedPhrase;
            if (playbackHand === 'right') {
                phraseToPlay = { ...combinedPhrase, tracks: { melody: combinedPhrase.tracks.melody, chords: [] } };
            } else if (playbackHand === 'left') {
                phraseToPlay = { ...combinedPhrase, tracks: { melody: [], chords: combinedPhrase.tracks.chords } };
            }

            const doPlay = () => {
                // Start the running metronome BEFORE playPhrase so it ticks
                // through both the preroll and the music when enabled.
                if (isMetronomeOn) {
                    audioEngine.startMetronome(currentBPM, metronomeSubdivision || 'quarter');
                }
                audioEngine.playPhrase(
                    phraseToPlay,
                    currentBPM,
                    startPositionBeats,
                    true, // stopAtEnd
                    () => {
                        setIsPlaying(false);
                        playingMeasureRef.current = -1;
                        setPlayingMeasure(-1);
                        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
                    },
                    4, // beatsPerMeasure = our 4-units-per-measure data convention
                    { preroll: isMetronomeOn },
                );
                setIsPlaying(true);
                setFocusedMeasure(effectiveStartMeasure);
                startPlaybackTracking(effectiveStartMeasure, endMeasure);
            };

            // Preroll is now handled by audioEngine.playPhrase when
            // metronome is on — see AudioEngine.playPhrase. The phrase
            // scheduling already offsets notes after the preroll, so we
            // just start tracking immediately. The `startPlaybackTracking`
            // loop reads getMusicSeconds() which returns negative during
            // the preroll, keeping the focused measure visually correct.
            doPlay();
        }
    }, [isPlaying, combinedPhrase, analysis, focusedMeasure, playbackHand, currentBPM, isLooping, loopConfig, isMetronomeOn, metronomeSubdivision, startPlaybackTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        };
    }, []);

    // Restart: stop and snap back to the first measure (shared dock button)
    const handleRestart = useCallback(() => {
        if (isPlaying) {
            audioEngine.stop();
            audioEngine.stopMetronome();
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
            setIsPlaying(false);
            setPlayingMeasure(-1);
            playingMeasureRef.current = -1;
        }
        setFocusedMeasure(1);
    }, [isPlaying]);

    const handleTempoChange = useCallback((bpm) => {
        setCurrentBPM(bpm);
        if (audioEngine.isPlaying) {
            audioEngine.setTempo(bpm);
        }
    }, []);

    const handleTimelineClick = useCallback((measureNum) => {
        setFocusedMeasure(measureNum);
    }, []);

    const handlePhraseSelect = useCallback((e) => {
        const val = e.target.value;
        setSelectedPhraseIndex(val);
        if (val !== '' && val !== 'custom') {
            const range = phraseMeasureRanges[parseInt(val)];
            if (range) {
                setLoopConfig(range);
                setFocusedMeasure(range.startMeasure);
            }
        }
    }, [phraseMeasureRanges]);

    // Auto-scroll during playback: keep the active measure card in view.
    // Only fires while `isPlaying` is true to avoid yanking the page on
    // manual measure focus changes. Skips the scroll when the card is
    // already well within the viewport (≥ 15 % margin on either side).
    useEffect(() => {
        if (!isPlaying || playingMeasure <= 0) return;
        const el = measureRefs.current[playingMeasure];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const margin = vh * 0.15;
        const fullyVisible = rect.top >= margin && rect.bottom <= vh - margin;
        if (!fullyVisible) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isPlaying, playingMeasure]);

    const displayNoteName = useCallback((pitch, keySignature) => {
        const fullName = getFrenchNoteName(pitch, keySignature);
        if (showOctaves) return fullName;
        return fullName.slice(0, -1);
    }, [showOctaves]);


    if (!analysis) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                Aucun morceau chargé. Importez un fichier MIDI pour commencer.
            </div>
        );
    }

    const highlightedMeasures = song.highlightedMeasures || [];

    return (
        <div className="live-learning" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: 130 + (isMobile ? 64 : 0) }}>
            {/* MobileHeader on mobile; legacy compact bar on desktop */}
            {isMobile ? (
                <MobileHeader
                    title={song.title}
                    subtitle={`${getFrenchKeyName(analysis.key)} · ${analysis.tempo} BPM · ${analysis.totalMeasures} mesures`}
                    right={
                        <>
                            <SmallToggleBtn label="Oct" active={showOctaves} onClick={() => setShowOctaves(!showOctaves)} />
                            <SmallToggleBtn label="Détails" active={showDetails} onClick={() => setShowDetails(!showDetails)} />
                        </>
                    }
                />
            ) : (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                flexWrap: 'wrap',
                padding: '0.75rem 0',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    minWidth: 0,
                    flex: 1,
                }}>
                    <span style={{
                        fontSize: '1.15rem',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {song.title}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span>{getFrenchKeyName(analysis.key)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span>{analysis.tempo} BPM</span>
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button
                        onClick={() => setShowOctaves(!showOctaves)}
                        style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.65rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            background: showOctaves ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            color: showOctaves ? 'var(--bg-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            minHeight: 'auto',
                            fontWeight: 500,
                        }}
                    >
                        Oct
                    </button>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.65rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            background: showDetails ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            color: showDetails ? 'var(--bg-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            minHeight: 'auto',
                            fontWeight: 500,
                        }}
                    >
                        Détails
                    </button>
                </div>
            </div>
            )}

            {/* Desktop layout: 2-column (content + right rail sidebar with HandGuides + Keyboard for current measure). */}
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: isMobile ? 0 : 18,
                alignItems: 'stretch',
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>

            {/* Timeline (PINNED TOP on mobile) */}
            <CoordinationTimeline
                measures={analysis.measures}
                currentMeasureIndex={focusedMeasure - 1}
                playingMeasureIndex={playingMeasure > 0 ? playingMeasure - 1 : -1}
                isMobile={isMobile}
                onMeasureClick={handleTimelineClick}
                displayNoteName={displayNoteName}
                keySignature={song.key}
            />

            {/* Measure Grid (scrolls between pinned elements) */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '1.5rem' : '2.5rem',
                padding: isMobile ? '0.75rem 0' : '1rem 0',
                paddingBottom: isMobile ? '180px' : '1rem',
                position: 'relative',
                zIndex: 1,
                isolation: 'isolate',
            }}>
                {phrasesWithGroups.map((phrase) => (
                    <div key={phrase.phraseIndex}>
                        {phrase.phraseIndex > 0 && (
                            <div style={{
                                padding: '0.5rem 1rem',
                                background: 'var(--bg-tertiary)',
                                borderLeft: '3px solid var(--accent-primary)',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 500,
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)',
                                marginBottom: '1rem'
                            }}>
                                {phrase.phraseName}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
                            {phrase.groups.map((group, groupIdx) => (
                                <div key={groupIdx}>
                                    <div style={{
                                        marginBottom: '0.5rem',
                                        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                                    }}>
                                        <span style={{
                                            fontSize: 10,
                                            color: 'var(--text-tertiary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.08em',
                                            fontWeight: 700,
                                        }}>Mesures en cours</span>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: 14, fontWeight: 700,
                                            letterSpacing: '-0.01em',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            {String(group[0].number).padStart(2, '0')}–{String(group[group.length - 1].number).padStart(2, '0')}
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        // minmax(0, 1fr): columns may shrink below their content's
                                        // min width — without it, long nowrap badges blow the grid
                                        // out over the right sidebar.
                                        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                                        gap: isMobile ? '0.5rem' : '1rem'
                                    }}>
                                        {group.map((measure) => {
                                            const isBeingPlayed = playingMeasure === measure.number;
                                            return (
                                            <div
                                                key={measure.number}
                                                ref={el => { measureRefs.current[measure.number] = el; }}
                                            >
                                                <MeasureCard
                                                    measure={measure}
                                                    keySignature={song.key}
                                                    isHighlighted={highlightedMeasures.includes(measure.number)}
                                                    isCurrent={isBeingPlayed}
                                                    isPlaying={isPlaying && isBeingPlayed}
                                                    measureDurationSec={(measure.unitsPerMeasure || 4) * 60 / Math.max(currentBPM, 1)}
                                                    onToggleHighlight={onToggleHighlight}
                                                    onPlay={handlePlayMeasure}
                                                    showDetails={showDetails}
                                                    displayNoteName={displayNoteName}
                                                    isMobile={isMobile}
                                                />
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
                </div>

                {/* Right rail — desktop only. Shows HandGuides + mini
                    keyboard for the currently-focused measure. */}
                {!isMobile && (
                    <LearnSidebar
                        measure={analysis.measures.find(m => m.number === focusedMeasure)}
                        allMeasures={analysis.measures}
                        keySignature={song.key}
                        displayNoteName={displayNoteName}
                    />
                )}
            </div>

            {/* Universal PlaybackDock — fixed to viewport bottom on
                desktop, and just above the bottom tab bar on mobile. */}
            <div style={{
                position: 'fixed',
                bottom: isMobile ? 64 : 0,
                left: 0,
                right: 0,
                zIndex: 1000,
            }}>
                    <PlaybackDock
                        playing={isPlaying}
                        onPlayPause={handlePlayPause}
                        onRestart={handleRestart}
                        speed={Math.round((currentBPM / Math.max(song.tempo, 1)) * 100)}
                        onSpeed={(pct) => handleTempoChange(Math.round((pct / 100) * song.tempo))}
                        handMode={playbackHand}
                        onHandMode={setPlaybackHand}
                        metronome={isMetronomeOn}
                        onMetronome={() => setIsMetronomeOn(!isMetronomeOn)}
                        metronomeSubdivision={metronomeSubdivision}
                        onMetronomeSubdivisionChange={setMetronomeSubdivision}
                        loop={isLooping}
                        onLoop={() => setIsLooping(!isLooping)}
                        loopRange={loopConfig ? [loopConfig.startMeasure, loopConfig.endMeasure] : [1, analysis.totalMeasures]}
                        onLoopRange={([from, to]) => setLoopConfig({ startMeasure: from, endMeasure: to })}
                        loopEditorOpen={loopEditorOpen}
                        onToggleLoopEditor={() => setLoopEditorOpen((o) => !o)}
                        totalMeasures={analysis.totalMeasures}
                        phrases={phraseMeasureRanges}
                        onPrev={() => {
                            if (phraseMeasureRanges?.length) {
                                const idx = parseInt(selectedPhraseIndex, 10);
                                if (!isNaN(idx) && idx > 0) handlePhraseSelect({ target: { value: String(idx - 1) } });
                                else setFocusedMeasure((m) => Math.max(1, m - 1));
                            } else {
                                setFocusedMeasure((m) => Math.max(1, m - 1));
                            }
                        }}
                        onNext={() => {
                            if (phraseMeasureRanges?.length) {
                                const idx = parseInt(selectedPhraseIndex, 10);
                                if (!isNaN(idx) && idx < phraseMeasureRanges.length - 1) handlePhraseSelect({ target: { value: String(idx + 1) } });
                                else setFocusedMeasure((m) => Math.min(analysis.totalMeasures, m + 1));
                            } else {
                                setFocusedMeasure((m) => Math.min(analysis.totalMeasures, m + 1));
                            }
                        }}
                    />
                </div>
        </div>
    );
}

// Helper functions extracted to src/utils/measureUtils.js
