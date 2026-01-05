import React from 'react';
import { useMidiRecording } from '../../hooks/useMidiRecording';

/**
 * MIDI Recorder Component
 *
 * Features:
 * - Record/Stop button
 * - Pre-roll countdown
 * - Visual feedback during recording
 */
export function MidiRecorder({
    tempo = 120,
    phraseLength = 4,
    onRecordingComplete,
    onNoteRecorded,
    onActiveNotesChange,
    onRecordingStateChange,
    onPreRollComplete,
    disabled = false,
    snapToGrid = true,
    metronomeSubdivision = 'quarter' // Use metronome subdivision for quantization
}) {
    // Quantization derived from metronome subdivision
    const quantization = metronomeSubdivision === 'eighth' ? 0.5 : 1; // 1/8 or 1/4
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
    } = useMidiRecording(tempo, phraseLength, quantization, snapToGrid, onNoteRecorded, onActiveNotesChange, onPreRollComplete);

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
            padding: '0.5rem 0.75rem',
            background: isRecording || isPreRoll ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-elevated)',
            border: `1px solid ${isRecording || isPreRoll ? '#ef4444' : 'var(--border-light)'}`,
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s'
        }}>
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center'
            }}>
                {/* Record/Stop Button - Compact */}
                {!isRecording && !isPreRoll ? (
                    <button
                        onClick={handleStartRecording}
                        disabled={disabled}
                        style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
                            opacity: disabled ? 0.5 : 1
                        }}
                    >
                        <span style={{ fontSize: '0.9rem' }}>●</span>
                        <span>REC</span>
                    </button>
                ) : (
                    <button
                        onClick={handleStopRecording}
                        style={{
                            background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: '0 2px 6px rgba(107, 114, 128, 0.3)'
                        }}
                    >
                        <span style={{ fontSize: '0.9rem' }}>■</span>
                        <span>Stop</span>
                    </button>
                )}

                {/* Status indicator - Compact */}
                {isPreRoll && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.3rem 0.6rem',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b',
                        borderRadius: 'var(--radius-sm)',
                        color: '#f59e0b',
                        fontWeight: '600',
                        fontSize: '0.75rem'
                    }}>
                        <span style={{
                            background: '#f59e0b',
                            color: 'white',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '0.75rem'
                        }}>
                            {Math.ceil(preRollCount / 4)}
                        </span>
                    </div>
                )}

                {isRecording && !isPreRoll && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.3rem 0.6rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid #ef4444',
                        borderRadius: 'var(--radius-sm)',
                        color: '#ef4444',
                        fontWeight: '600',
                        fontSize: '0.75rem'
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }} />
                        <span>REC</span>
                    </div>
                )}

                {!isRecording && !isPreRoll && recordedNotes.length > 0 && (
                    <div style={{
                        padding: '0.3rem 0.6rem',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid #22c55e',
                        borderRadius: 'var(--radius-sm)',
                        color: '#22c55e',
                        fontWeight: '600',
                        fontSize: '0.75rem'
                    }}>
                        {recordedNotes.length} note{recordedNotes.length > 1 ? 's' : ''}
                    </div>
                )}

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Pre-roll settings - Compact */}
                {!isRecording && !isPreRoll && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}>
                            <input
                                type="checkbox"
                                checked={usePreRoll}
                                onChange={(e) => setUsePreRoll(e.target.checked)}
                                style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                            />
                            Décompte
                        </label>
                        {usePreRoll && (
                            <select
                                value={preRollBars}
                                onChange={(e) => setPreRollBars(parseInt(e.target.value))}
                                style={{
                                    padding: '0.25rem 0.4rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: 'none',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value={1}>1 mes.</option>
                                <option value={2}>2 mes.</option>
                            </select>
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
