import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    flattenSongMeasures,
    renderMeasure,
    resolveSheetTheme,
    suggestUpperOctaveShift,
    suggestLowerOctaveShift,
    TREBLE_CLEF,
    BASS_CLEF,
    toKotlinKeySig,
} from '../utils/sheetMusic';
import { PlaybackDock } from './PlaybackDock';
import { MobileHeader } from './MobileHeader';
import { audioEngine } from '../services/AudioEngine';

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
// Compact toolbar pill — shared by key / time-signature / tempo chips.
const TOOLBAR_PILL = {
    padding: '5px 10px',
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    fontSize: 12,
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    height: 30,
    boxSizing: 'border-box',
};

/**
 * Resolve the canvas colour palette from the live CSS theme tokens so the
 * engraving follows the theme editor (accent + hand-colour presets). Re-resolves
 * when the theme/accent/hands data-attributes change on <html>.
 */
function useSheetTheme() {
    const [theme, setTheme] = useState(() =>
        resolveSheetTheme(typeof document !== 'undefined' ? document.documentElement : null)
    );
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const update = () => setTheme(resolveSheetTheme(root));
        update();
        const mo = new MutationObserver(update);
        mo.observe(root, {
            attributes: true,
            attributeFilter: ['data-theme', 'data-accent', 'data-hands'],
        });
        return () => mo.disconnect();
    }, []);
    return theme;
}

export function SheetMusicLearning({ song, isMobile = false }) {
    const sheetTheme = useSheetTheme();
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

    // Playback / view state
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(100);
    const [handMode, setHandMode] = useState('both');   // 'left' | 'right' | 'both'
    const [currentMeasure, setCurrentMeasure] = useState(1);
    const [measureProgress, setMeasureProgress] = useState(0); // 0..1 within current measure
    const [metronome, setMetronome] = useState(false);
    const [metronomeSubdivision, setMetronomeSubdivision] = useState('quarter');
    const [loop, setLoop] = useState(false);
    const [loopRange, setLoopRange] = useState([1, 1]);
    const [loopEditorOpen, setLoopEditorOpen] = useState(false);

    // Details toggle — persisted in localStorage, OFF by default (stemless view)
    const LS_KEY = 'piano-teacher-sheet-details';
    const [showDetails, setShowDetails] = useState(() => {
        try { return localStorage.getItem(LS_KEY) === 'true'; } catch { return false; }
    });
    const handleToggleDetails = () => {
        setShowDetails((prev) => {
            const next = !prev;
            try { localStorage.setItem(LS_KEY, String(next)); } catch { /* ignore */ }
            return next;
        });
    };

    // Stop the metronome when the user toggles it off mid-playback or
    // unmounts the page. We DON'T start it on toggle — the metronome
    // should only tick during actual playback (after the preroll), like
    // on the Apprentissage page.
    useEffect(() => {
        if (!metronome) {
            audioEngine.stopMetronome();
        }
        return () => audioEngine.stopMetronome();
    }, [metronome]);

    // Concat phrases into one playable phrase so the dock's play button
    // drives the whole partition.
    const combinedPhrase = useMemo(() => {
        if (!song || !song.phrases || song.phrases.length === 0) return null;
        const melody = [];
        const chords = [];
        let beatOffset = 0;
        const bpm = song.timeSignature?.numerator || 4;
        song.phrases.forEach((phrase) => {
            phrase.tracks.melody.forEach((n) => {
                melody.push({ ...n, startTime: n.startTime + beatOffset });
            });
            phrase.tracks.chords.forEach((n) => {
                chords.push({ ...n, startTime: n.startTime + beatOffset });
            });
            beatOffset += phrase.length * bpm;
        });
        return {
            tracks: { melody, chords },
            length: song.phrases.reduce((s, p) => s + p.length, 0),
        };
    }, [song]);

    // Phrase ranges (1-indexed measure bounds) — used by the loop editor's
    // quick-pick dropdown.
    const phraseMeasureRanges = useMemo(() => {
        if (!song || !song.phrases) return [];
        let startMeasure = 1;
        return song.phrases.map((phrase, index) => {
            const endMeasure = startMeasure + phrase.length - 1;
            const range = {
                name: phrase.name || `Phrase ${index + 1}`,
                startMeasure,
                endMeasure,
            };
            startMeasure = endMeasure + 1;
            return range;
        });
    }, [song]);

    // Capture the starting measure when playback begins so the tick loop
    // doesn't depend on `currentMeasure` (which it itself updates).
    const startMeasureRef = useRef(1);
    useEffect(() => { startMeasureRef.current = currentMeasure; }, [currentMeasure]);

    // Track Transport position during playback to drive the playhead.
    // Uses getMusicSeconds() which subtracts the metronome preroll so the
    // playhead only starts moving when the music actually plays.
    const measuresLen = measures.length;
    useEffect(() => {
        if (!playing) return;
        const beatsPerMeasureLocal = song?.timeSignature?.numerator || 4;
        const tempo = Math.max(20, Math.round((song?.tempo || 120) * (speed / 100)));
        const secondsPerBeat = 60 / tempo;
        const secondsPerMeasure = secondsPerBeat * beatsPerMeasureLocal;
        const startBeats = (Math.max(1, startMeasureRef.current) - 1) * beatsPerMeasureLocal;
        const startOffsetSec = startBeats * secondsPerBeat;
        let raf;
        const tick = () => {
            const musicT = audioEngine.getMusicSeconds(); // negative during preroll
            if (musicT < 0) {
                setMeasureProgress(0);
            } else {
                const absoluteT = startOffsetSec + musicT;
                const beatIdx = absoluteT / secondsPerBeat;
                const measureIdx = Math.floor(beatIdx / beatsPerMeasureLocal) + 1;
                const within = (absoluteT - (measureIdx - 1) * secondsPerMeasure) / secondsPerMeasure;
                setCurrentMeasure(Math.max(1, Math.min(measuresLen, measureIdx)));
                setMeasureProgress(Math.max(0, Math.min(1, within)));
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing, song, speed, measuresLen]);

    // Refs let the loop callback see the latest state without re-creating
    // handlePlayPause on every state change.
    const loopRef = useRef(loop);
    const loopRangeRef = useRef(loopRange);
    useEffect(() => { loopRef.current = loop; }, [loop]);
    useEffect(() => { loopRangeRef.current = loopRange; }, [loopRange]);

    // Tap a measure → position the playhead at it AND play that single
    // measure as a preview. Subsequent Play picks up from currentMeasure.
    const handleMeasureClick = useCallback(async (measureNumber) => {
        const idx = measureNumber - 1;
        if (idx < 0 || idx >= measures.length) return;
        await audioEngine.initialize();
        if (playing) {
            audioEngine.stop();
            audioEngine.stopMetronome();
            setPlaying(false);
        }
        setCurrentMeasure(measureNumber);
        const m = measures[idx];
        const tempo = Math.max(20, Math.round((song?.tempo || 120) * (speed / 100)));
        let notes = [];
        if (handMode !== 'left') notes = notes.concat(m.melodyNotes);
        if (handMode !== 'right') notes = notes.concat(m.chordNotes);
        if (notes.length > 0) audioEngine.playNotes(notes, tempo);
    }, [measures, playing, song, speed, handMode]);

    // Restart: stop any active playback and seek back to measure 1.
    const handleRestart = useCallback(() => {
        if (playing) {
            audioEngine.stop();
            audioEngine.stopMetronome();
            setPlaying(false);
        }
        setCurrentMeasure(1);
        setMeasureProgress(0);
    }, [playing]);

    const handlePlayPause = useCallback(async () => {
        await audioEngine.initialize();
        if (playing) {
            audioEngine.stop();
            audioEngine.stopMetronome();
            setPlaying(false);
            return;
        }
        if (!combinedPhrase) return;

        const beatsPerMeasure = song?.timeSignature?.numerator || 4;
        const tempo = Math.max(20, Math.round((song?.tempo || 120) * (speed / 100)));
        let filteredAll = combinedPhrase;
        if (handMode === 'right') {
            filteredAll = { ...combinedPhrase, tracks: { melody: combinedPhrase.tracks.melody, chords: [] } };
        } else if (handMode === 'left') {
            filteredAll = { ...combinedPhrase, tracks: { melody: [], chords: combinedPhrase.tracks.chords } };
        }

        // Slice the phrase to a loop sub-range when looping is on.
        const buildPhrase = (startMeasure, endMeasure) => {
            const startUnit = (startMeasure - 1) * 4;
            const endUnit = endMeasure * 4;
            const inRange = (n) => n.startTime >= startUnit && n.startTime < endUnit;
            return {
                tracks: {
                    melody: filteredAll.tracks.melody.filter(inRange),
                    chords: filteredAll.tracks.chords.filter(inRange),
                },
                length: endMeasure - startMeasure + 1,
            };
        };

        // Start the running metronome BEFORE playPhrase so it ticks
        // through both the preroll and the music when enabled.
        if (metronome) {
            audioEngine.startMetronome(tempo, metronomeSubdivision);
        }

        const playRange = (startMeasure, endMeasure, withPreroll) => {
            const phrase = buildPhrase(startMeasure, endMeasure);
            const startBeats = 0; // phrase already starts at 0 after slicing
            // Translate note times so the slice starts at 0 in the phrase.
            const startUnit = (startMeasure - 1) * 4;
            const shifted = {
                tracks: {
                    melody: phrase.tracks.melody.map((n) => ({ ...n, startTime: n.startTime - startUnit })),
                    chords: phrase.tracks.chords.map((n) => ({ ...n, startTime: n.startTime - startUnit })),
                },
                length: phrase.length,
            };
            audioEngine.playPhrase(
                shifted,
                tempo,
                startBeats,
                true,
                () => {
                    // When the slice ends: restart from loop start if loop is
                    // still on, otherwise stop.
                    if (loopRef.current) {
                        const [a, b] = loopRangeRef.current || [1, measures.length];
                        setCurrentMeasure(a);
                        playRange(a, b, false);
                    } else {
                        setPlaying(false);
                    }
                },
                beatsPerMeasure,
                { preroll: withPreroll && metronome },
            );
        };

        const start = Math.max(1, currentMeasure);
        if (loop) {
            const [a, b] = loopRange[1] > 1 ? loopRange : [1, measures.length];
            const safeStart = start >= a && start <= b ? start : a;
            setCurrentMeasure(safeStart);
            playRange(safeStart, b, true);
        } else {
            playRange(start, measures.length, true);
        }
        setPlaying(true);
    }, [playing, combinedPhrase, song, speed, handMode, currentMeasure, metronome, metronomeSubdivision, loop, loopRange, measures]);

    const totalMeasures = measures.length;
    const tsText = song?.timeSignature
        ? `${song.timeSignature.numerator}/${song.timeSignature.denominator}`
        : '';
    const keyText = song?.key
        ? `${song.key.note} ${song.key.mode === 'minor' ? 'mineur' : 'majeur'}`
        : '—';
    const bpm = song?.tempo || 120;

    // Group measures into systems of 4 — keep this BEFORE the early return
    // so the hook call order stays stable across renders that hit/miss the
    // empty-song branch (React would otherwise crash on subsequent mounts).
    const SYSTEM_SIZE = 4;
    const systems = useMemo(() => {
        const out = [];
        for (let i = 0; i < measures.length; i += SYSTEM_SIZE) {
            out.push(measures.slice(i, i + SYSTEM_SIZE));
        }
        return out;
    }, [measures]);

    if (!song || song.phrases?.length === 0 || measures.length === 0) {
        return (
            <EmptyState
                isMobile={isMobile}
                hasSong={!!song && song.phrases?.length > 0}
                title={song?.title}
            />
        );
    }

    return (
        <div style={{
            // Clear the fixed PlaybackDock (~130px) plus the mobile tab bar
            // (64px) and the device safe-area inset so nothing hides behind it.
            paddingBottom: `calc(${130 + (isMobile ? 64 : 0)}px + env(safe-area-inset-bottom, 0px))`,
        }}>
            <MobileHeader
                title={song.title || 'Sans titre'}
                subtitle={`Mesure ${currentMeasure}/${totalMeasures}${tsText ? ` · ${tsText}` : ''}`}
            />

            {/* Scrollable content */}
            <div style={{
                padding: '4px 16px 12px',
            }}>
                {/* Compact toolbar — key · time signature · tempo. Sizes to
                    content (no full-width stretch) and wraps on narrow mobile. */}
                <div style={{
                    display: 'flex',
                    gap: 6,
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                }}>
                    {/* Key signature */}
                    <span style={TOOLBAR_PILL}>
                        <span style={{
                            fontFamily: '"Noto Music", "Bravura", serif',
                            fontSize: 15,
                            lineHeight: 1,
                            color: 'var(--text-secondary)',
                        }}>
                            {useFlats ? '♭' : '♯'}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{keyText}</span>
                    </span>

                    {/* Time signature */}
                    {tsText && (
                        <span style={TOOLBAR_PILL}>
                            <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 10,
                                lineHeight: 0.95,
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                color: 'var(--text-primary)',
                                fontWeight: 700,
                            }}>
                                <span>{tsText.split('/')[0]}</span>
                                <span>{tsText.split('/')[1]}</span>
                            </span>
                        </span>
                    )}

                    {/* Tempo */}
                    <span style={{ ...TOOLBAR_PILL, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>♩</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>= {bpm}</span>
                    </span>

                    {/* Détails toggle — shows/hides stems, flags, augmentation dots */}
                    <button
                        onClick={handleToggleDetails}
                        style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 'var(--r-pill)',
                            border: `1px solid ${showDetails ? 'var(--accent)' : 'var(--border)'}`,
                            background: showDetails ? 'var(--accent-dim)' : 'transparent',
                            color: showDetails ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            minHeight: 0,
                            height: 30,
                            boxSizing: 'border-box',
                            transition: 'all var(--t-fast)',
                        }}
                    >
                        Détails
                    </button>
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
                            measureProgress={measureProgress}
                            isPlaying={playing}
                            isMobile={isMobile}
                            sheetTheme={sheetTheme}
                            showDetails={showDetails}
                            onMeasureClick={handleMeasureClick}
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

            {/* Shared PlaybackDock — fixed to viewport bottom */}
            <div style={{
                position: 'fixed',
                bottom: isMobile ? 64 : 0,
                left: 0,
                right: 0,
                zIndex: 1000,
            }}>
            <PlaybackDock
                playing={playing}
                onPlayPause={handlePlayPause}
                onRestart={handleRestart}
                speed={speed}
                onSpeed={setSpeed}
                handMode={handMode}
                onHandMode={setHandMode}
                metronome={metronome}
                onMetronome={() => setMetronome((m) => !m)}
                metronomeSubdivision={metronomeSubdivision}
                onMetronomeSubdivisionChange={setMetronomeSubdivision}
                loop={loop}
                onLoop={() => setLoop((l) => !l)}
                loopRange={loopRange[1] > 1 ? loopRange : [1, totalMeasures]}
                onLoopRange={setLoopRange}
                loopEditorOpen={loopEditorOpen}
                onToggleLoopEditor={() => setLoopEditorOpen((o) => !o)}
                totalMeasures={totalMeasures}
                phrases={phraseMeasureRanges}
                onPrev={() => setCurrentMeasure((m) => Math.max(1, m - 1))}
                onNext={() => setCurrentMeasure((m) => Math.min(totalMeasures, m + 1))}
            />
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SheetSystem({
    systemIndex, systemSize, measures, beatsPerMeasure,
    useFlats, upperShift, lowerShift, keySig, handMode, currentMeasure,
    measureProgress = 0, isPlaying = false, isMobile, sheetTheme, showDetails, onMeasureClick,
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
                const isCurrent = globalIdx === currentMeasure;
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
                        isCurrent={isCurrent}
                        playheadFrac={isCurrent && isPlaying ? measureProgress : null}
                        isLast={i === measures.length - 1}
                        flex={i === 0 ? '1.4 1 0' : '1 1 0'}
                        height={isMobile ? 132 : 224}
                        sheetTheme={sheetTheme}
                        showDetails={showDetails}
                        onClick={onMeasureClick ? () => onMeasureClick(globalIdx) : undefined}
                    />
                );
            })}
        </div>
    );
}

function SystemMeasure({
    measureData, measureNumber, showClefs, beatsPerMeasure, useFlats,
    upperShift, lowerShift, keySig, handMode, isCurrent, playheadFrac,
    isLast, flex, height, sheetTheme, showDetails, onClick,
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
            isFocused: false,
            clefMode: 'STANDARD',
            upperOctaveShift: upperShift,
            lowerOctaveShift: lowerShift,
            keySig,
            isLandscape: false,
            dp: (n) => n,
            theme: sheetTheme,
            showStems: showDetails,
            // Playhead drawn inside the note area (skips clefs) so it
            // aligns exactly with note X positions.
            playheadFrac: playheadFrac != null ? playheadFrac : null,
        });
    }, [
        dims, measureNumber, visibleMelody, visibleChords, beatsPerMeasure,
        useFlats, showClefs, upperShift, lowerShift, keySig, isCurrent,
        playheadFrac, measureData.measureStart, sheetTheme, showDetails,
    ]);

    return (
        <div
            ref={containerRef}
            onClick={onClick}
            style={{
                flex,
                minWidth: 0,
                height,
                background: 'transparent',
                borderRight: isLast ? 'none' : '1px solid var(--border)',
                position: 'relative',
                cursor: onClick ? 'pointer' : 'default',
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {isCurrent && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--accent-dim)',
                    boxShadow: 'inset 2px 0 0 0 var(--accent)',
                    pointerEvents: 'none',
                }} />
            )}
            {/* Playhead is now drawn directly on the canvas inside
                renderMeasure() so it lines up with note X positions
                (after the clef + key signature area). */}
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
