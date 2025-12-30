import React, { useEffect, useRef, useState } from 'react';
import { midiInputService } from '../services/MidiInputService';
import { getFrenchNoteName } from '../models/song';

/**
 * MidiVisualizer - Real-time MIDI input visualization
 *
 * Displays:
 * - Piano keyboard with active notes highlighted
 * - Note names and velocity
 * - Recent MIDI events log
 */
export function MidiVisualizer({ compact = false }) {
    const [activeNotes, setActiveNotes] = useState(new Map()); // note -> { velocity, timestamp }
    const [recentEvents, setRecentEvents] = useState([]);
    const cleanupRef = useRef(null);

    useEffect(() => {
        // Subscribe to MIDI monitor
        const removeMonitor = midiInputService.addMonitor((event) => {
            if (event.type === 'noteOn') {
                setActiveNotes(prev => {
                    const next = new Map(prev);
                    next.set(event.note, {
                        velocity: event.velocity,
                        timestamp: Date.now()
                    });
                    return next;
                });

                // Add to recent events
                setRecentEvents(prev => {
                    const noteName = getFrenchNoteName(event.note);
                    const newEvent = {
                        id: Date.now(),
                        type: 'Note On',
                        note: event.note,
                        noteName,
                        velocity: event.velocity,
                        timestamp: Date.now()
                    };
                    return [newEvent, ...prev].slice(0, compact ? 5 : 10);
                });

            } else if (event.type === 'noteOff') {
                setActiveNotes(prev => {
                    const next = new Map(prev);
                    next.delete(event.note);
                    return next;
                });
            }
        });

        cleanupRef.current = removeMonitor;

        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, [compact]);

    // Auto-clear old active notes (safety timeout)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setActiveNotes(prev => {
                const next = new Map(prev);
                let changed = false;
                for (let [note, data] of next.entries()) {
                    if (now - data.timestamp > 5000) { // 5 second timeout
                        next.delete(note);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const renderPianoKey = (midiNote) => {
        const isBlack = isBlackKey(midiNote);
        const isActive = activeNotes.has(midiNote);
        const noteData = activeNotes.get(midiNote);

        const baseStyle = {
            position: 'relative',
            width: isBlack ? '30px' : '40px',
            height: isBlack ? '80px' : '120px',
            backgroundColor: isActive
                ? (isBlack ? '#3b82f6' : '#60a5fa')
                : (isBlack ? '#1a1a1a' : '#ffffff'),
            border: isBlack ? '1px solid #000' : '1px solid #ccc',
            borderRadius: '0 0 4px 4px',
            marginLeft: isBlack ? '-15px' : '0',
            marginRight: isBlack ? '-15px' : '0',
            zIndex: isBlack ? 2 : 1,
            cursor: 'default',
            transition: 'all 0.1s ease',
            boxShadow: isActive ? '0 0 10px rgba(59, 130, 246, 0.6)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '4px'
        };

        const labelStyle = {
            fontSize: isBlack ? '9px' : '10px',
            fontWeight: '600',
            color: isActive
                ? '#ffffff'
                : (isBlack ? '#aaa' : '#666'),
            userSelect: 'none',
            textAlign: 'center'
        };

        const velocityStyle = {
            fontSize: '8px',
            color: isActive ? '#fff' : 'transparent',
            marginTop: '2px'
        };

        return (
            <div key={midiNote} style={baseStyle}>
                <div style={labelStyle}>
                    {getFrenchNoteName(midiNote).replace(/[0-9-]/g, '')}
                </div>
                {isActive && noteData && (
                    <div style={velocityStyle}>
                        {noteData.velocity}
                    </div>
                )}
            </div>
        );
    };

    const renderKeyboard = () => {
        const startNote = 48; // C3
        const endNote = 84; // C6
        const keys = [];

        for (let i = startNote; i <= endNote; i++) {
            keys.push(renderPianoKey(i));
        }

        return (
            <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                overflowX: 'auto'
            }}>
                {keys}
            </div>
        );
    };

    const renderEventLog = () => {
        if (compact && recentEvents.length === 0) return null;

        return (
            <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                maxHeight: compact ? '150px' : '200px',
                overflowY: 'auto'
            }}>
                <h4 style={{
                    margin: '0 0 0.75rem 0',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                }}>
                    {compact ? 'Événements récents' : 'Historique MIDI'}
                </h4>
                {recentEvents.length === 0 ? (
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        margin: 0
                    }}>
                        Jouez une note sur votre clavier MIDI...
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {recentEvents.map(event => (
                            <div
                                key={event.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.85rem',
                                    borderLeft: '3px solid var(--accent-primary)'
                                }}
                            >
                                <span style={{
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace'
                                }}>
                                    {event.noteName}
                                </span>
                                <span style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.8rem'
                                }}>
                                    Vélocité: {event.velocity}
                                </span>
                                <span style={{
                                    color: 'var(--text-tertiary)',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace'
                                }}>
                                    {new Date(event.timestamp).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        fractionalSecondDigits: 2
                                    })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            {!compact && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>🎹</span>
                        <strong>Jouez des notes</strong> sur votre clavier pour les voir s'afficher en temps réel
                    </p>
                </div>
            )}
            {renderKeyboard()}
            {renderEventLog()}
        </div>
    );
}

// Helper function
function isBlackKey(midiNote) {
    const noteInOctave = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
}
