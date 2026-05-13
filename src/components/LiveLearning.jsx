import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { getFrenchNoteName, getFrenchKeyName, getNoteNameFromMidi } from '../models/song';
import { detectArpeggioMotifs } from '../utils/chordDetection';
import { getMeasuresFromPhrase, groupNotesByTime } from '../utils/measureUtils';
import { audioEngine } from '../services/AudioEngine';
import { useDeviceContext } from '../hooks/useDeviceContext';
import themeService from '../services/ThemeService';
import { CoordinationTimeline } from './learn/CoordinationTimeline';
import { PlaybackDock } from './PlaybackDock';
import { MobileHeader } from './MobileHeader';

// ── Constant styles extracted outside render ──────────────────────────────────

const STYLES = {
    noteBadge: {
        fontSize: '0.75rem',
        background: 'var(--bg-primary)',
        padding: '0.2rem 0.4rem',
        borderRadius: '4px',
        color: 'var(--text-primary)',
    },
    noteBadgeSmall: {
        fontSize: '0.65rem',
        background: 'var(--bg-primary)',
        padding: '0.1rem 0.3rem',
        borderRadius: '3px',
        color: 'var(--text-primary)',
    },
    melodyBadgePrimary: {
        fontSize: '0.75rem',
        background: 'var(--bg-primary)',
        padding: '0.2rem 0.4rem',
        borderRadius: '4px',
        border: '2px solid var(--hand-right)',
        color: 'var(--hand-right)',
        fontWeight: 'bold',
        cursor: 'pointer',
        userSelect: 'none',
    },
    melodyBadgeSecondary: {
        fontSize: '0.7rem',
        background: 'var(--bg-primary)',
        padding: '0.1rem 0.3rem',
        borderRadius: '3px',
        border: '1px solid var(--hand-right)',
        color: 'var(--hand-right)',
    },
    chordBadge: {
        fontSize: '0.75rem',
        fontWeight: 'bold',
        color: 'var(--hand-left)',
        cursor: 'pointer',
        padding: '0.2rem 0.4rem',
        borderRadius: '4px',
        background: 'var(--bg-primary)',
        border: '2px solid var(--hand-left)',
        transition: 'all var(--transition-fast)',
        userSelect: 'none',
        display: 'inline-block',
    },
    sectionLabel: {
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        marginBottom: '0.25rem',
    },
    measureCardBase: {
        padding: '1rem',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        transition: 'all var(--transition-fast)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        boxSizing: 'border-box',
    },
    playButton: {
        flex: 1,
        padding: '0.3rem',
        fontSize: '0.7rem',
        backgroundColor: 'transparent',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
    },
    numberBadgeBase: {
        position: 'absolute',
        top: '0.5rem',
        right: '0.5rem',
        color: 'var(--text-primary)',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        zIndex: 2,
    },
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

const ChordDisplay = React.memo(function ChordDisplay({ measure, keySignature, showDetails, displayNoteName, expandedChordReps, onToggleChordRep, isMobile, handColors }) {
    const { isArpeggio, detectedChord, motifInfo, chordGroups, hasChord } = measure;

    return (
        <div style={{ marginBottom: '0.75rem', paddingRight: '2rem' }}>
            <div style={STYLES.sectionLabel}>
                {isArpeggio && detectedChord && motifInfo?.repetitions > 1 ? (
                    <>Accords (arpège de {chordGroups.length} notes, {motifInfo.repetitions}x{motifInfo.notesPerCycle})</>
                ) : isArpeggio && detectedChord ? (
                    <>Accord (arpège de {chordGroups.length} notes)</>
                ) : isArpeggio ? (
                    <>Arpège ({chordGroups.length} notes)</>
                ) : (
                    <>Accords {chordGroups.length > 1 && `(${chordGroups.length})`}</>
                )}
            </div>

            {hasChord ? (
                isArpeggio && detectedChord ? (
                    <ArpeggioChordView
                        measure={measure}
                        motifInfo={motifInfo}
                        detectedChord={detectedChord}
                        expandedChordReps={expandedChordReps}
                        onToggleChordRep={onToggleChordRep}
                        showDetails={showDetails}
                        displayNoteName={displayNoteName}
                        keySignature={keySignature}
                        isMobile={isMobile}
                        handColors={handColors}
                    />
                ) : isArpeggio ? (
                    <ArpeggioSequenceView
                        chordGroups={chordGroups}
                        displayNoteName={displayNoteName}
                        keySignature={keySignature}
                        handColors={handColors}
                    />
                ) : (
                    <SimultaneousChordsView
                        chordGroups={chordGroups}
                        showDetails={showDetails}
                        displayNoteName={displayNoteName}
                        keySignature={keySignature}
                        handColors={handColors}
                    />
                )
            ) : (
                <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: 'var(--text-tertiary)'
                }}>
                    -
                </div>
            )}
        </div>
    );
});

function ArpeggioChordView({ measure, motifInfo, detectedChord, expandedChordReps, onToggleChordRep, showDetails, displayNoteName, keySignature, isMobile, handColors }) {
    const leftColor = handColors?.left || '#3b82f6';
    const reps = motifInfo?.repetitions || 1;
    const chords = motifInfo?.chords || [detectedChord];
    const totalNotes = measure.chordGroups.length;
    const notesPerCycle = Math.ceil(totalNotes / reps);

    if (isMobile) {
        // Group consecutive identical chords
        const groups = [];
        let i = 0;
        while (i < reps) {
            const chord = chords[i] || detectedChord;
            let count = 1;
            while (i + count < reps && (chords[i + count] || detectedChord).displayName === chord.displayName) {
                count++;
            }
            groups.push({ chord, count, startIdx: i });
            i += count;
        }

        return (
            <div>
                {groups.map((group, gIdx) => {
                    const { chord, count, startIdx } = group;
                    const isExpanded = expandedChordReps.has(startIdx) || showDetails;
                    // Collect unique notes across all reps in this group
                    const seenPitches = new Set();
                    const uniqueGroups = [];
                    for (let r = 0; r < count; r++) {
                        const repIdx = startIdx + r;
                        const cycleStart = repIdx * notesPerCycle;
                        const cycleEnd = Math.min(cycleStart + notesPerCycle, totalNotes);
                        measure.chordGroups.slice(cycleStart, cycleEnd).forEach(cg => {
                            const pitch = cg.notes[0].pitch;
                            if (!seenPitches.has(pitch)) {
                                seenPitches.add(pitch);
                                uniqueGroups.push(cg);
                            }
                        });
                    }

                    return (
                        <div key={gIdx} style={{ marginBottom: '0.2rem' }}>
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleChordRep(measure.number, startIdx);
                                }}
                                style={{ ...STYLES.chordBadge, borderColor: leftColor, color: leftColor }}
                                title="Cliquer pour voir les notes"
                            >
                                {chord.displayName}
                                {count > 1 && (
                                    <span style={{ fontSize: '0.7em', marginLeft: '0.3rem', opacity: 0.75 }}>x{count}</span>
                                )}
                            </span>
                            {isExpanded && (
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.2rem',
                                    alignItems: 'center',
                                    marginTop: '0.15rem',
                                    marginLeft: '0.25rem'
                                }}>
                                    {uniqueGroups.map((chordGroup, idx) => (
                                        <span key={idx} style={{
                                            ...STYLES.noteBadgeSmall,
                                            border: '1px solid var(--accent-secondary)',
                                        }}>
                                            {displayNoteName(chordGroup.notes[0].pitch, keySignature)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div>
            {Array.from({ length: reps }).map((_, repIdx) => {
                const isExpanded = expandedChordReps.has(repIdx) || showDetails;
                const cycleStart = repIdx * notesPerCycle;
                const cycleEnd = Math.min(cycleStart + notesPerCycle, totalNotes);
                const cycleGroups = measure.chordGroups.slice(cycleStart, cycleEnd);
                const cycleChord = chords[repIdx] || detectedChord;

                return (
                    <div key={repIdx} style={{ marginBottom: '0.2rem' }}>
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleChordRep(measure.number, repIdx);
                            }}
                            style={{ ...STYLES.chordBadge, borderColor: leftColor, color: leftColor }}
                            title="Cliquer pour voir les notes"
                        >
                            {cycleChord.displayName}
                        </span>
                        {isExpanded && (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.2rem',
                                alignItems: 'center',
                                marginTop: '0.15rem',
                                marginLeft: '0.25rem'
                            }}>
                                {cycleGroups.map((chordGroup, idx) => (
                                    <span key={idx} style={{
                                        ...STYLES.noteBadgeSmall,
                                        border: '1px solid var(--accent-secondary)',
                                    }}>
                                        {displayNoteName(chordGroup.notes[0].pitch, keySignature)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ArpeggioSequenceView({ chordGroups, displayNoteName, keySignature, handColors }) {
    const leftColor = handColors?.left || '#3b82f6';
    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.25rem',
            alignItems: 'center'
        }}>
            {chordGroups.map((chordGroup, idx) => {
                const noteName = displayNoteName(chordGroup.notes[0].pitch, keySignature);
                const isFirst = idx === 0;
                return (
                    <span key={idx} style={{
                        ...STYLES.noteBadge,
                        border: isFirst ? `2px solid ${leftColor}` : `1px solid ${leftColor}`,
                        fontWeight: isFirst ? 'bold' : 'normal',
                    }}>
                        {noteName}
                    </span>
                );
            })}
        </div>
    );
}

function SimultaneousChordsView({ chordGroups, showDetails, displayNoteName, keySignature, handColors }) {
    const leftColor = handColors?.left || '#3b82f6';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {chordGroups.map((chordGroup, idx) => {
                const chordName = displayNoteName(chordGroup.notes[0].pitch, keySignature);
                return (
                    <div key={idx}>
                        <span style={{
                            ...STYLES.noteBadge,
                            border: `2px solid ${leftColor}`,
                            color: leftColor,
                            fontWeight: 'bold',
                            display: 'inline-block',
                        }}>
                            {chordName}
                        </span>
                        {showDetails && (
                            <div style={{
                                fontSize: '0.65rem',
                                color: 'var(--text-secondary)',
                                marginTop: '0.15rem',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.2rem'
                            }}>
                                {chordGroup.notes.map((n, i) => (
                                    <span key={i} style={{
                                        ...STYLES.noteBadgeSmall,
                                        border: '1px solid var(--border-color)',
                                    }}>
                                        {displayNoteName(n.pitch, keySignature)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── MeasureCard (memoized) — compact design-aligned card ─────────────────────

const MeasureCard = React.memo(function MeasureCard({
    measure, keySignature, isHighlighted, onToggleHighlight, onPlay,
    showDetails, displayNoteName, expandedChordReps, onToggleChordRep,
    isMelodyExpanded, onToggleMelodyExpand, isMobile, handColors,
    isCurrent = false, isPlaying = false,
    // Real measure duration in seconds. Drives the beat-fill animation so
    // the progress bar lines up with audio (start of fill = start of
    // measure, end of fill = end of measure). Falls back to 1.6s.
    measureDurationSec = 1.6,
}) {
    // Pre-sorted melody (stable reference from getMeasuresFromPhrase)
    const sortedMelody = measure.sortedMelody;
    const chordName = measure.detectedChord?.displayName;

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

    // Derive timeline beat positions from startTime in beats (relative to measure)
    const beatsPerMeasure = measure.beatsPerMeasure || 4;
    const measureStartBeat = (measure.number - 1) * beatsPerMeasure;
    const rightTimes = sortedMelody.map(n => Math.max(0, Math.min(1,
        ((n.startTime ?? 0) - measureStartBeat) / beatsPerMeasure
    )));
    const leftTimes = (measure.chordGroups || []).map(g => {
        const t = g.notes?.[0]?.startTime ?? 0;
        return Math.max(0, Math.min(1, (t - measureStartBeat) / beatsPerMeasure));
    });

    // Unique pitch labels (deduped)
    const rightLabels = [...new Set(sortedMelody.map(n => n.pitch))]
        .slice(0, isMobile ? 4 : 6)
        .map(p => displayNoteName(p, keySignature));
    const leftLabels = [...new Set((measure.chords || []).map(n => n.pitch))]
        .slice(0, isMobile ? 4 : 6)
        .map(p => displayNoteName(p, keySignature));

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

            {/* Top row: measure number + chord chip + play buttons */}
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
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {chordName && (
                        <span style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--r-sm)',
                            background: accentBorder ? 'var(--accent)' : 'var(--surface-3)',
                            color: accentBorder ? '#fff' : 'var(--text-secondary)',
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.02em',
                            whiteSpace: 'nowrap',
                        }}>{chordName}</span>
                    )}
                    <MeasurePlayButton hand="left" onClick={(e) => { e.stopPropagation(); onPlay(measure, 'left'); }} />
                    <MeasurePlayButton hand="right" onClick={(e) => { e.stopPropagation(); onPlay(measure, 'right'); }} />
                </div>
            </div>

            {/* Right hand notes (cyan pills) */}
            {rightLabels.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 5, minHeight: 18 }}>
                    {rightLabels.map((n, i) => (
                        <span key={`r${i}`} style={{
                            fontSize: 9.5, fontWeight: 600,
                            padding: '2px 5px',
                            borderRadius: 4,
                            background: 'var(--hand-right-dim)',
                            color: 'var(--hand-right)',
                            border: '1px solid var(--hand-right-border)',
                        }}>{n}</span>
                    ))}
                </div>
            ) : <div style={{ marginBottom: 5, minHeight: 18 }} />}

            {/* Left hand notes (pink pills) */}
            {leftLabels.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, minHeight: 18 }}>
                    {leftLabels.map((n, i) => (
                        <span key={`l${i}`} style={{
                            fontSize: 9.5, fontWeight: 600,
                            padding: '2px 5px',
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
                    {[0.25, 0.5, 0.75].map((p) => (
                        <div key={p} style={{
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

            {/* Detail expansion — show full ChordDisplay only when "showDetails" is on */}
            {showDetails && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--hairline)' }}>
                    <ChordDisplay
                        measure={measure}
                        handColors={handColors}
                        keySignature={keySignature}
                        showDetails={showDetails}
                        displayNoteName={displayNoteName}
                        expandedChordReps={expandedChordReps}
                        onToggleChordRep={onToggleChordRep}
                        isMobile={isMobile}
                    />
                </div>
            )}

        </div>
    );
});

// Compact play button for the right-hand / left-hand quick-play next to chord chip
function MeasurePlayButton({ hand, onClick }) {
    const isRight = hand === 'right';
    const color = isRight ? 'var(--hand-right)' : 'var(--hand-left)';
    const border = isRight ? 'var(--hand-right-border)' : 'var(--hand-left-border)';
    return (
        <button
            onClick={onClick}
            title={isRight ? 'Jouer main droite' : 'Jouer main gauche'}
            style={{
                fontFamily: 'inherit',
                fontSize: 9,
                fontWeight: 700,
                color,
                background: 'transparent',
                border: `1px solid ${border}`,
                borderRadius: 'var(--r-sm)',
                padding: '2px 5px',
                cursor: 'pointer',
                letterSpacing: '0.02em',
            }}
        >
            ▶ {isRight ? 'MD' : 'MG'}
        </button>
    );
}

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
    const [expandedChords, setExpandedChords] = useState(new Map());
    const [expandedMelodies, setExpandedMelodies] = useState(new Set());
    const [focusedMeasure, setFocusedMeasure] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackHand, setPlaybackHand] = useState('both');
    const [currentBPM, setCurrentBPM] = useState(song?.tempo || 120);
    const [isLooping, setIsLooping] = useState(false);
    const [selectedPhraseIndex, setSelectedPhraseIndex] = useState('');
    const [customRangeStart, setCustomRangeStart] = useState('');
    const [customRangeEnd, setCustomRangeEnd] = useState('');
    const [loopConfig, setLoopConfig] = useState(null);
    const [playingMeasure, setPlayingMeasure] = useState(-1);
    const [isMetronomeOn, setIsMetronomeOn] = useState(false);
    const [loopEditorOpen, setLoopEditorOpen] = useState(false);
    const measureRefs = useRef({});
    const playbackIntervalRef = useRef(null);
    const playingMeasureRef = useRef(-1);

    // Hand colors from settings
    const [handColors, setHandColors] = useState(() => ({
        left: themeService.getHandColors('left').primary,
        right: themeService.getHandColors('right').primary,
    }));

    useEffect(() => {
        const update = () => setHandColors({
            left: themeService.getHandColors('left').primary,
            right: themeService.getHandColors('right').primary,
        });
        return themeService.addListener(update);
    }, []);

    // Reset BPM when song changes
    useEffect(() => {
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

        const getRawNoteName = (pitch) => {
            const name = typeof pitch === 'number' ? getNoteNameFromMidi(pitch) : pitch;
            return name ? name.slice(0, -1) : '';
        };

        song.phrases.forEach((phrase, phraseIndex) => {
            if (phraseIndex > 0) {
                phraseBreaks.push({
                    measureIndex: measures.length,
                    phraseName: phrase.name
                });
            }

            const phraseMeasures = getMeasuresFromPhrase(phrase);

            phraseMeasures.forEach(measure => {
                measure.melody.forEach(n => allNotes.add(getRawNoteName(n.pitch)));
                measure.chords.forEach(n => allNotes.add(getRawNoteName(n.pitch)));

                const chordGroups = groupNotesByTime(measure.chords);
                const isArpeggio = chordGroups.length >= 2 && chordGroups.every(g => g.notes.length === 1);
                const motifInfo = isArpeggio ? detectArpeggioMotifs(chordGroups, song.key) : null;
                const detectedChord = motifInfo ? motifInfo.chord : null;

                measures.push({
                    number: measures.length + 1,
                    chordGroups,
                    melodyCount: measure.melody.length,
                    hasChord: chordGroups.length > 0,
                    melody: measure.melody,
                    sortedMelody: [...measure.melody].sort((a, b) => a.startTime - b.startTime),
                    chords: measure.chords,
                    isArpeggio,
                    detectedChord,
                    motifInfo
                });
            });
        });

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
        song.phrases.forEach(phrase => {
            phrase.tracks.melody.forEach(n => {
                melody.push({ ...n, startTime: n.startTime + beatOffset });
            });
            phrase.tracks.chords.forEach(n => {
                chords.push({ ...n, startTime: n.startTime + beatOffset });
            });
            beatOffset += phrase.length * 4; // 4 beats per measure
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

        let notesToPlay = [];
        if (hand === 'both') {
            notesToPlay = [...measure.melody, ...measure.chords];
        } else if (hand === 'right') {
            notesToPlay = measure.melody;
        } else if (hand === 'left') {
            notesToPlay = measure.chords;
        }

        if (notesToPlay.length > 0) {
            audioEngine.playNotes(notesToPlay, currentBPM);
        }
    }, [currentBPM]);

    const startPlaybackTracking = useCallback((startMeasure, endMeasure) => {
        // Clear any existing interval
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);

        setPlayingMeasure(startMeasure);

        playbackIntervalRef.current = setInterval(() => {
            // Use getMusicSeconds (Transport.seconds - preroll) so the
            // tracked measure ignores the count-in bar when metronome is on.
            const musicSeconds = audioEngine.getMusicSeconds();
            if (musicSeconds <= 0) return; // Preroll or not started yet
            const beatsPerSecond = currentBPM / 60;
            const currentBeat = musicSeconds * beatsPerSecond + (startMeasure - 1) * 4;
            const currentMsr = Math.floor(currentBeat / 4) + 1;

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
                audioEngine.playPhrase(
                    phraseToPlay,
                    currentBPM,
                    startPositionBeats,
                    true, // stopAtEnd
                    () => {
                        // onPlaybackEnd callback
                        setIsPlaying(false);
                        playingMeasureRef.current = -1;
                        setPlayingMeasure(-1);
                        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
                    },
                    4 // beatsPerMeasure
                );
                if (isMetronomeOn) {
                    audioEngine.startMetronome(currentBPM, 'quarter');
                }
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
    }, [isPlaying, combinedPhrase, analysis, focusedMeasure, playbackHand, currentBPM, isLooping, loopConfig, isMetronomeOn, startPlaybackTracking]);

    const handleStop = useCallback(() => {
        audioEngine.stop();
        audioEngine.stopMetronome();
        if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        setIsPlaying(false);
        setPlayingMeasure(-1);
        playingMeasureRef.current = -1;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
        };
    }, []);

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

    const handleCustomRangeLoop = useCallback(() => {
        const start = parseInt(customRangeStart);
        const end = parseInt(customRangeEnd);
        if (start && end && start <= end) {
            setLoopConfig({ startMeasure: start, endMeasure: end });
            setFocusedMeasure(start);
        }
    }, [customRangeStart, customRangeEnd]);

    const handleClearLoop = useCallback(() => {
        setLoopConfig(null);
        setSelectedPhraseIndex('');
        setCustomRangeStart('');
        setCustomRangeEnd('');
    }, []);

    // Auto-scroll to focused/playing measure card
    useEffect(() => {
        const target = playingMeasure > 0 ? playingMeasure : focusedMeasure;
        const el = measureRefs.current[target];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [focusedMeasure, playingMeasure]);

    const displayNoteName = useCallback((pitch, keySignature) => {
        const fullName = getFrenchNoteName(pitch, keySignature);
        if (showOctaves) return fullName;
        return fullName.slice(0, -1);
    }, [showOctaves]);

    const onToggleChordRep = useCallback((measureNum, repIndex) => {
        setExpandedChords(prev => {
            const next = new Map(prev);
            const reps = new Set(next.get(measureNum) || []);
            if (reps.has(repIndex)) reps.delete(repIndex);
            else reps.add(repIndex);
            if (reps.size === 0) next.delete(measureNum);
            else next.set(measureNum, reps);
            return next;
        });
    }, []);

    const onToggleMelodyExpand = useCallback((measureNum) => {
        setExpandedMelodies(prev => {
            const next = new Set(prev);
            if (next.has(measureNum)) next.delete(measureNum);
            else next.add(measureNum);
            return next;
        });
    }, []);

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
                                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
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
                                                    measureDurationSec={(measure.beatsPerMeasure || 4) * 60 / Math.max(currentBPM, 1)}
                                                    onToggleHighlight={onToggleHighlight}
                                                    onPlay={handlePlayMeasure}
                                                    showDetails={showDetails}
                                                    displayNoteName={displayNoteName}
                                                    expandedChordReps={expandedChords.get(measure.number) || new Set()}
                                                    onToggleChordRep={onToggleChordRep}
                                                    isMelodyExpanded={expandedMelodies.has(measure.number)}
                                                    onToggleMelodyExpand={onToggleMelodyExpand}
                                                    isMobile={isMobile}
                                                    handColors={handColors}
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
                        speed={Math.round((currentBPM / Math.max(song.tempo, 1)) * 100)}
                        onSpeed={(pct) => handleTempoChange(Math.round((pct / 100) * song.tempo))}
                        handMode={playbackHand}
                        onHandMode={setPlaybackHand}
                        metronome={isMetronomeOn}
                        onMetronome={() => setIsMetronomeOn(!isMetronomeOn)}
                        loop={isLooping}
                        onLoop={() => setIsLooping(!isLooping)}
                        loopRange={loopConfig ? [loopConfig.startMeasure, loopConfig.endMeasure] : [1, analysis.totalMeasures]}
                        onLoopRange={([from, to]) => setLoopConfig({ startMeasure: from, endMeasure: to })}
                        loopEditorOpen={loopEditorOpen}
                        onToggleLoopEditor={() => setLoopEditorOpen((o) => !o)}
                        totalMeasures={analysis.totalMeasures}
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
