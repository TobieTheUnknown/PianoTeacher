import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { getPianoRollKeys, getFrenchNoteName, getNoteNameFromMidi, getMidiNumber } from '../models/song';
import { audioEngine } from '../services/AudioEngine';
import { usePlaybackPosition } from '../hooks/usePlaybackPosition';

// Lazy load the advanced piano roll
const AdvancedPianoRoll = lazy(() => import('./editor/AdvancedPianoRoll').then(module => ({ default: module.AdvancedPianoRoll })));

const CELL_WIDTH = 40; // px per beat
const CELL_HEIGHT = 24; // px per note

export function PianoRoll({ phrase, phraseIndex, allPhrases, keySignature, tempo = 120, onAddNote, onRemoveNote, onUpdateNote, onUpdatePhraseLength, onSplit, isSplitMode, splitTime, onSplitTimeChange, onConfirmSplit, onCancelSplit, isCurrentlyPlaying = false }) {
    // Compute key range dynamically so notes outside the default octave 1-5 range are always visible
    const keys = useMemo(() => {
        const allPitches = [
            ...phrase.tracks.melody,
            ...phrase.tracks.chords
        ]
            .map(n => typeof n.pitch === 'string' ? getMidiNumber(n.pitch) : n.pitch)
            .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

        // Default range: octave 1 to 5 (MIDI 24–83)
        let startOctave = 1;
        let endOctave = 5;

        if (allPitches.length > 0) {
            const minPitch = Math.min(...allPitches);
            const maxPitch = Math.max(...allPitches);
            // octave formula (matching getPianoRollKeys): octave = floor((midi - 12) / 12)
            const minOctave = Math.floor((minPitch - 12) / 12);
            const maxOctave = Math.floor((maxPitch - 12) / 12);
            startOctave = Math.min(startOctave, minOctave);
            endOctave = Math.max(endOctave, maxOctave);
        }

        return getPianoRollKeys(startOctave, endOctave);
    }, [phrase.tracks.melody, phrase.tracks.chords]);
    const scrollRef = useRef(null);
    const [dragState, setDragState] = useState(null); // { type: 'move'|'resize', noteId, startX, startY, originalNote, trackName }
    const lastPlayedPitchRef = useRef(null); // Track last played pitch for audio feedback

    // Fullscreen and zoom
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoom, setZoom] = useState(0.5); // 0.5 = 50% (default), 1 = 100%, 1.5 = 150%, etc.

    const cellWidth = CELL_WIDTH * zoom;
    const cellHeight = CELL_HEIGHT * zoom;

    // Phrase length in beats
    const phraseLengthBeats = phrase.length * 4;

    // Track playback position
    const { playbackPosition, isPlaying } = usePlaybackPosition();

    // Combine notes from both tracks with track information
    // Filter out notes that don't match our key range or numeric format
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
            // pitch is now a MIDI number
            const autoTrack = pitch >= 60 ? 'melody' : 'chords';
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
        }
    };

    const handleMouseUp = () => {
        // If mouse didn't move, treat as click to delete note
        if (dragState && !dragState.hasMoved) {
            if (dragState.noteId) {
                onRemoveNote(phrase.id, dragState.trackName, dragState.noteId);
            }
        }
        setDragState(null);
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

    // Block body scroll and handle Escape key when fullscreen is active
    useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = 'hidden';

            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    setIsFullscreen(false);
                }
            };

            window.addEventListener('keydown', handleEscape);

            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isFullscreen]);

    const pianoRollContent = (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            ...(isFullscreen ? { flex: '1', minHeight: 0 } : { height: '100%' })
        }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

                {/* Fullscreen Toggle - only show when not in fullscreen */}
                {!isFullscreen && (
                    <button
                        onClick={() => setIsFullscreen(true)}
                        style={{
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-light)',
                            padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            marginLeft: 'auto'
                        }}
                    >
                        ⤢ Plein écran
                    </button>
                )}
            </div>

            <div className="piano-roll" style={{
                display: 'flex',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                ...(isFullscreen ? { flex: '1', minHeight: 0 } : { height: '450px' }),
                overflow: 'hidden',
                backgroundColor: 'var(--bg-primary)',
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
                userSelect: 'none'
            }}>
                {/* Grid (Content) - Now contains both piano keys and grid */}
                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        position: 'relative',
                        background: 'linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)'
                    }}
                >
                    <div style={{
                        width: `${90 + phrase.length * 4 * cellWidth}px`, // Piano keys width + grid width
                        minHeight: '100%',
                        position: 'relative',
                        display: 'flex'
                    }}>
                        {/* Piano Keys (Y-axis) - Sticky on left */}
                        <div style={{
                            position: 'sticky',
                            left: 0,
                            width: '90px',
                            zIndex: 100,
                            background: 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 100%)',
                            borderRight: '2px solid var(--border-color)',
                            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
                            flexShrink: 0,
                            paddingTop: '32px' // Match measure counter height
                        }}>
                            {keys.map(pitch => {
                                // Check if black key using helper or simple mod check
                                // pitch is a number now
                                const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
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
                                        {getFrenchNoteName(pitch, keySignature)}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Grid content wrapper */}
                        <div style={{
                            flex: 1,
                            position: 'relative'
                        }}>
                            {/* Measure Counter - Sticky at top, scrolls horizontally with content */}
                            <div style={{
                                position: 'sticky',
                                top: 0,
                                left: 0,
                                height: '32px',
                                background: 'linear-gradient(180deg, rgba(30, 36, 53, 0.95) 0%, rgba(30, 36, 53, 0.9) 100%)',
                                backdropFilter: 'blur(8px)',
                                borderBottom: '2px solid var(--accent-primary)',
                                display: 'flex',
                                zIndex: 50,
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                marginBottom: '0px'
                            }}>
                                {Array.from({ length: phrase.length }).map((_, measureIndex) => (
                                    <div key={`measure-${measureIndex}`} style={{
                                        width: `${4 * cellWidth}px`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: '700',
                                        fontSize: '1rem',
                                        color: 'var(--text-primary)',
                                        borderRight: measureIndex < phrase.length - 1 ? '1px solid rgba(139, 92, 246, 0.3)' : 'none',
                                        background: measureIndex % 2 === 0 ? 'rgba(139, 92, 246, 0.15)' : 'transparent'
                                    }}>
                                        {measureIndex + 1}
                                    </div>
                                ))}
                            </div>

                            {/* Grid content */}
                            <div style={{
                                width: '100%',
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
                                    const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
                                    return (
                                        <div key={`h-${i}`} style={{
                                            position: 'absolute',
                                            left: 0,
                                            right: 0,
                                            top: `${i * cellHeight}px`,
                                            height: `${cellHeight}px`,
                                            backgroundColor: isBlack ? 'rgba(0, 0, 0, 0.15)' : 'transparent',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                            boxSizing: 'border-box',
                                            pointerEvents: 'none'
                                        }} />
                                    );
                                })}

                                {/* Notes */}
                                {allNotes.map(note => {
                                    // Allow string notes (from old data) but try to handle them if possible
                                    // Migration should handle this, but defensive coding is good
                                    const notePitch = typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch;

                                    const keyIndex = keys.indexOf(notePitch);
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

                                {/* Playback head - only show if this phrase is currently playing */}
                                {isCurrentlyPlaying && isPlaying && playbackPosition >= 0 && playbackPosition < phraseLengthBeats && (
                                    <div style={{
                                        position: 'absolute',
                                        left: `${playbackPosition * cellWidth}px`,
                                        top: 0,
                                        bottom: 0,
                                        width: '3px',
                                        background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.7) 100%)',
                                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.6), 0 0 16px rgba(239, 68, 68, 0.3)',
                                        pointerEvents: 'none',
                                        zIndex: 150
                                    }}>
                                        {/* Playhead top marker */}
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: '-6px',
                                            width: 0,
                                            height: 0,
                                            borderLeft: '6px solid transparent',
                                            borderRight: '6px solid transparent',
                                            borderTop: '8px solid rgba(239, 68, 68, 0.95)',
                                            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                                        }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // Render advanced piano roll in fullscreen mode (lazy loaded)
    if (isFullscreen) {
        return (
            <Suspense fallback={
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    background: 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: 'var(--text-secondary)'
                }}>
                    Chargement de l'éditeur avancé...
                </div>
            }>
                <AdvancedPianoRoll
                    phrase={phrase}
                    allPhrases={[phrase]}
                    keySignature={keySignature}
                    tempo={tempo}
                    onAddNote={onAddNote}
                    onRemoveNote={onRemoveNote}
                    onUpdateNote={onUpdateNote}
                    onUpdatePhraseLength={onUpdatePhraseLength}
                    onClose={() => setIsFullscreen(false)}
                />
            </Suspense>
        );
    }

    return pianoRollContent;
}
