import React, { useState, useRef, useEffect } from 'react';
import { getPianoRollKeys, getFrenchNoteName } from '../models/song';
import { audioEngine } from '../services/AudioEngine';

const CELL_WIDTH = 40; // px per beat
const CELL_HEIGHT = 24; // px per note

export function PianoRoll({ phrase, onAddNote, onRemoveNote, onUpdateNote }) {
    const [keys] = useState(() => getPianoRollKeys(1, 5)); // C1 to B5
    const scrollRef = useRef(null);
    const [dragState, setDragState] = useState(null); // { type: 'move'|'resize', noteId, startX, startY, originalNote, trackName }
    const [scrollTop, setScrollTop] = useState(0);
    const lastPlayedPitchRef = useRef(null); // Track last played pitch for audio feedback

    // Hand separation line
    const [separatorEnabled, setSeparatorEnabled] = useState(false);
    const [separatorPitch, setSeparatorPitch] = useState('C4'); // Default separation at C4

    // Combine notes from both tracks with track information
    const allNotes = [
        ...phrase.tracks.melody.map(n => ({ ...n, trackName: 'melody' })),
        ...phrase.tracks.chords.map(n => ({ ...n, trackName: 'chords' }))
    ];

    const handleGridClick = (pitch, beatIndex) => {
        // Check if note exists at this position in either track
        let existingNote = null;
        let trackName = null;

        for (const track of ['melody', 'chords']) {
            const found = phrase.tracks[track].find(
                n => n.pitch === pitch && Math.abs(n.startTime - beatIndex) < 0.1
            );
            if (found) {
                existingNote = found;
                trackName = track;
                break;
            }
        }

        if (existingNote) {
            onRemoveNote(phrase.id, trackName, existingNote.id);
        } else {
            // Assign to melody or chords based on pitch (C4/60 is the dividing line)
            const midiPitch = keys.indexOf(pitch);
            const autoTrack = midiPitch >= keys.indexOf('C4') ? 'melody' : 'chords';
            onAddNote(phrase.id, autoTrack, pitch, beatIndex, 1); // Default duration 1 beat
            audioEngine.playNote(pitch);
        }
    };

    const handleNoteMouseDown = (e, note, type) => {
        e.stopPropagation();
        e.preventDefault();

        // Alt+Click or Ctrl+Click to delete note
        if (e.altKey || e.ctrlKey || e.metaKey) {
            onRemoveNote(phrase.id, note.trackName, note.id);
            return;
        }

        lastPlayedPitchRef.current = note.pitch;
        setDragState({
            type,
            noteId: note.id,
            trackName: note.trackName,
            startX: e.clientX,
            startY: e.clientY,
            originalNote: { ...note }
        });
    };

    const handleMouseMove = (e) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        const deltaBeats = deltaX / CELL_WIDTH;
        const deltaPitch = Math.round(deltaY / CELL_HEIGHT); // Positive when moving down

        if (dragState.type === 'resize') {
            // Resize: only change duration
            const newDuration = Math.max(0.25, dragState.originalNote.duration + deltaBeats);
            const roundedDuration = Math.round(newDuration * 4) / 4; // Snap to 1/4 beat

            if (roundedDuration !== dragState.originalNote.duration) {
                onUpdateNote(phrase.id, dragState.trackName, dragState.noteId, {
                    duration: roundedDuration
                });
            }
        } else if (dragState.type === 'move') {
            // Move: change startTime and pitch
            const newStartTime = Math.max(0, dragState.originalNote.startTime + deltaBeats);
            const roundedStartTime = Math.round(newStartTime * 4) / 4; // Snap to 1/4 beat

            const originalKeyIndex = keys.indexOf(dragState.originalNote.pitch);
            const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
            const newPitch = keys[newKeyIndex];

            if (roundedStartTime !== dragState.originalNote.startTime || newPitch !== dragState.originalNote.pitch) {
                onUpdateNote(phrase.id, dragState.trackName, dragState.noteId, {
                    startTime: roundedStartTime,
                    pitch: newPitch
                });

                // Play note while dragging (only when pitch changes)
                if (newPitch !== lastPlayedPitchRef.current) {
                    audioEngine.playNote(newPitch);
                    lastPlayedPitchRef.current = newPitch;
                }
            }
        } else if (dragState.type === 'separator') {
            // Move separator line
            handleSeparatorDrag(e, deltaY);
        }
    };

    const handleMouseUp = () => {
        setDragState(null);
    };

    const handleSeparatorMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();

        setDragState({
            type: 'separator',
            startY: e.clientY,
            originalPitch: separatorPitch
        });
    };

    const handleSeparatorDrag = (e, deltaY) => {
        const deltaPitch = Math.round(deltaY / CELL_HEIGHT);
        const originalKeyIndex = keys.indexOf(dragState.originalPitch);
        const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
        const newPitch = keys[newKeyIndex];

        if (newPitch !== separatorPitch) {
            setSeparatorPitch(newPitch);
        }
    };

    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragState]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Separator Toggle Button */}
            <button
                onClick={() => setSeparatorEnabled(!separatorEnabled)}
                style={{
                    alignSelf: 'flex-start',
                    background: separatorEnabled ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                    color: separatorEnabled ? 'white' : 'var(--text-secondary)',
                    border: separatorEnabled ? 'none' : '1px solid var(--border-light)',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}
            >
                <span>{separatorEnabled ? '✓' : '○'}</span>
                <span>Séparateur MG/MD</span>
            </button>

            <div className="piano-roll" style={{
                display: 'flex',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                height: '450px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-primary)',
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
                userSelect: 'none'
            }}>
            {/* Piano Keys (Y-axis) */}
            <div style={{
                width: '90px',
                overflowY: 'hidden',
                borderRight: '2px solid var(--border-color)',
                background: 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 100%)',
                flexShrink: 0,
                position: 'relative',
                boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ transform: `translateY(-${scrollTop}px)` }}>
                    {keys.map(pitch => {
                        const isBlack = pitch.includes('#');
                        return (
                            <div key={pitch} style={{
                                height: `${CELL_HEIGHT}px`,
                                background: isBlack
                                    ? 'linear-gradient(90deg, #2c3e50 0%, #34495e 100%)'
                                    : 'linear-gradient(90deg, #ffffff 0%, #f8f9fa 100%)',
                                color: isBlack ? '#ecf0f1' : '#2c3e50',
                                borderBottom: `1px solid ${isBlack ? '#1a252f' : '#dee2e6'}`,
                                fontSize: '0.8125rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: '0.75rem',
                                boxSizing: 'border-box',
                                transition: 'all var(--transition-fast)',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = isBlack
                                    ? 'linear-gradient(90deg, #34495e 0%, #3d5a73 100%)'
                                    : 'linear-gradient(90deg, #e3f2fd 0%, #bbdefb 100%)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = isBlack
                                    ? 'linear-gradient(90deg, #2c3e50 0%, #34495e 100%)'
                                    : 'linear-gradient(90deg, #ffffff 0%, #f8f9fa 100%)';
                            }}
                            >
                                {getFrenchNoteName(pitch)}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Grid (Content) */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    position: 'relative',
                    background: 'linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)'
                }}
                onScroll={(e) => {
                    setScrollTop(e.target.scrollTop);
                }}
            >
                <div style={{
                    width: `${phrase.length * 4 * CELL_WIDTH}px`, // 4 beats per measure
                    height: `${keys.length * CELL_HEIGHT}px`,
                    position: 'relative'
                }}>
                    {/* Grid Lines - Vertical */}
                    {Array.from({ length: phrase.length * 4 }).map((_, i) => (
                        <div key={`v-${i}`} style={{
                            position: 'absolute',
                            left: `${i * CELL_WIDTH}px`,
                            top: 0,
                            bottom: 0,
                            width: i % 4 === 0 ? '2px' : '1px',
                            background: i % 4 === 0
                                ? 'linear-gradient(180deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%)'
                                : 'rgba(255, 255, 255, 0.05)',
                            pointerEvents: 'none'
                        }} />
                    ))}
                    {/* Grid Lines - Horizontal */}
                    {keys.map((pitch, i) => {
                        const isBlack = pitch.includes('#');
                        return (
                            <div key={`h-${i}`} style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${i * CELL_HEIGHT}px`,
                                height: `${CELL_HEIGHT}px`,
                                backgroundColor: isBlack ? 'rgba(0, 0, 0, 0.15)' : 'transparent',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                pointerEvents: 'none'
                            }} />
                        );
                    })}

                    {/* Notes */}
                    {allNotes.map(note => {
                        const keyIndex = keys.indexOf(note.pitch);
                        if (keyIndex === -1) return null; // Note out of range

                        const isDragging = dragState?.noteId === note.id;

                        return (
                            <div
                                key={`${note.trackName}-${note.id}`}
                                style={{
                                    position: 'absolute',
                                    left: `${note.startTime * CELL_WIDTH}px`,
                                    top: `${keyIndex * CELL_HEIGHT + 1}px`,
                                    width: `${note.duration * CELL_WIDTH - 2}px`,
                                    height: `${CELL_HEIGHT - 2}px`,
                                    background: note.trackName === 'melody'
                                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    boxShadow: note.trackName === 'melody'
                                        ? '0 2px 8px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                        : '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                    zIndex: isDragging ? 100 : 10,
                                    transition: isDragging ? 'none' : 'all var(--transition-fast)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    opacity: isDragging ? 0.8 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                                onMouseDown={(e) => handleNoteMouseDown(e, note, 'move')}
                            >
                                {/* Resize handle on the right */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '8px',
                                        cursor: 'ew-resize',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                                        opacity: isDragging && dragState.type === 'resize' ? 1 : 0,
                                        transition: 'opacity 0.2s'
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleNoteMouseDown(e, note, 'resize');
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = '1';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isDragging) {
                                            e.currentTarget.style.opacity = '0';
                                        }
                                    }}
                                />
                            </div>
                        );
                    })}

                    {/* Click Area Overlay */}
                    {!dragState && keys.map((pitch, yIndex) => (
                        Array.from({ length: phrase.length * 4 }).map((_, xIndex) => (
                            <div
                                key={`${pitch}-${xIndex}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleGridClick(pitch, xIndex);
                                }}
                                style={{
                                    position: 'absolute',
                                    left: `${xIndex * CELL_WIDTH}px`,
                                    top: `${yIndex * CELL_HEIGHT}px`,
                                    width: `${CELL_WIDTH}px`,
                                    height: `${CELL_HEIGHT}px`,
                                    zIndex: 5,
                                    cursor: 'crosshair'
                                }}
                            />
                        ))
                    ))}

                    {/* Hand Separation Line */}
                    {separatorEnabled && (
                        <div
                            onMouseDown={handleSeparatorMouseDown}
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${keys.indexOf(separatorPitch) * CELL_HEIGHT}px`,
                                height: '3px',
                                background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
                                cursor: 'ns-resize',
                                zIndex: 50,
                                boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                                transition: dragState?.type === 'separator' ? 'none' : 'top 0.1s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <div style={{
                                background: '#f59e0b',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                                pointerEvents: 'none'
                            }}>
                                MG ↕ MD
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
}
