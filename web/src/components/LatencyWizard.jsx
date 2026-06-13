import { useState, useRef, useEffect, useCallback } from 'react';
import { audioEngine } from '../services/AudioEngine';

/**
 * LatencyWizard — guided audio/visual latency calibration.
 *
 * Why this exists: on macOS (Tauri/WKWebView) scheduled audio is HEARD
 * baseLatency+outputLatency after its scheduled audio-clock time, while the
 * LivePlay canvas playhead tracks the raw audio clock. So the sound lags the
 * picture. This wizard measures that gap by ear/eye.
 *
 * Two passes, same steady rhythm:
 *   AUDIO   — schedule clicks on the audio clock; user taps to what they HEAR.
 *   VISUAL  — flash a dot on performance.now() via rAF; user taps to what they SEE.
 *
 * The human's own reaction/anticipation time is (statistically) the same in
 * both passes, so it CANCELS when we subtract:
 *   avOffsetMs = audioOffset − visualOffset   (positive = sound after image)
 *
 * Clock mapping: audio events are scheduled in the Tone/audio-context clock
 * (seconds) but taps are recorded in performance.now() (ms). We sample both
 * clocks at the SAME instant once at pass start:
 *   clockOffsetMs = perfNowMs − toneNowSec * 1000
 * Then any scheduled audio-clock time toneSec maps into the perf timebase as:
 *   scheduledPerfMs = toneSec * 1000 + clockOffsetMs
 */

const TOTAL_CLICKS = 8;     // scheduled beats per pass
const WARMUP = 2;           // first N beats are warmup — not scored
const PERIOD_MS = 600;      // spacing between beats
const LEAD_MS = 700;        // delay before the first beat so the user can settle

function median(arr) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function LatencyWizard({ onClose }) {
    // 'intro' | 'audio' | 'visual' | 'result'
    const [phase, setPhase] = useState('intro');
    const [tapCount, setTapCount] = useState(0);
    const [flashOn, setFlashOn] = useState(false);
    const [audioOffset, setAudioOffset] = useState(null);   // ms
    const [visualOffset, setVisualOffset] = useState(null); // ms
    const [savedOffset, setSavedOffset] = useState(() => {
        const raw = localStorage.getItem('piano-teacher-av-offset-ms');
        const v = raw === null ? NaN : parseFloat(raw);
        return Number.isFinite(v) ? v : null;
    });

    // Refs: scheduled tap targets in the performance.now() timebase, and taps.
    const scheduledPerfRef = useRef([]); // ms (one per non-warmup beat)
    const tapsRef = useRef([]);          // perf-now ms of each user tap
    const rafRef = useRef(null);
    const timersRef = useRef([]);
    const flashEndTimerRef = useRef(null);
    const audioReadyRef = useRef(false);

    const autoEstimateMs = Math.round(audioEngine.getAutoAvOffsetSeconds() * 1000);

    const clearAll = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (flashEndTimerRef.current) clearTimeout(flashEndTimerRef.current);
        flashEndTimerRef.current = null;
    }, []);

    useEffect(() => () => clearAll(), [clearAll]);

    // Pair each scheduled beat (perf ms) with its nearest tap (within half a
    // period) and return the median signed difference (tap − scheduled), in ms.
    const computeOffset = useCallback(() => {
        const scheduled = scheduledPerfRef.current;
        const taps = tapsRef.current;
        const diffs = [];
        for (const sched of scheduled) {
            let best = null;
            let bestAbs = Infinity;
            for (const tap of taps) {
                const d = tap - sched;
                if (Math.abs(d) < bestAbs && Math.abs(d) <= PERIOD_MS / 2) {
                    bestAbs = Math.abs(d);
                    best = d;
                }
            }
            if (best !== null) diffs.push(best);
        }
        return diffs.length ? median(diffs) : null;
    }, []);

    const finishAudioPass = useCallback(() => {
        clearAll();
        setAudioOffset(computeOffset());
        setPhase('audioDone');
    }, [clearAll, computeOffset]);

    const finishVisualPass = useCallback(() => {
        clearAll();
        setVisualOffset(computeOffset());
        setPhase('result');
    }, [clearAll, computeOffset]);

    // (finishVisualPass shares computeOffset with the audio pass — taps are
    // matched to their nearest scheduled beat the same way in both.)

    // ── AUDIO pass ───────────────────────────────────────────────────────────
    const startAudioPass = useCallback(async () => {
        await audioEngine.initialize();
        const Tone = audioEngine.getTone();
        const clock = audioEngine.getClock(); // () => toneSec

        setPhase('audio');
        setTapCount(0);
        tapsRef.current = [];
        scheduledPerfRef.current = [];

        // Sample BOTH clocks at the same instant to map audio-clock → perf.
        const toneNow = clock();
        const perfNow = performance.now();
        const clockOffsetMs = perfNow - toneNow * 1000;

        // First scheduled beat sits LEAD_MS in the future (audio-clock).
        const firstToneSec = toneNow + LEAD_MS / 1000;

        if (Tone && Tone.context && Tone.context.state !== 'running') {
            try { await Tone.start(); } catch { /* gesture already happened */ }
        }
        audioReadyRef.current = true;

        for (let i = 0; i < TOTAL_CLICKS; i++) {
            const toneSec = firstToneSec + (i * PERIOD_MS) / 1000;
            // Schedule the click at the exact audio-clock time.
            audioEngine.playClick(toneSec, i % 4 === 0);
            // Record the SCHEDULED tap target (in perf timebase) for scored beats.
            if (i >= WARMUP) {
                scheduledPerfRef.current.push(toneSec * 1000 + clockOffsetMs);
            }
        }

        // Finish a little after the last scheduled beat is heard.
        const lastDelayMs = LEAD_MS + (TOTAL_CLICKS - 1) * PERIOD_MS + 500;
        timersRef.current.push(setTimeout(() => finishAudioPass(), lastDelayMs));
    }, [finishAudioPass]);

    // ── VISUAL pass ──────────────────────────────────────────────────────────
    const startVisualPass = useCallback(() => {
        setPhase('visual');
        setTapCount(0);
        tapsRef.current = [];
        scheduledPerfRef.current = [];
        setFlashOn(false);

        // Schedule flashes on performance.now() driven by rAF.
        const startPerf = performance.now();
        const flashTimes = [];
        for (let i = 0; i < TOTAL_CLICKS; i++) {
            const t = startPerf + LEAD_MS + i * PERIOD_MS;
            flashTimes.push({ at: t, idx: i, fired: false });
            if (i >= WARMUP) scheduledPerfRef.current.push(t);
        }

        const FLASH_MS = 90;
        const tick = () => {
            const now = performance.now();
            for (const f of flashTimes) {
                if (!f.fired && now >= f.at) {
                    f.fired = true;
                    setFlashOn(true);
                    if (flashEndTimerRef.current) clearTimeout(flashEndTimerRef.current);
                    flashEndTimerRef.current = setTimeout(() => setFlashOn(false), FLASH_MS);
                }
            }
            const lastAt = flashTimes[flashTimes.length - 1].at;
            if (now < lastAt + 500) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                finishVisualPass();
            }
        };
        rafRef.current = requestAnimationFrame(tick);
    }, [finishVisualPass]);

    // ── Tap handler (shared by both passes) ──────────────────────────────────
    const handleTap = useCallback(() => {
        if (phase === 'audio' || phase === 'visual') {
            tapsRef.current.push(performance.now());
            setTapCount(tapsRef.current.length);
        }
    }, [phase]);

    // Allow the spacebar as a tap during a pass.
    useEffect(() => {
        if (phase !== 'audio' && phase !== 'visual') return;
        const onKey = (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                handleTap();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phase, handleTap]);

    const avOffset =
        audioOffset !== null && visualOffset !== null
            ? Math.round(audioOffset - visualOffset)
            : null;

    const applyOffset = (ms) => {
        audioEngine.setAvOffsetMs(ms);
        setSavedOffset(ms === null ? null : Math.round(ms));
    };

    // ── Styles (design tokens only) ──────────────────────────────────────────
    const panel = {
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        marginTop: '1rem',
        border: '1px solid var(--border-color)'
    };
    const bigButton = (bg) => ({
        width: '100%',
        padding: '1rem',
        background: bg,
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 600
    });
    const tapButton = {
        width: '100%',
        minHeight: '160px',
        background: 'var(--accent)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: '1.5rem',
        fontWeight: 700,
        userSelect: 'none',
        touchAction: 'manipulation'
    };
    const subtle = { fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 };

    return (
        <div style={panel}>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
                Assistant de calibration audio / visuel
            </h4>

            {phase === 'intro' && (
                <>
                    <p style={subtle}>
                        Sur macOS, le son peut arriver légèrement après l'image dans le mode
                        notes qui tombent. Cet assistant mesure ce décalage en deux étapes :
                    </p>
                    <ol style={{ ...subtle, paddingLeft: '1.25rem' }}>
                        <li><strong>Audio</strong> : tape le gros bouton en rythme avec ce que tu <strong>entends</strong>.</li>
                        <li><strong>Visuel</strong> : tape en rythme avec le point qui <strong>clignote</strong>.</li>
                    </ol>
                    <p style={{ ...subtle, fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                        Ton temps de réaction s'annule entre les deux étapes : on ne garde que le
                        décalage son/image.
                    </p>
                    <div style={{ marginBottom: '0.75rem', ...subtle }}>
                        Estimation auto (système) : <strong>{autoEstimateMs} ms</strong>
                        {savedOffset !== null && (
                            <> · Réglage enregistré : <strong>{savedOffset} ms</strong></>
                        )}
                    </div>
                    <button style={bigButton('var(--accent-success)')} onClick={startAudioPass}>
                        Commencer (étape 1 : audio)
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{ ...bigButton('var(--surface-elev)'), color: 'var(--text-primary)', marginTop: '0.5rem' }}
                        >
                            Fermer
                        </button>
                    )}
                </>
            )}

            {phase === 'audio' && (
                <>
                    <p style={{ ...subtle, textAlign: 'center', marginBottom: '0.75rem' }}>
                        Tape le bouton à chaque <strong>bip</strong> que tu entends.
                    </p>
                    <button style={tapButton} onClick={handleTap}>
                        TAPE !<br />
                        <span style={{ fontSize: '1rem', fontWeight: 400 }}>{tapCount} tapes</span>
                    </button>
                </>
            )}

            {phase === 'audioDone' && (
                <>
                    <p style={{ ...subtle, textAlign: 'center' }}>
                        Étape audio terminée
                        {audioOffset !== null ? ` (${Math.round(audioOffset)} ms)` : ' (aucune tape détectée)'}.
                        <br />Passe maintenant à l'étape visuelle.
                    </p>
                    <button style={bigButton('var(--accent-success)')} onClick={startVisualPass}>
                        Commencer (étape 2 : visuel)
                    </button>
                </>
            )}

            {phase === 'visual' && (
                <>
                    <p style={{ ...subtle, textAlign: 'center', marginBottom: '0.75rem' }}>
                        Tape le bouton à chaque <strong>clignotement</strong>.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                        <div
                            style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                background: flashOn ? 'var(--warning)' : 'var(--surface-elev)',
                                boxShadow: flashOn ? '0 0 40px var(--warning)' : 'none',
                                transition: 'none'
                            }}
                        />
                    </div>
                    <button style={tapButton} onClick={handleTap}>
                        TAPE !<br />
                        <span style={{ fontSize: '1rem', fontWeight: 400 }}>{tapCount} tapes</span>
                    </button>
                </>
            )}

            {phase === 'result' && (
                <>
                    {avOffset !== null ? (
                        <div style={{
                            background: 'var(--surface-elev)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            textAlign: 'center',
                            marginBottom: '1rem'
                        }}>
                            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                                {avOffset} ms
                            </div>
                            <div style={subtle}>
                                {avOffset >= 0
                                    ? `Le son arrive ~${avOffset} ms après l'image.`
                                    : `L'image arrive ~${-avOffset} ms après le son.`}
                            </div>
                            <div style={{ ...subtle, marginTop: '0.5rem', color: 'var(--text-tertiary)' }}>
                                audio {Math.round(audioOffset)} ms − visuel {Math.round(visualOffset)} ms
                            </div>
                        </div>
                    ) : (
                        <p style={{ ...subtle, textAlign: 'center', color: 'var(--warning)' }}>
                            Mesure incomplète — pas assez de tapes détectées. Réessaie en tapant
                            sur chaque signal.
                        </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {avOffset !== null && (
                            <button
                                style={bigButton('var(--accent-success)')}
                                onClick={() => { applyOffset(Math.max(0, Math.min(500, avOffset))); }}
                            >
                                Appliquer ({Math.max(0, Math.min(500, avOffset))} ms)
                            </button>
                        )}
                        <button
                            style={{ ...bigButton('var(--surface-elev)'), color: 'var(--text-primary)' }}
                            onClick={() => applyOffset(null)}
                        >
                            Réinitialiser (auto : {autoEstimateMs} ms)
                        </button>
                        <button
                            style={{ ...bigButton('var(--surface-elev)'), color: 'var(--text-primary)' }}
                            onClick={() => { setPhase('intro'); setAudioOffset(null); setVisualOffset(null); }}
                        >
                            Recommencer
                        </button>
                        {savedOffset !== null && (
                            <div style={{ ...subtle, textAlign: 'center', color: 'var(--accent-success)' }}>
                                Réglage actif : {savedOffset} ms
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
