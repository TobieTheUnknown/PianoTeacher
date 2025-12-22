import React, { useState, useRef, useEffect } from 'react';
import { getPianoRollKeys, getFrenchNoteName } from '../models/song';
import { audioEngine } from '../services/AudioEngine';

const CELL_WIDTH = 40; // px per beat
const CELL_HEIGHT = 24; // px per note

export function PianoRoll({ phrase, onAddNote, onRemoveNote, onUpdateNote, onUpdateHandSeparators }) {
    const [keys] = useState(() => getPianoRollKeys(1, 5)); // C1 to B5
    const scrollRef = useRef(null);
    const [dragState, setDragState] = useState(null); // { type: 'move'|'resize'|'separator', noteId, startX, startY, originalNote, trackName, separatorIndex }
    const [scrollTop, setScrollTop] = useState(0);
    const lastPlayedPitchRef = useRef(null); // Track last played pitch for audio feedback

    // Hand separation lines - use phrase data or default
    const handSeparators = phrase.handSeparators || [];
    const [separatorEnabled, setSeparatorEnabled] = useState(handSeparators.length > 0);

    // Fullscreen and zoom
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoom, setZoom] = useState(1); // 1 = 100%, 1.5 = 150%, etc.

    const cellWidth = CELL_WIDTH * zoom;
    const cellHeight = CELL_HEIGHT * zoom;

    // Helper to get applicable separator for a given measure
    const getSeparatorForMeasure = (measureIndex) => {
        if (!separatorEnabled || handSeparators.length === 0) return null;
        // Find the most recent separator before or at this measure
        const applicable = handSeparators
            .filter(s => s.fromMeasure <= measureIndex)
            .sort((a, b) => b.fromMeasure - a.fromMeasure);
        return applicable[0] || null;
    };

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

        lastPlayedPitchRef.current = note.pitch;
        setDragState({
            type,
            noteId: note.id,
            trackName: note.trackName,
            startX: e.clientX,
            startY: e.clientY,
            originalNote: { ...note },
            hasMoved: false // Track if mouse has moved to distinguish click from drag
        });
    };

    const handleMouseMove = (e) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        // Check if mouse has moved significantly (threshold of 3 pixels)
        const hasMoved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;
        if (hasMoved && dragState.hasMoved === false) {
            setDragState(prev => ({ ...prev, hasMoved: true }));
        }

        const deltaBeats = deltaX / cellWidth;
        const deltaPitch = Math.round(deltaY / cellHeight); // Positive when moving down

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
            handleSeparatorDrag(e, deltaX, deltaY);
        }
    };

    const handleMouseUp = () => {
        // If mouse didn't move, treat as click to delete note
        if (dragState && !dragState.hasMoved && dragState.type !== 'separator') {
            if (dragState.noteId) {
                onRemoveNote(phrase.id, dragState.trackName, dragState.noteId);
            }
        }
        setDragState(null);
    };

    const handleSeparatorMouseDown = (e, separatorIndex) => {
        e.stopPropagation();
        e.preventDefault();

        const separator = handSeparators[separatorIndex];
        setDragState({
            type: 'separator',
            startX: e.clientX,
            startY: e.clientY,
            separatorIndex,
            originalPitch: separator.pitch,
            originalMeasure: separator.fromMeasure
        });
    };

    const handleSeparatorDrag = (e, deltaX, deltaY) => {
        if (!dragState || dragState.type !== 'separator') return;

        const deltaPitch = Math.round(deltaY / cellHeight);
        const deltaMeasure = Math.round(deltaX / (cellWidth * 4)); // 4 beats per measure

        const originalKeyIndex = keys.indexOf(dragState.originalPitch);
        const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
        const newPitch = keys[newKeyIndex];

        const newMeasure = Math.max(0, Math.min(phrase.length - 1, dragState.originalMeasure + deltaMeasure));

        const currentSeparator = handSeparators[dragState.separatorIndex];
        if (newPitch !== currentSeparator.pitch || newMeasure !== currentSeparator.fromMeasure) {
            const updatedSeparators = handSeparators.map((sep, idx) =>
                idx === dragState.separatorIndex
                    ? { ...sep, pitch: newPitch, fromMeasure: newMeasure }
                    : sep
            );
            onUpdateHandSeparators(updatedSeparators);
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

    const pianoRollContent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Separator Toggle */}
                <button
                    onClick={() => {
                        if (separatorEnabled) {
                            // Disable: clear all separators
                            onUpdateHandSeparators([]);
                            setSeparatorEnabled(false);
                        } else {
                            // Enable: add default separator at C4 from measure 0
                            onUpdateHandSeparators([{ fromMeasure: 0, pitch: 'C4' }]);
                            setSeparatorEnabled(true);
                        }
                    }}
                    style={{
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

                {/* Zoom Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                        style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-light)',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        −
                    </button>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', minWidth: '50px', textAlign: 'center' }}>
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                        style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-light)',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        +
                    </button>
                    <button
                        onClick={() => setZoom(1)}
                        style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-light)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                        }}
                    >
                        100%
                    </button>
                </div>

                {/* Fullscreen Toggle */}
                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    style={{
                        background: isFullscreen ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                        color: isFullscreen ? 'white' : 'var(--text-secondary)',
                        border: isFullscreen ? 'none' : '1px solid var(--border-light)',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginLeft: 'auto'
                    }}
                >
                    {isFullscreen ? '⤓ Réduire' : '⤢ Plein écran'}
                </button>
            </div>

            <div className="piano-roll" style={{
                display: 'flex',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                height: isFullscreen ? 'calc(100vh - 8rem)' : '450px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-primary)',
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
                userSelect: 'none',
                flex: isFullscreen ? 1 : 'none'
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
                                height: `${cellHeight}px`,
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
                    width: `${phrase.length * 4 * cellWidth}px`, // 4 beats per measure
                    height: `${keys.length * cellHeight}px`,
                    position: 'relative'
                }}>
                    {/* Grid Lines - Vertical */}
                    {Array.from({ length: phrase.length * 4 }).map((_, i) => (
                        <div key={`v-${i}`} style={{
                            position: 'absolute',
                            left: `${i * cellWidth}px`,
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
                                top: `${i * cellHeight}px`,
                                height: `${cellHeight}px`,
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
                                    left: `${note.startTime * cellWidth}px`,
                                    top: `${keyIndex * cellHeight + 1}px`,
                                    width: `${note.duration * cellWidth - 2}px`,
                                    height: `${cellHeight - 2}px`,
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
                                    left: `${xIndex * cellWidth}px`,
                                    top: `${yIndex * cellHeight}px`,
                                    width: `${cellWidth}px`,
                                    height: `${cellHeight}px`,
                                    zIndex: 5,
                                    cursor: 'crosshair'
                                }}
                            />
                        ))
                    ))}

                    {/* Hand Separation Lines */}
                    {separatorEnabled && handSeparators.map((separator, idx) => {
                        const nextSeparator = handSeparators.find(s => s.fromMeasure > separator.fromMeasure);
                        const lineStart = separator.fromMeasure * 4 * cellWidth; // Convert measure to beats to pixels
                        const lineEnd = nextSeparator
                            ? nextSeparator.fromMeasure * 4 * cellWidth
                            : phrase.length * 4 * cellWidth;

                        return (
                            <div
                                key={idx}
                                onMouseDown={(e) => handleSeparatorMouseDown(e, idx)}
                                style={{
                                    position: 'absolute',
                                    left: `${lineStart}px`,
                                    width: `${lineEnd - lineStart}px`,
                                    top: `${keys.indexOf(separator.pitch) * cellHeight}px`,
                                    height: '3px',
                                    background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
                                    cursor: 'move',
                                    zIndex: 50,
                                    boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                                    transition: dragState?.type === 'separator' && dragState.separatorIndex === idx ? 'none' : 'all 0.1s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    paddingLeft: '0.5rem'
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
                                    pointerEvents: 'none',
                                    whiteSpace: 'nowrap'
                                }}>
                                    MG ↕ MD (M{separator.fromMeasure + 1})
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        </div>
    );

    // Render with fullscreen wrapper if enabled
    if (isFullscreen) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                background: 'var(--bg-primary)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {pianoRollContent}
            </div>
        );
    }

    return pianoRollContent;
}
