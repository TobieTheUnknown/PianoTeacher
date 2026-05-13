import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    flattenSongMeasures,
    renderMeasure,
    suggestUpperOctaveShift,
    suggestLowerOctaveShift,
    TREBLE_CLEF,
    BASS_CLEF,
    toKotlinKeySig,
    normalizePitch,
    midiToDiatonic,
} from '../utils/sheetMusic';

/**
 * Sheet Music Learning — pixel-fidelity port of LearningScreen.kt's
 * GrandStaffCanvas, on HTML5 canvas.
 *
 * Renders the song as a row of measure cards, each with a grand staff
 * (treble + bass clef). Notes are drawn at their startTime fraction within
 * the measure. Black keys get an inline #/♭ accidental.
 *
 * No playback / focus tracking yet — read-only viewer. Phase 3 hooks up
 * highlighting and audio playback.
 */
export function SheetMusicLearning({ song, isMobile = false }) {
    const beatsPerMeasure = song?.timeSignature?.numerator || 4;
    const measures = useMemo(
        () => flattenSongMeasures(song, beatsPerMeasure),
        [song, beatsPerMeasure]
    );

    // Smart octave shift heuristics — applied to the whole song to reduce
    // ledger lines. Computed once across all chord/melody notes.
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
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '0.5rem' : '0.75rem',
                padding: isMobile ? '0.75rem 0' : '1rem 0',
                minHeight: isMobile ? 'calc(100vh - 120px)' : '60vh',
            }}
        >
            <Header song={song} measureCount={measures.length} isMobile={isMobile} />
            <MeasureRow
                measures={measures}
                song={song}
                beatsPerMeasure={beatsPerMeasure}
                useFlats={useFlats}
                upperShift={upperShift}
                lowerShift={lowerShift}
                isMobile={isMobile}
            />
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Header({ song, measureCount, isMobile }) {
    return (
        <div
            style={{
                padding: isMobile ? '0 1rem' : '0 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
            }}
        >
            <h2
                style={{
                    margin: 0,
                    fontSize: isMobile ? '1.125rem' : '1.5rem',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                }}
            >
                {song.title || 'Sans titre'}
            </h2>
            <div
                style={{
                    display: 'flex',
                    gap: '0.75rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                }}
            >
                <span>{measureCount} mesure{measureCount > 1 ? 's' : ''}</span>
                {song.key && <span>· {song.key.note} {song.key.mode === 'minor' ? 'mineur' : 'majeur'}</span>}
                {song.tempo && <span>· {song.tempo} BPM</span>}
                {song.timeSignature && (
                    <span>· {song.timeSignature.numerator}/{song.timeSignature.denominator}</span>
                )}
            </div>
        </div>
    );
}

function MeasureRow({ measures, song, beatsPerMeasure, useFlats, upperShift, lowerShift, isMobile }) {
    // Detect phrase boundaries so the first measure of each phrase shows clefs.
    const phraseStarts = useMemo(() => {
        const set = new Set();
        let lastPhrase = -1;
        measures.forEach((m, i) => {
            if (m.phraseIndex !== lastPhrase) {
                set.add(i);
                lastPhrase = m.phraseIndex;
            }
        });
        return set;
    }, [measures]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                overflowX: 'auto',
                overflowY: 'hidden',
                gap: '4px',
                padding: isMobile ? '0 1rem' : '0 1.5rem',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
            }}
        >
            {measures.map((m, i) => (
                <MeasureCard
                    key={`${m.phraseIndex}-${m.measureIndex}`}
                    measureData={m}
                    measureNumber={i + 1}
                    showClefs={phraseStarts.has(i)}
                    beatsPerMeasure={beatsPerMeasure}
                    useFlats={useFlats}
                    upperShift={upperShift}
                    lowerShift={lowerShift}
                    keySig={song.key}
                    isMobile={isMobile}
                />
            ))}
        </div>
    );
}

function MeasureCard({
    measureData,
    measureNumber,
    showClefs,
    beatsPerMeasure,
    useFlats,
    upperShift,
    lowerShift,
    keySig,
    isMobile,
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    // Card width: clef cards are wider to fit the clef + key signature area.
    const baseWidth = isMobile ? 132 : 168;
    const clefExtra = showClefs ? (isMobile ? 38 : 48) : 0;
    const cardWidth = baseWidth + clefExtra;
    const cardHeight = isMobile ? 240 : 280;

    // Observe container size for DPR-aware canvas sizing.
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

    // Render whenever inputs or dims change.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || dims.w === 0 || dims.h === 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(dims.w * dpr);
        canvas.height = Math.floor(dims.h * dpr);
        canvas.style.width = `${dims.w}px`;
        canvas.style.height = `${dims.h}px`;

        const ctx = canvas.getContext('2d');
        // Reset transform then apply DPR scale.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, dims.w, dims.h);

        renderMeasure(ctx, {
            width: dims.w,
            height: dims.h,
            measureNumber,
            melodyNotes: measureData.melodyNotes,
            chordNotes: measureData.chordNotes,
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
            dp: (n) => n, // CSS px = dp on web (DPR is applied via scale())
        });
    }, [
        dims, measureNumber, measureData, beatsPerMeasure, useFlats,
        showClefs, upperShift, lowerShift, keySig,
    ]);

    return (
        <div
            ref={containerRef}
            style={{
                flex: `0 0 ${cardWidth}px`,
                width: cardWidth,
                height: cardHeight,
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                borderRadius: 8,
                scrollSnapAlign: 'start',
                position: 'relative',
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
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
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 6,
                    background:
                        'linear-gradient(to bottom, transparent 0 18%, var(--border-color) 18% 22%, transparent 22% 38%, var(--border-color) 38% 42%, transparent 42% 58%, var(--border-color) 58% 62%, transparent 62% 78%, var(--border-color) 78% 82%, transparent 82%)',
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
