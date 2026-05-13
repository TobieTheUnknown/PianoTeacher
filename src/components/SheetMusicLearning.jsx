import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    flattenSongMeasures,
    renderMeasure,
    suggestUpperOctaveShift,
    suggestLowerOctaveShift,
    TREBLE_CLEF,
    BASS_CLEF,
    toKotlinKeySig,
} from '../utils/sheetMusic';
import { PlaybackDock } from './PlaybackDock';

/**
 * Sheet Music Learning — design-aligned partition view.
 *
 * Layout mirrors the design prototype (SheetSc):
 *   MobileHeader · KeyTempoBar · stacked SheetSystems (4 measures/row) ·
 *   hand-toggle pills · PlaybackDock
 *
 * Each SheetSystem stacks 4 measure canvases side-by-side, sharing one
 * row. The first measure of each row shows clefs + key signature.
 */
export function SheetMusicLearning({ song, isMobile = false }) {
    const beatsPerMeasure = song?.timeSignature?.numerator || 4;
    const measures = useMemo(
        () => flattenSongMeasures(song, beatsPerMeasure),
        [song, beatsPerMeasure]
    );

    const useFlats = useMemo(() => {
        const ks = toKotlinKeySig(song?.key);
        return ks?.useFlats || false;
    }, [song?.key]);

    const allMelody = useMemo(() => measures.flatMap((m) => m.melodyNotes), [measures]);
    const allChords = useMemo(() => measures.flatMap((m) => m.chordNotes), [measures]);

    const upperShift = useMemo(
        () => suggestUpperOctaveShift(allMelody, TREBLE_CLEF, useFlats),
        [allMelody, useFlats]
    );
    const lowerShift = useMemo(
        () => suggestLowerOctaveShift(allChords, BASS_CLEF, useFlats),
        [allChords, useFlats]
    );

    // Playback / view state (read-only viewer for now — handlers prepared for
    // wiring to a real AudioEngine playback driver).
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(100);
    const [handMode, setHandMode] = useState('both');   // 'left' | 'right' | 'both'
    const [currentMeasure, setCurrentMeasure] = useState(1);
    const [metronome, setMetronome] = useState(false);
    const [loop, setLoop] = useState(false);

    const totalMeasures = measures.length;
    const tsText = song?.timeSignature
        ? `${song.timeSignature.numerator}/${song.timeSignature.denominator}`
        : '';
    const keyText = song?.key
        ? `${song.key.note} ${song.key.mode === 'minor' ? 'mineur' : 'majeur'}`
        : '—';
    const bpm = song?.tempo || 120;

    if (!song || song.phrases?.length === 0 || measures.length === 0) {
        return (
            <EmptyState
                isMobile={isMobile}
                hasSong={!!song && song.phrases?.length > 0}
                title={song?.title}
            />
        );
    }

    // Group measures into systems of 4
    const SYSTEM_SIZE = 4;
    const systems = useMemo(() => {
        const out = [];
        for (let i = 0; i < measures.length; i += SYSTEM_SIZE) {
            out.push(measures.slice(i, i + SYSTEM_SIZE));
        }
        return out;
    }, [measures]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 64px)',
            overflow: 'hidden',
        }}>
            {/* MobileHeader pattern */}
            <div style={{
                padding: '12px 16px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 16,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>{song.title || 'Sans titre'}</div>
                    <div style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        marginTop: 1,
                        fontFamily: 'var(--font-mono)',
                    }}>
                        Mesure {currentMeasure}/{totalMeasures}{tsText && ` · ${tsText}`}
                    </div>
                </div>
            </div>

            {/* Scrollable content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: '4px 16px 12px',
            }}>
                {/* Key + tempo bar */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <span style={{
                        padding: '6px 10px',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flex: 1,
                    }}>
                        <span style={{ fontFamily: 'serif', fontSize: 16, color: 'var(--text-primary)' }}>
                            {useFlats ? '♭' : '♯'}
                        </span>
                        <span>{keyText}</span>
                    </span>
                    <span style={{
                        padding: '6px 10px',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)',
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        {tsText && (
                            <span style={{
                                fontFamily: 'serif',
                                fontSize: 11,
                                lineHeight: 1,
                                display: 'inline-flex',
                                flexDirection: 'column',
                                color: 'var(--text-primary)',
                            }}>
                                <b>{tsText.split('/')[0]}</b>
                                <b>{tsText.split('/')[1]}</b>
                            </span>
                        )}
                        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-primary)',
                            fontWeight: 700,
                        }}>
                            ♩={bpm}
                        </span>
                    </span>
                </div>

                {/* Sheet music staves */}
                <div style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '14px 12px',
                    marginBottom: 12,
                    overflow: 'hidden',
                }}>
                    {song.composer && (
                        <div style={{
                            fontFamily: 'serif',
                            fontStyle: 'italic',
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            textAlign: 'right',
                            marginBottom: 8,
                        }}>~ {song.composer}</div>
                    )}

                    {systems.map((systemMeasures, sysIdx) => (
                        <SheetSystem
                            key={sysIdx}
                            systemIndex={sysIdx}
                            systemSize={SYSTEM_SIZE}
                            measures={systemMeasures}
                            beatsPerMeasure={beatsPerMeasure}
                            useFlats={useFlats}
                            upperShift={upperShift}
                            lowerShift={lowerShift}
                            keySig={song.key}
                            handMode={handMode}
                            currentMeasure={currentMeasure}
                            isMobile={isMobile}
                        />
                    ))}
                </div>

                {/* Hand toggle pills */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <ToggleHandPill
                        hand="left"
                        label="Main G."
                        active={handMode !== 'right'}
                        onClick={() => setHandMode(handMode === 'left' ? 'both' : 'left')}
                    />
                    <ToggleHandPill
                        hand="right"
                        label="Main D."
                        active={handMode !== 'left'}
                        onClick={() => setHandMode(handMode === 'right' ? 'both' : 'right')}
                    />
                </div>
            </div>

            {/* Shared PlaybackDock */}
            <PlaybackDock
                playing={playing}
                onPlayPause={() => setPlaying((p) => !p)}
                speed={speed}
                onSpeed={setSpeed}
                handMode={handMode}
                onHandMode={setHandMode}
                metronome={metronome}
                onMetronome={() => setMetronome((m) => !m)}
                loop={loop}
                onLoop={() => setLoop((l) => !l)}
                totalMeasures={totalMeasures}
                onPrev={() => setCurrentMeasure((m) => Math.max(1, m - 1))}
                onNext={() => setCurrentMeasure((m) => Math.min(totalMeasures, m + 1))}
            />
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SheetSystem({
    systemIndex, systemSize, measures, beatsPerMeasure,
    useFlats, upperShift, lowerShift, keySig, handMode, currentMeasure, isMobile,
}) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            marginBottom: 10,
            alignItems: 'stretch',
        }}>
            {measures.map((m, i) => {
                const globalIdx = systemIndex * systemSize + i + 1;
                return (
                    <SystemMeasure
                        key={`${m.phraseIndex}-${m.measureIndex}`}
                        measureData={m}
                        measureNumber={globalIdx}
                        showClefs={i === 0}
                        beatsPerMeasure={beatsPerMeasure}
                        useFlats={useFlats}
                        upperShift={upperShift}
                        lowerShift={lowerShift}
                        keySig={keySig}
                        handMode={handMode}
                        isCurrent={globalIdx === currentMeasure}
                        isLast={i === measures.length - 1}
                        flex={i === 0 ? '1.4 1 0' : '1 1 0'}
                        height={isMobile ? 130 : 150}
                    />
                );
            })}
        </div>
    );
}

function SystemMeasure({
    measureData, measureNumber, showClefs, beatsPerMeasure, useFlats,
    upperShift, lowerShift, keySig, handMode, isCurrent, isLast, flex, height,
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    // Filter notes based on hand mode (visual filter only — left filters
    // out chordNotes, right filters out melodyNotes).
    const visibleMelody = handMode === 'left' ? [] : measureData.melodyNotes;
    const visibleChords = handMode === 'right' ? [] : measureData.chordNotes;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const rect = el.getBoundingClientRect();
            setDims({ w: rect.width, h: rect.height });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || dims.w === 0 || dims.h === 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(dims.w * dpr);
        canvas.height = Math.floor(dims.h * dpr);
        canvas.style.width = `${dims.w}px`;
        canvas.style.height = `${dims.h}px`;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, dims.w, dims.h);

        renderMeasure(ctx, {
            width: dims.w,
            height: dims.h,
            measureNumber,
            melodyNotes: visibleMelody,
            chordNotes: visibleChords,
            beatsPerMeasure,
            measureStart: measureData.measureStart,
            useFlats,
            showClefs,
            isPlaying: false,
            isFocused: isCurrent,
            clefMode: 'STANDARD',
            upperOctaveShift: upperShift,
            lowerOctaveShift: lowerShift,
            keySig,
            isLandscape: false,
            dp: (n) => n,
        });
    }, [
        dims, measureNumber, visibleMelody, visibleChords, beatsPerMeasure,
        useFlats, showClefs, upperShift, lowerShift, keySig, isCurrent,
    ]);

    return (
        <div
            ref={containerRef}
            style={{
                flex,
                minWidth: 0,
                height,
                background: 'transparent',
                borderRight: isLast ? 'none' : '1px solid var(--border)',
                position: 'relative',
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {isCurrent && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'color-mix(in oklab, var(--accent), transparent 92%)',
                    pointerEvents: 'none',
                    borderLeft: '2px solid var(--accent)',
                }} />
            )}
        </div>
    );
}

function ToggleHandPill({ hand, label, active, onClick }) {
    const isRight = hand === 'right';
    const color = isRight ? 'var(--hand-right)' : 'var(--hand-left)';
    const dim = isRight ? 'var(--hand-right-dim)' : 'var(--hand-left-dim)';
    const border = isRight ? 'var(--hand-right-border)' : 'var(--hand-left-border)';
    return (
        <button
            onClick={onClick}
            style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 'var(--r-md)',
                background: active ? dim : 'var(--surface-2)',
                color: active ? color : 'var(--text-tertiary)',
                border: `1px solid ${active ? border : 'var(--border)'}`,
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all var(--t-fast)',
                cursor: 'pointer',
                minHeight: 0,
            }}
        >
            <HandIcon hand={hand} />
            {label}
        </button>
    );
}

function HandIcon({ hand }) {
    // Simple hand SVG (mirrored for left)
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={hand === 'left' ? { transform: 'scaleX(-1)' } : undefined}
            aria-hidden
        >
            <path d="M9 11v-7a2 2 0 1 1 4 0v7" />
            <path d="M13 11v-2a2 2 0 1 1 4 0v6" />
            <path d="M17 14v-1a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 18V5a2 2 0 1 1 4 0v6" />
        </svg>
    );
}

function EmptyState({ isMobile, hasSong, title }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: isMobile ? 'calc(100vh - 120px)' : '60vh',
                padding: '2rem 1.5rem',
                gap: '1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
            }}
        >
            <div
                aria-hidden="true"
                style={{
                    width: 120,
                    height: 80,
                    border: '1.5px solid var(--border)',
                    borderRadius: 6,
                    background:
                        'linear-gradient(to bottom, transparent 0 18%, var(--border) 18% 22%, transparent 22% 38%, var(--border) 38% 42%, transparent 42% 58%, var(--border) 58% 62%, transparent 62% 78%, var(--border) 78% 82%, transparent 82%)',
                    opacity: 0.5,
                }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                Partition
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: 360, lineHeight: 1.5 }}>
                {hasSong
                    ? <>Le morceau <strong>{title}</strong> n'a pas encore de notes.<br />Ajoute des phrases dans l'éditeur pour voir la partition.</>
                    : <>Apprentissage en lecture sur portée musicale.<br />Charge un morceau dans la Bibliothèque pour voir sa partition.</>
                }
            </p>
        </div>
    );
}
