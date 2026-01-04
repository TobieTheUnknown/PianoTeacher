import React from 'react';
import { useMidiRecording } from '../../hooks/useMidiRecording';

/**
 * MIDI Recorder Component
 *
 * Features:
 * - Record/Stop button
 * - Pre-roll countdown
 * - Metronome toggle
 * - Quantization settings
 * - Visual feedback during recording
 */
export function MidiRecorder({
    tempo = 120,
    phraseLength = 4,
    onRecordingComplete,
    onNoteRecorded,
    onActiveNotesChange,
    onRecordingStateChange,
    disabled = false,
    snapToGrid = true
}) {
    const [quantization, setQuantization] = React.useState(0.25); // 1/16 note
    const [usePreRoll, setUsePreRoll] = React.useState(true);
    const [preRollBars, setPreRollBars] = React.useState(1);

    const {
        isRecording,
        isPreRoll,
        preRollCount,
        recordedNotes,
        activeNotes,
        startRecording,
        stopRecording,
        clearRecordedNotes
    } = useMidiRecording(tempo, phraseLength, quantization, snapToGrid, onNoteRecorded, onActiveNotesChange);

    // Handle start recording
    const handleStartRecording = () => {
        clearRecordedNotes();
        startRecording(usePreRoll, preRollBars);
    };

    // Handle stop recording
    const handleStopRecording = () => {
        stopRecording();
    };

    // Notify parent of recording state changes
    React.useEffect(() => {
        if (onRecordingStateChange) {
            onRecordingStateChange(isRecording || isPreRoll);
        }
    }, [isRecording, isPreRoll, onRecordingStateChange]);

    // Auto-call onRecordingComplete when recording stops and we have notes
    React.useEffect(() => {
        if (!isRecording && !isPreRoll && recordedNotes.length > 0 && onRecordingComplete) {
            onRecordingComplete(recordedNotes);
            clearRecordedNotes();
        }
    }, [isRecording, isPreRoll, recordedNotes, onRecordingComplete, clearRecordedNotes]);

    return (
        <div style={{
            padding: '1.25rem',
            background: isRecording || isPreRoll ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)',
            border: `2px solid ${isRecording || isPreRoll ? '#ef4444' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-lg)',
            transition: 'all 0.3s'
        }}>
            <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'space-between'
            }}>
                {/* Left side: Recording controls */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: '1', minWidth: '250px' }}>
                    {/* Record/Stop Button */}
                    {!isRecording && !isPreRoll ? (
                        <button
                            onClick={handleStartRecording}
                            disabled={disabled}
                            style={{
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                opacity: disabled ? 0.5 : 1,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (!disabled) e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>●</span>
                            <span>Enregistrer</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleStopRecording}
                            style={{
                                background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>■</span>
                            <span>Arrêter</span>
                        </button>
                    )}

                    {/* Status indicator */}
                    {isPreRoll && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem 1rem',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid #f59e0b',
                            borderRadius: 'var(--radius-md)',
                            color: '#f59e0b',
                            fontWeight: '600',
                            fontSize: '0.9375rem'
                        }}>
                            <span>Compte à rebours...</span>
                            <span style={{
                                background: '#f59e0b',
                                color: 'white',
                                borderRadius: '50%',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '700'
                            }}>
                                {Math.ceil(preRollCount / 4)}
                            </span>
                        </div>
                    )}

                    {isRecording && !isPreRoll && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid #ef4444',
                            borderRadius: 'var(--radius-md)',
                            color: '#ef4444',
                            fontWeight: '600',
                            fontSize: '0.9375rem'
                        }}>
                            <span style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: '#ef4444',
                                animation: 'pulse 1.5s ease-in-out infinite'
                            }} />
                            <span>Enregistrement en cours...</span>
                        </div>
                    )}

                    {!isRecording && !isPreRoll && recordedNotes.length > 0 && (
                        <div style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid #22c55e',
                            borderRadius: 'var(--radius-md)',
                            color: '#22c55e',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                        }}>
                            {recordedNotes.length} note{recordedNotes.length > 1 ? 's' : ''} enregistrée{recordedNotes.length > 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {/* Right side: Settings */}
                {!isRecording && !isPreRoll && (
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        {/* Quantization */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                                fontWeight: '500'
                            }}>
                                Quantification:
                            </label>
                            <select
                                value={quantization}
                                onChange={(e) => setQuantization(parseFloat(e.target.value))}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value={1}>1/4 (Noire)</option>
                                <option value={0.5}>1/8 (Croche)</option>
                                <option value={0.25}>1/16 (Double-croche)</option>
                                <option value={0.125}>1/32 (Triple-croche)</option>
                            </select>
                        </div>

                        {/* Pre-roll toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                id="preroll-toggle"
                                checked={usePreRoll}
                                onChange={(e) => setUsePreRoll(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                            />
                            <label
                                htmlFor="preroll-toggle"
                                style={{
                                    fontSize: '0.875rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                Compte à rebours
                            </label>
                        </div>

                        {/* Pre-roll bars (if enabled) */}
                        {usePreRoll && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label style={{
                                    fontSize: '0.875rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: '500'
                                }}>
                                    Mesures:
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="4"
                                    value={preRollBars}
                                    onChange={(e) => setPreRollBars(parseInt(e.target.value) || 1)}
                                    style={{
                                        width: '60px',
                                        padding: '0.5rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-elevated)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem',
                                        fontWeight: '500',
                                        textAlign: 'center'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* CSS for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.5;
                    }
                }
            `}</style>
        </div>
    );
}
