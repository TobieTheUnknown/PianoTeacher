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
 */
export function MidiLatencyCalibration({ onCalibrationComplete, onCancel }) {
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [currentTrial, setCurrentTrial] = useState(0);
    const [measurements, setMeasurements] = useState([]);
    const [pulseActive, setPulseActive] = useState(false);
    const [instructions, setInstructions] = useState('Appuyez sur "Commencer" pour calibrer la latence MIDI');
    const [calibrationType, setCalibrationType] = useState('visual'); // 'visual' or 'audio'

    const totalTrials = 5;
    const targetNote = 60; // Middle C (C4)
    const pulseTimestamp = useRef(null);
    const audioInitialized = useRef(false);

    useEffect(() => {
        // Initialize audio engine
        const initAudio = async () => {
            if (!audioInitialized.current) {
                await audioEngine.initialize();
                await Tone.start();
                audioInitialized.current = true;
            }
        };
        initAudio();
    }, []);

    useEffect(() => {
        if (!isCalibrating) return;

        const handleNoteOn = (event) => {
            const { note } = event;

            // Only accept the target note (C4)
            if (note === targetNote && pulseTimestamp.current !== null) {
                const now = performance.now();
                const latency = now - pulseTimestamp.current;

                console.log(`Trial ${currentTrial + 1}: Latency = ${latency.toFixed(2)}ms`);

                setMeasurements(prev => [...prev, latency]);
                setPulseActive(false);
                pulseTimestamp.current = null;

                if (currentTrial + 1 < totalTrials) {
                    setCurrentTrial(prev => prev + 1);
                    setInstructions(`Essai ${currentTrial + 2}/${totalTrials} - Attendez le signal...`);

                    // Schedule next trial
                    setTimeout(() => {
                        triggerPulse();
                    }, 1500 + Math.random() * 1000); // Random delay 1.5-2.5s
                } else {
                    // Calibration complete
                    finishCalibration();
                }
            }
        };

        midiInputService.addEventListener('noteOn', handleNoteOn);
        return () => midiInputService.removeEventListener('noteOn', handleNoteOn);
    }, [isCalibrating, currentTrial]);

    const triggerPulse = () => {
        if (calibrationType === 'visual') {
            // Visual pulse
            setPulseActive(true);
            pulseTimestamp.current = performance.now();
            setInstructions('🎹 MAINTENANT ! Appuyez sur Do (C)');
        } else {
            // Audio pulse
            if (audioInitialized.current && audioEngine.sampler) {
                pulseTimestamp.current = performance.now();
                audioEngine.sampler.triggerAttackRelease(
                    getNoteNameFromMidi(targetNote),
                    '8n',
                    Tone.now()
                );
                setInstructions('🔊 Vous entendez la note ? Jouez Do (C) immédiatement !');
            }
        }
    };

    const startCalibration = () => {
        setIsCalibrating(true);
        setCurrentTrial(0);
        setMeasurements([]);
        setInstructions(`Essai 1/${totalTrials} - Attendez le signal...`);

        // Start first trial after a short delay
        setTimeout(() => {
            triggerPulse();
        }, 2000);
    };

    const finishCalibration = () => {
        setIsCalibrating(false);
        setPulseActive(false);

        // Calculate average latency
        const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const minLatency = Math.min(...measurements);
        const maxLatency = Math.max(...measurements);

        // Calculate compensation (negative of the measured latency)
        const compensation = -Math.round(avgLatency);

        setInstructions(
            `Calibration terminée !\n` +
            `Latence moyenne: ${avgLatency.toFixed(0)}ms\n` +
            `Min: ${minLatency.toFixed(0)}ms, Max: ${maxLatency.toFixed(0)}ms\n` +
            `Compensation appliquée: ${compensation}ms`
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

            {/* Calibration type selector */}
            {!isCalibrating && measurements.length === 0 && (
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
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.5rem',
                        marginBottom: 0
                    }}>
                        {calibrationType === 'visual'
                            ? 'Mesure le délai entre l\'affichage visuel et votre frappe'
                            : 'Mesure le délai entre le son de référence et votre frappe'}
                    </p>
                </div>
            )}

            {/* Visual pulse indicator */}
            {isCalibrating && calibrationType === 'visual' && (
                <div style={{
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    margin: '2rem auto',
                    background: pulseActive ? '#22c55e' : '#374151',
                    boxShadow: pulseActive ? '0 0 40px rgba(34, 197, 94, 0.8)' : 'none',
                    transition: 'all 0.1s ease-in-out',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem'
                }}>
                    {pulseActive ? '⚡' : '⏸️'}
                </div>
            )}

            {/* Audio indicator */}
            {isCalibrating && calibrationType === 'audio' && (
                <div style={{
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    margin: '2rem auto',
                    background: 'var(--surface-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem'
                }}>
                    🔊
                </div>
            )}

            {/* Instructions */}
            <div style={{
                background: 'var(--surface-tertiary)',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                textAlign: 'center',
                whiteSpace: 'pre-line',
                minHeight: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {instructions}
            </div>

            {/* Progress */}
            {isCalibrating && (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{
                        background: 'var(--surface-tertiary)',
                        height: '8px',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            background: 'var(--accent-primary)',
                            height: '100%',
                            width: `${(currentTrial / totalTrials) * 100}%`,
                            transition: 'width 0.3s ease-in-out'
                        }} />
                    </div>
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.5rem',
                        textAlign: 'center'
                    }}>
                        Essai {currentTrial + 1} / {totalTrials}
                    </p>
                </div>
            )}

            {/* Measurements display */}
            {measurements.length > 0 && !isCalibrating && (
                <div style={{
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)'
                }}>
                    <strong>Mesures:</strong> {measurements.map(m => `${m.toFixed(0)}ms`).join(', ')}
                </div>
            )}

            {/* Control buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                {!isCalibrating && measurements.length === 0 && (
                    <>
                        <button
                            onClick={startCalibration}
                            style={{
                                flex: 1,
                                background: 'var(--accent-success)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            ▶️ Commencer
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
                    </>
                )}

                {!isCalibrating && measurements.length > 0 && (
                    <>
                        <button
                            onClick={() => {
                                setMeasurements([]);
                                setInstructions('Appuyez sur "Commencer" pour calibrer la latence MIDI');
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
                    </>
                )}
            </div>

            {/* Help text */}
            <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-tertiary)',
                marginTop: '1rem',
                marginBottom: 0,
                textAlign: 'center'
            }}>
                💡 Astuce : Jouez toujours la note Do (C) au milieu du clavier
            </p>
        </div>
    );
}
