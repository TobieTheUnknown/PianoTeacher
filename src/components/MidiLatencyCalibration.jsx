import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { midiInputService } from '../services/MidiInputService';
import { audioEngine } from '../services/AudioEngine';
// getNoteNameFromMidi removed - not used

/**
 * Visual Scrolling Track Component
 *
 * Guitar Hero / Synthesia style horizontal scrolling track
 * Shows markers moving towards a hit line for visual calibration
 */
function VisualScrollingTrack({ currentBeat, totalBeats, beatInterval }) {
    const [elapsedTime, setElapsedTime] = useState(0);
    const startTimeRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Animation loop to update elapsed time
    useEffect(() => {
        if (startTimeRef.current === null) {
            startTimeRef.current = performance.now();
        }

        const animate = () => {
            const now = performance.now();
            const elapsed = now - startTimeRef.current;
            setElapsedTime(elapsed);
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    const trackWidth = 600; // px
    const trackHeight = 120; // px
    const hitLineX = trackWidth * 0.75; // Hit line at 75% from left
    const anticipationTime = 3000; // 3 seconds ahead visible

    // Generate beat markers
    const beatMarkers = [];
    for (let i = 1; i <= totalBeats; i++) {
        const beatTime = i * beatInterval; // When this beat should hit the line
        const timeUntilHit = beatTime - elapsedTime;

        // Position: map time to position (right to left scrolling)
        // When timeUntilHit = 0, marker should be at hitLineX
        // When timeUntilHit = anticipationTime, marker should be at trackWidth
        const x = hitLineX + (timeUntilHit / anticipationTime) * (trackWidth - hitLineX);

        // Only show markers that are on screen (ahead of the hit line)
        if (x > -50 && x < trackWidth + 50) {
            const isPast = timeUntilHit < -200; // 200ms tolerance
            const isActive = Math.abs(timeUntilHit) < 200; // ±200ms = active zone

            beatMarkers.push({
                beatNumber: i,
                x,
                isPast,
                isActive,
                isDownbeat: i === 1 || i % 4 === 1
            });
        }
    }

    // Generate grid lines (every 500ms)
    const gridLines = [];
    for (let t = 0; t <= anticipationTime; t += 500) {
        const timeUntilHit = t;
        const x = hitLineX + (timeUntilHit / anticipationTime) * (trackWidth - hitLineX);
        if (x >= 0 && x <= trackWidth) {
            gridLines.push({
                x,
                time: t,
                isSecond: t % 1000 === 0
            });
        }
    }

    return (
        <div style={{
            margin: '2rem auto',
            maxWidth: `${trackWidth}px`
        }}>
            {/* Beat counter */}
            <div style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'var(--text-primary)',
                marginBottom: '1rem'
            }}>
                {currentBeat} / {totalBeats}
            </div>

            {/* Track container */}
            <div style={{
                position: 'relative',
                width: `${trackWidth}px`,
                height: `${trackHeight}px`,
                background: 'linear-gradient(to bottom, #1f2937 0%, #111827 100%)',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '2px solid var(--border-color)',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
            }}>
                {/* Grid lines */}
                {gridLines.map((line, idx) => (
                    <div
                        key={idx}
                        style={{
                            position: 'absolute',
                            left: `${line.x}px`,
                            top: 0,
                            bottom: 0,
                            width: line.isSecond ? '2px' : '1px',
                            background: line.isSecond
                                ? 'rgba(255, 255, 255, 0.2)'
                                : 'rgba(255, 255, 255, 0.05)',
                            pointerEvents: 'none'
                        }}
                    />
                ))}

                {/* Beat markers */}
                {beatMarkers.map((marker) => (
                    <div
                        key={marker.beatNumber}
                        style={{
                            position: 'absolute',
                            left: `${marker.x - 15}px`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '30px',
                            height: marker.isDownbeat ? '80px' : '60px',
                            background: marker.isPast
                                ? 'rgba(107, 114, 128, 0.5)'
                                : marker.isActive
                                    ? 'linear-gradient(to bottom, #22c55e, #16a34a)'
                                    : 'linear-gradient(to bottom, #3b82f6, #2563eb)',
                            borderRadius: '6px',
                            border: marker.isDownbeat ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.3)',
                            boxShadow: marker.isActive
                                ? '0 0 20px rgba(34, 197, 94, 0.8)'
                                : '0 2px 4px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            color: 'white',
                            transition: 'none', // No transition for smooth scrolling
                            pointerEvents: 'none'
                        }}
                    >
                        {marker.beatNumber}
                    </div>
                ))}

                {/* Hit line (vertical) */}
                <div style={{
                    position: 'absolute',
                    left: `${hitLineX}px`,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: 'linear-gradient(to bottom, #ef4444, #dc2626)',
                    boxShadow: '0 0 15px rgba(239, 68, 68, 0.8)',
                    pointerEvents: 'none',
                    zIndex: 10
                }} />

                {/* Hit zone indicator */}
                <div style={{
                    position: 'absolute',
                    left: `${hitLineX}px`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60px',
                    height: '100%',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '2px dashed rgba(239, 68, 68, 0.3)',
                    pointerEvents: 'none',
                    zIndex: 1
                }} />
            </div>

            {/* Legend */}
            <div style={{
                marginTop: '1rem',
                display: 'flex',
                justifyContent: 'center',
                gap: '1.5rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '20px',
                        height: '20px',
                        background: 'linear-gradient(to bottom, #3b82f6, #2563eb)',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.3)'
                    }} />
                    <span>Temps à venir</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '20px',
                        height: '20px',
                        background: 'linear-gradient(to bottom, #22c55e, #16a34a)',
                        borderRadius: '4px',
                        boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                    }} />
                    <span>Zone active - Jouez maintenant !</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '4px',
                        height: '20px',
                        background: 'linear-gradient(to bottom, #ef4444, #dc2626)',
                        boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)'
                    }} />
                    <span>Ligne de jeu</span>
                </div>
            </div>
        </div>
    );
}

/**
 * MIDI Latency Calibration Component
 *
 * Measures the latency between visual/audio cues and MIDI input
 * to automatically calibrate the latency compensation setting.
 *
 * Uses a metronome-based approach for predictable rhythm.
 */
export function MidiLatencyCalibration({ onCalibrationComplete, onCancel }) {
    const [phase, setPhase] = useState('intro'); // 'intro', 'countdown', 'calibrating', 'complete'
    const [countdown, setCountdown] = useState(3);
    const [currentBeat, setCurrentBeat] = useState(0);
    const [measurements, setMeasurements] = useState([]);
    const [calibrationType, setCalibrationType] = useState('visual'); // 'visual' or 'audio'
    const [instructions, setInstructions] = useState('');

    const totalBeats = 8; // 8 beats for calibration
    const bpm = 60; // 60 BPM = 1 beat per second
    const beatInterval = (60 / bpm) * 1000; // ms per beat

    const metronomeSynth = useRef(null);
    const metronomeInterval = useRef(null);
    const beatTimestamps = useRef([]);
    const expectedBeatTimes = useRef([]);
    const audioInitialized = useRef(false);

    // Initialize audio
    useEffect(() => {
        const initAudio = async () => {
            if (!audioInitialized.current) {
                await audioEngine.initialize();
                await Tone.start();

                // Create metronome synth
                metronomeSynth.current = new Tone.MembraneSynth({
                    pitchDecay: 0.05,
                    octaves: 10,
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
                }).toDestination();

                audioInitialized.current = true;
            }
        };
        initAudio();

        return () => {
            if (metronomeInterval.current) {
                clearInterval(metronomeInterval.current);
            }
        };
    }, []);

    // MIDI listener during calibration
    useEffect(() => {
        if (phase !== 'calibrating') return;

        // eslint-disable-next-line no-unused-vars
        const handleNoteOn = (event) => {
            const now = performance.now();

            // Record the timestamp of ANY key press during calibration
            beatTimestamps.current.push(now);

            console.log(`Beat ${beatTimestamps.current.length}/${totalBeats} recorded at ${now.toFixed(2)}ms`);
        };

        midiInputService.addEventListener('noteOn', handleNoteOn);
        return () => midiInputService.removeEventListener('noteOn', handleNoteOn);
    }, [phase]);

    const startCountdown = () => {
        setPhase('countdown');
        setCountdown(3);
        setInstructions('Préparez-vous...');

        let count = 3;
        const countdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                setCountdown(count);
                playMetronomeClick(true); // Accent on countdown
            } else {
                clearInterval(countdownTimer);
                startCalibration();
            }
        }, beatInterval);
    };

    const playMetronomeClick = (accent = false) => {
        if (!metronomeSynth.current) return;

        const frequency = accent ? 'C5' : 'C4';
        metronomeSynth.current.triggerAttackRelease(frequency, '8n');
    };

    // playVisualPulse removed - not used (visual pulse handled by beat display)

    const startCalibration = () => {
        setPhase('calibrating');
        setCurrentBeat(0);
        beatTimestamps.current = [];
        expectedBeatTimes.current = [];

        setInstructions(
            calibrationType === 'visual'
                ? '🎵 Jouez UNE NOTE quand le marqueur atteint la ligne !'
                : '🎵 Jouez UNE NOTE sur chaque "bip" !'
        );

        let beat = 0;
        const startTime = performance.now();

        // Start metronome
        metronomeInterval.current = setInterval(() => {
            beat++;

            if (beat <= totalBeats) {
                setCurrentBeat(beat);

                // Record expected beat time
                const expectedTime = startTime + (beat * beatInterval);
                expectedBeatTimes.current.push(expectedTime);

                // Trigger audio cue (only for audio mode)
                if (calibrationType === 'audio') {
                    playMetronomeClick(beat === 1 || beat % 4 === 1);
                }
                // Visual mode: no metronome, just visual scrolling
            } else {
                // Calibration complete
                clearInterval(metronomeInterval.current);
                finishCalibration();
            }
        }, beatInterval);
    };

    const finishCalibration = () => {
        setPhase('complete');

        // Calculate latency from measurements
        const latencies = [];

        // Match each user beat with the closest expected beat
        for (let i = 0; i < Math.min(beatTimestamps.current.length, expectedBeatTimes.current.length); i++) {
            const userTime = beatTimestamps.current[i];
            const expectedTime = expectedBeatTimes.current[i];
            const latency = userTime - expectedTime;
            latencies.push(latency);
        }

        setMeasurements(latencies);

        if (latencies.length === 0) {
            setInstructions('❌ Aucune note détectée ! Réessayez en jouant sur chaque battement.');
            return;
        }

        // Calculate statistics
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);

        // Calculate compensation (negative of the measured latency)
        const compensation = -Math.round(avgLatency);

        setInstructions(
            `✅ Calibration terminée !\n\n` +
            `Latence moyenne : ${avgLatency.toFixed(0)}ms\n` +
            `Min : ${minLatency.toFixed(0)}ms | Max : ${maxLatency.toFixed(0)}ms\n` +
            `${latencies.length}/${totalBeats} battements détectés\n\n` +
            `💡 Compensation appliquée : ${compensation}ms`
        );

        // Apply compensation
        if (onCalibrationComplete) {
            onCalibrationComplete(compensation);
        }
    };

    return (
        <div style={{
            background: 'var(--surface-secondary)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginTop: '1rem'
        }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
                🎯 Calibration de latence
            </h3>

            {/* Intro phase */}
            {phase === 'intro' && (
                <>
                    {/* Calibration type selector */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                            Type de calibration :
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setCalibrationType('visual')}
                                style={{
                                    flex: 1,
                                    background: calibrationType === 'visual' ? 'var(--accent-primary)' : 'var(--surface-tertiary)',
                                    color: calibrationType === 'visual' ? 'white' : 'var(--text-primary)',
                                    border: 'none',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                👁️ Visuelle
                            </button>
                            <button
                                onClick={() => setCalibrationType('audio')}
                                style={{
                                    flex: 1,
                                    background: calibrationType === 'audio' ? 'var(--accent-primary)' : 'var(--surface-tertiary)',
                                    color: calibrationType === 'audio' ? 'white' : 'var(--text-primary)',
                                    border: 'none',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                🔊 Audio
                            </button>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div style={{
                        background: 'var(--surface-tertiary)',
                        padding: '1.5rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem'
                    }}>
                        <h4 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>
                            📖 Comment ça marche ?
                        </h4>
                        <ol style={{
                            paddingLeft: '1.5rem',
                            margin: 0,
                            fontSize: '0.9rem',
                            lineHeight: '1.6',
                            color: 'var(--text-secondary)'
                        }}>
                            <li>Un compte à rebours de 3 secondes va commencer</li>
                            <li>Ensuite, {calibrationType === 'visual' ? 'des marqueurs défileront vers la ligne rouge' : 'vous entendrez un "bip"'} 8 fois</li>
                            <li><strong>Jouez N'IMPORTE QUELLE NOTE</strong> {calibrationType === 'visual' ? 'quand un marqueur atteint la ligne rouge' : 'à chaque signal'}</li>
                            <li>{calibrationType === 'visual' ? 'Le quadrillage vous aide à anticiper les battements' : 'Suivez le rythme du métronome (1 battement/seconde)'}</li>
                            <li>Le système calculera automatiquement votre latence</li>
                        </ol>
                        <p style={{
                            marginTop: '1rem',
                            marginBottom: 0,
                            fontSize: '0.85rem',
                            color: 'var(--text-tertiary)',
                            fontStyle: 'italic'
                        }}>
                            💡 Astuce : Détendez-vous et jouez naturellement sur le rythme !
                        </p>
                    </div>

                    {/* Start button */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={startCountdown}
                            style={{
                                flex: 1,
                                background: 'var(--accent-success)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '1rem'
                            }}
                        >
                            ▶️ Commencer la calibration
                        </button>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                style={{
                                    background: 'var(--surface-tertiary)',
                                    color: 'var(--text-primary)',
                                    border: 'none',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Annuler
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Countdown phase */}
            {phase === 'countdown' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2rem',
                    padding: '2rem 0'
                }}>
                    <div style={{
                        fontSize: '6rem',
                        fontWeight: 'bold',
                        color: 'var(--accent-primary)',
                        animation: 'pulse 1s ease-in-out'
                    }}>
                        {countdown}
                    </div>
                    <p style={{
                        fontSize: '1.1rem',
                        color: 'var(--text-secondary)',
                        margin: 0
                    }}>
                        {instructions}
                    </p>
                </div>
            )}

            {/* Calibration phase */}
            {phase === 'calibrating' && (
                <>
                    {calibrationType === 'visual' ? (
                        /* Visual scrolling mode - Guitar Hero style */
                        <VisualScrollingTrack
                            currentBeat={currentBeat}
                            totalBeats={totalBeats}
                            beatInterval={beatInterval}
                        />
                    ) : (
                        /* Audio mode - simple metronome indicator */
                        <>
                            <div style={{
                                width: '150px',
                                height: '150px',
                                borderRadius: '50%',
                                margin: '2rem auto',
                                background: '#374151',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '3rem',
                                position: 'relative'
                            }}>
                                🔊

                                {/* Beat counter */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-3rem',
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: 'var(--text-primary)'
                                }}>
                                    {currentBeat} / {totalBeats}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Instructions */}
                    <div style={{
                        background: 'var(--surface-tertiary)',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginTop: calibrationType === 'visual' ? '1.5rem' : '3rem',
                        textAlign: 'center',
                        fontSize: '1.1rem',
                        fontWeight: '500'
                    }}>
                        {instructions}
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: '1.5rem' }}>
                        <div style={{
                            background: 'var(--surface-tertiary)',
                            height: '8px',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                background: 'var(--accent-primary)',
                                height: '100%',
                                width: `${(currentBeat / totalBeats) * 100}%`,
                                transition: 'width 0.3s ease-in-out'
                            }} />
                        </div>
                    </div>
                </>
            )}

            {/* Complete phase */}
            {phase === 'complete' && (
                <>
                    <div style={{
                        background: 'var(--surface-tertiary)',
                        padding: '1.5rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        whiteSpace: 'pre-line',
                        textAlign: 'center',
                        lineHeight: '1.8'
                    }}>
                        {instructions}
                    </div>

                    {measurements.length > 0 && (
                        <div style={{
                            marginBottom: '1rem',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)'
                        }}>
                            <strong>Mesures détaillées :</strong>
                            <div style={{
                                marginTop: '0.5rem',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                {measurements.map((m, i) => (
                                    <span
                                        key={i}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {m.toFixed(0)}ms
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => {
                                setPhase('intro');
                                setCurrentBeat(0);
                                setMeasurements([]);
                                setInstructions('');
                            }}
                            style={{
                                flex: 1,
                                background: 'var(--accent-primary)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            🔄 Recalibrer
                        </button>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                style={{
                                    background: 'var(--surface-tertiary)',
                                    color: 'var(--text-primary)',
                                    border: 'none',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Fermer
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
