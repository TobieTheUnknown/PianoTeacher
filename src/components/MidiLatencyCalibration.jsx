import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { midiInputService } from '../services/MidiInputService';
import { audioEngine } from '../services/AudioEngine';
import { getNoteNameFromMidi } from '../models/song';

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

    const playVisualPulse = () => {
        // Visual pulse is handled by the beat display
    };

    const startCalibration = () => {
        setPhase('calibrating');
        setCurrentBeat(0);
        beatTimestamps.current = [];
        expectedBeatTimes.current = [];

        setInstructions(
            calibrationType === 'visual'
                ? '🎵 Jouez UNE NOTE sur chaque flash vert !'
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

                // Trigger visual/audio cue
                if (calibrationType === 'visual') {
                    playVisualPulse();
                    playMetronomeClick(beat === 1 || beat % 4 === 1); // Accent on downbeat
                } else {
                    playMetronomeClick(beat === 1 || beat % 4 === 1);
                }
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
                            <li>Ensuite, {calibrationType === 'visual' ? 'un cercle vert flashera' : 'vous entendrez un "bip"'} 8 fois</li>
                            <li><strong>Jouez N'IMPORTE QUELLE NOTE</strong> sur votre clavier à chaque signal</li>
                            <li>Suivez le rythme du métronome (1 battement/seconde)</li>
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
                    {/* Visual metronome indicator */}
                    <div style={{
                        width: '150px',
                        height: '150px',
                        borderRadius: '50%',
                        margin: '2rem auto',
                        background: currentBeat > 0 && calibrationType === 'visual' ? '#22c55e' : '#374151',
                        boxShadow: currentBeat > 0 && calibrationType === 'visual' ? '0 0 40px rgba(34, 197, 94, 0.8)' : 'none',
                        transition: 'all 0.05s ease-out',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        position: 'relative'
                    }}>
                        {currentBeat > 0 ? '🎵' : '⏸️'}

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

                    {/* Instructions */}
                    <div style={{
                        background: 'var(--surface-tertiary)',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginTop: '3rem',
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
