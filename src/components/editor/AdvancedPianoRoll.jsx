import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getPianoRollKeys, getFrenchNoteName, getMidiNumber } from '../../models/song';
import { audioEngine } from '../../services/AudioEngine';
import { useNoteSelection, useNoteClipboard } from '../../hooks/useNoteSelection';
import { useScaleContext } from '../../hooks/useScaleContext';
import { MidiRecorder } from './MidiRecorder';

const CELL_WIDTH = 40; // px per beat
const CELL_HEIGHT = 24; // px per note

/**
 * Advanced Piano Roll Component
 *
 * Features:
 * - Note selection (rectangle, multi-select)
 * - Copy/Cut/Paste/Duplicate
 * - Scale highlighting
 * - MIDI recording
 * - Improved zoom/scroll
 * - Keyboard shortcuts
 */
export function AdvancedPianoRoll({
    phrase,
    keySignature,
    tempo = 120,
    onAddNote,
    onRemoveNote,
    onUpdateNote,
    onUpdateHandSeparators,
    onClose
}) {
    const [keys] = useState(() => getPianoRollKeys(1, 5));
    const scrollRef = useRef(null);
    const [dragState, setDragState] = useState(null);
    const lastPlayedPitchRef = useRef(null);

    // Advanced features
    const [zoom, setZoom] = useState(0.75);
    const [showScaleHighlight, setShowScaleHighlight] = useState(true);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridSize, setGridSize] = useState(0.25); // 1/16 note

    const cellWidth = CELL_WIDTH * zoom;
    const cellHeight = CELL_HEIGHT * zoom;

    // Hooks
    const {
        selectedNoteIdsSet,
        selectionRect,
        selectNote,
        selectNotes,
        clearSelection,
        selectAll,
        isSelected,
        startRectSelection,
        updateRectSelection,
        endRectSelection,
        cancelRectSelection
    } = useNoteSelection();

    const {
        copy,
        cut,
        paste,
        duplicate,
        hasClipboard
    } = useNoteClipboard();

    const { isInScale, keySignature: normalizedKeySignature } = useScaleContext(keySignature);

    // Hand separation
    const handSeparators = phrase.handSeparators || [];
    const [separatorEnabled, setSeparatorEnabled] = useState(handSeparators.length > 0);

    // Combine notes from both tracks
    const allNotes = [
        ...phrase.tracks.melody.map(n => ({ ...n, trackName: 'melody' })),
        ...phrase.tracks.chords.map(n => ({ ...n, trackName: 'chords' }))
    ];

    // Get selected notes
    const selectedNotes = allNotes.filter(note => isSelected(note.id));

    // Snap value to grid
    const snapValue = useCallback((value) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    }, [snapToGrid, gridSize]);

    // Handle grid click
    const handleGridClick = useCallback((pitch, beatIndex) => {
        // Check if note exists at this position
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
            const autoTrack = pitch >= 60 ? 'melody' : 'chords';
            const snappedBeat = snapValue(beatIndex);
            onAddNote(phrase.id, autoTrack, pitch, snappedBeat, gridSize);
            audioEngine.playNote(pitch);
        }
    }, [phrase, onAddNote, onRemoveNote, snapValue, gridSize]);

    // Handle note mouse down
    const handleNoteMouseDown = useCallback((e, note, type) => {
        e.stopPropagation();
        e.preventDefault();

        // Check if note is already selected
        const noteIsSelected = isSelected(note.id);

        // Multi-select with Ctrl/Cmd
        if (e.ctrlKey || e.metaKey) {
            selectNote(note.id, true);
        } else if (!noteIsSelected) {
            // If clicking on unselected note, select only this one
            selectNote(note.id, false);
        }
        // If clicking on selected note, keep selection

        lastPlayedPitchRef.current = note.pitch;
        setDragState({
            type,
            noteId: note.id,
            trackName: note.trackName,
            startX: e.clientX,
            startY: e.clientY,
            originalNote: { ...note },
            hasMoved: false,
            isMultiDrag: noteIsSelected && selectedNoteIdsSet.size > 1
        });
    }, [isSelected, selectNote, selectedNoteIdsSet]);

    // Handle mouse move (drag)
    const handleMouseMove = useCallback((e) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        const hasMoved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;
        if (hasMoved && !dragState.hasMoved) {
            setDragState(prev => ({ ...prev, hasMoved: true }));
        }

        const deltaBeats = deltaX / cellWidth;
        const deltaPitch = Math.round(deltaY / cellHeight);

        if (dragState.type === 'resize') {
            const newDuration = Math.max(gridSize, dragState.originalNote.duration + deltaBeats);
            const snappedDuration = snapValue(newDuration);

            if (dragState.isMultiDrag) {
                // Resize all selected notes
                selectedNotes.forEach(note => {
                    if (snappedDuration !== note.duration) {
                        onUpdateNote(phrase.id, note.trackName, note.id, {
                            duration: snappedDuration
                        });
                    }
                });
            } else {
                if (snappedDuration !== dragState.originalNote.duration) {
                    onUpdateNote(phrase.id, dragState.trackName, dragState.noteId, {
                        duration: snappedDuration
                    });
                }
            }
        } else if (dragState.type === 'move') {
            const newStartTime = Math.max(0, dragState.originalNote.startTime + deltaBeats);
            const snappedStartTime = snapValue(newStartTime);

            const originalKeyIndex = keys.indexOf(dragState.originalNote.pitch);
            const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
            const newPitch = keys[newKeyIndex];

            if (dragState.isMultiDrag) {
                // Move all selected notes
                selectedNotes.forEach(note => {
                    const noteDeltaBeats = snappedStartTime - dragState.originalNote.startTime;
                    const noteNewStartTime = Math.max(0, note.startTime + noteDeltaBeats);
                    const noteSnappedStartTime = snapValue(noteNewStartTime);

                    const noteOriginalKeyIndex = keys.indexOf(note.pitch);
                    const noteNewKeyIndex = Math.max(0, Math.min(keys.length - 1, noteOriginalKeyIndex + deltaPitch));
                    const noteNewPitch = keys[noteNewKeyIndex];

                    if (noteSnappedStartTime !== note.startTime || noteNewPitch !== note.pitch) {
                        onUpdateNote(phrase.id, note.trackName, note.id, {
                            startTime: noteSnappedStartTime,
                            pitch: noteNewPitch
                        });
                    }
                });

                if (newPitch !== lastPlayedPitchRef.current) {
                    audioEngine.playNote(newPitch);
                    lastPlayedPitchRef.current = newPitch;
                }
            } else {
                if (snappedStartTime !== dragState.originalNote.startTime || newPitch !== dragState.originalNote.pitch) {
                    onUpdateNote(phrase.id, dragState.trackName, dragState.noteId, {
                        startTime: snappedStartTime,
                        pitch: newPitch
                    });

                    if (newPitch !== lastPlayedPitchRef.current) {
                        audioEngine.playNote(newPitch);
                        lastPlayedPitchRef.current = newPitch;
                    }
                }
            }
        }
    }, [dragState, cellWidth, cellHeight, keys, snapValue, gridSize, selectedNotes, phrase, onUpdateNote]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        if (dragState && !dragState.hasMoved && dragState.type !== 'separator') {
            // Click without drag - handled by selection already
        }
        setDragState(null);
    }, [dragState]);

    // Handle background mouse down (start rect selection)
    const handleBackgroundMouseDown = useCallback((e) => {
        if (e.target.dataset.clickarea) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (!e.ctrlKey && !e.metaKey) {
                clearSelection();
            }

            startRectSelection(x, y);
        }
    }, [clearSelection, startRectSelection]);

    // Handle rectangle selection drag
    useEffect(() => {
        if (selectionRect !== null) {
            const handleMouseMove = (e) => {
                if (!scrollRef.current) return;
                const rect = scrollRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
                const y = e.clientY - rect.top + scrollRef.current.scrollTop;
                updateRectSelection(x, y);
            };

            const handleMouseUp = (e) => {
                endRectSelection(allNotes, cellWidth, cellHeight, keys, e.ctrlKey || e.metaKey);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);

            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [selectionRect, allNotes, cellWidth, cellHeight, keys, updateRectSelection, endRectSelection]);

    // Handle drag state
    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragState, handleMouseMove, handleMouseUp]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Delete selected notes
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    selectedNotes.forEach(note => {
                        onRemoveNote(phrase.id, note.trackName, note.id);
                    });
                    clearSelection();
                }
            }

            // Select all
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                selectAll(allNotes.map(n => n.id));
            }

            // Copy
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    copy(selectedNotes);
                }
            }

            // Cut
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    const { clipboardData, noteIdsToDelete } = cut(selectedNotes);
                    noteIdsToDelete.forEach(id => {
                        const note = allNotes.find(n => n.id === id);
                        if (note) {
                            onRemoveNote(phrase.id, note.trackName, id);
                        }
                    });
                    clearSelection();
                }
            }

            // Paste
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (hasClipboard()) {
                    e.preventDefault();
                    const pastedNotes = paste(0); // Paste at start
                    pastedNotes.forEach(note => {
                        onAddNote(phrase.id, note.trackName, note.pitch, note.startTime, note.duration);
                    });
                }
            }

            // Duplicate
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    // Find max end time of selected notes
                    const maxEndTime = Math.max(...selectedNotes.map(n => n.startTime + n.duration));
                    const offset = Math.ceil(maxEndTime / 4) * 4; // Round up to next measure

                    const duplicatedNotes = duplicate(selectedNotes, offset);
                    duplicatedNotes.forEach(note => {
                        onAddNote(phrase.id, note.trackName, note.pitch, note.startTime, note.duration);
                    });
                }
            }

            // Escape to close
            if (e.key === 'Escape') {
                if (selectedNotes.length > 0) {
                    clearSelection();
                } else {
                    onClose();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNotes, allNotes, phrase, onAddNote, onRemoveNote, clearSelection, selectAll, copy, cut, paste, duplicate, hasClipboard, onClose]);

    // Handle MIDI recording complete
    const handleRecordingComplete = useCallback((recordedNotes) => {
        recordedNotes.forEach(note => {
            // Auto-assign track based on pitch
            const trackName = note.pitch >= 60 ? 'melody' : 'chords';
            onAddNote(phrase.id, trackName, note.pitch, note.startTime, note.duration);
        });
    }, [phrase, onAddNote]);

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9998,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(4px)'
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                background: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                    background: 'var(--bg-secondary)'
                }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: '600' }}>
                        🎹 Éditeur Avancé - {phrase.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {selectedNotes.length > 0 && (
                            <div style={{
                                padding: '0.5rem 1rem',
                                background: 'rgba(139, 92, 246, 0.1)',
                                border: '1px solid var(--accent-primary)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--accent-primary)',
                                fontWeight: '600',
                                fontSize: '0.875rem'
                            }}>
                                {selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''} sélectionnée{selectedNotes.length > 1 ? 's' : ''}
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'var(--gradient-primary)',
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
                                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>✕</span>
                            <span>Fermer</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden',
                    gap: '1rem'
                }}>
                    {/* MIDI Recorder */}
                    <MidiRecorder
                        tempo={tempo}
                        phraseLength={phrase.length}
                        onRecordingComplete={handleRecordingComplete}
                    />

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
                        </div>

                        {/* Grid Size */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                Grille:
                            </label>
                            <select
                                value={gridSize}
                                onChange={(e) => setGridSize(parseFloat(e.target.value))}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value={1}>1/4</option>
                                <option value={0.5}>1/8</option>
                                <option value={0.25}>1/16</option>
                                <option value={0.125}>1/32</option>
                            </select>
                        </div>

                        {/* Snap to Grid */}
                        <button
                            onClick={() => setSnapToGrid(!snapToGrid)}
                            style={{
                                background: snapToGrid ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                                color: snapToGrid ? 'white' : 'var(--text-secondary)',
                                border: snapToGrid ? 'none' : '1px solid var(--border-light)',
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            {snapToGrid ? '✓' : '○'} Magnétisme
                        </button>

                        {/* Scale Highlight */}
                        <button
                            onClick={() => setShowScaleHighlight(!showScaleHighlight)}
                            style={{
                                background: showScaleHighlight ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                                color: showScaleHighlight ? 'white' : 'var(--text-secondary)',
                                border: showScaleHighlight ? 'none' : '1px solid var(--border-light)',
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            {showScaleHighlight ? '✓' : '○'} Gamme {normalizedKeySignature}
                        </button>

                        {/* Clear Selection */}
                        {selectedNotes.length > 0 && (
                            <button
                                onClick={clearSelection}
                                style={{
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-light)',
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                Désélectionner
                            </button>
                        )}
                    </div>

                    {/* Piano Roll */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        backgroundColor: 'var(--bg-primary)',
                        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
                        userSelect: 'none'
                    }}>
                        <div
                            ref={scrollRef}
                            style={{
                                flex: 1,
                                overflow: 'auto',
                                position: 'relative',
                                background: 'linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)'
                            }}
                            onMouseDown={handleBackgroundMouseDown}
                        >
                            <div style={{
                                width: `${90 + phrase.length * 4 * cellWidth}px`,
                                minHeight: '100%',
                                position: 'relative',
                                display: 'flex'
                            }}>
                                {/* Piano Keys */}
                                <div style={{
                                    position: 'sticky',
                                    left: 0,
                                    width: '90px',
                                    zIndex: 100,
                                    background: 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 100%)',
                                    borderRight: '2px solid var(--border-color)',
                                    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
                                    flexShrink: 0,
                                    paddingTop: '32px'
                                }}>
                                    {keys.map(pitch => {
                                        const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
                                        const inScale = showScaleHighlight && isInScale(pitch);

                                        return (
                                            <div key={pitch} style={{
                                                height: `${cellHeight}px`,
                                                background: isBlack
                                                    ? 'linear-gradient(90deg, #2c3e50 0%, #34495e 100%)'
                                                    : inScale
                                                    ? 'linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%)'
                                                    : 'linear-gradient(90deg, #ffffff 0%, #f8f9fa 100%)',
                                                color: isBlack ? '#ecf0f1' : inScale ? '#1e40af' : '#2c3e50',
                                                borderBottom: `1px solid ${isBlack ? '#1a252f' : '#dee2e6'}`,
                                                fontSize: '0.8125rem',
                                                fontWeight: inScale ? '700' : '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                paddingLeft: '0.75rem',
                                                boxSizing: 'border-box',
                                                transition: 'all var(--transition-fast)',
                                                cursor: 'pointer',
                                                position: 'relative'
                                            }}>
                                                {getFrenchNoteName(pitch, keySignature)}
                                                {inScale && (
                                                    <span style={{
                                                        position: 'absolute',
                                                        right: '0.5rem',
                                                        fontSize: '0.7rem',
                                                        opacity: 0.6
                                                    }}>
                                                        ●
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Grid content */}
                                <div style={{
                                    flex: 1,
                                    position: 'relative'
                                }}>
                                    {/* Measure Counter */}
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
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
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
                                        {/* Vertical grid lines */}
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

                                        {/* Horizontal grid lines with scale highlighting */}
                                        {keys.map((pitch, i) => {
                                            const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
                                            const inScale = showScaleHighlight && isInScale(pitch);

                                            return (
                                                <div key={`h-${i}`} style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    right: 0,
                                                    top: `${i * cellHeight}px`,
                                                    height: `${cellHeight}px`,
                                                    backgroundColor: isBlack
                                                        ? 'rgba(0, 0, 0, 0.15)'
                                                        : inScale
                                                        ? 'rgba(59, 130, 246, 0.08)'
                                                        : 'transparent',
                                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                    boxSizing: 'border-box',
                                                    pointerEvents: 'none'
                                                }} />
                                            );
                                        })}

                                        {/* Notes */}
                                        {allNotes.map(note => {
                                            const notePitch = typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch;
                                            const keyIndex = keys.indexOf(notePitch);
                                            if (keyIndex === -1) return null;

                                            const noteIsSelected = isSelected(note.id);
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
                                                            ? noteIsSelected
                                                                ? 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)'
                                                                : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                                                            : noteIsSelected
                                                            ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
                                                            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        cursor: isDragging ? 'grabbing' : 'grab',
                                                        boxShadow: noteIsSelected
                                                            ? '0 0 0 2px white, 0 4px 12px rgba(139, 92, 246, 0.6)'
                                                            : note.trackName === 'melody'
                                                            ? '0 2px 8px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                                                            : '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                                        zIndex: isDragging ? 100 : noteIsSelected ? 20 : 10,
                                                        transition: isDragging ? 'none' : 'all var(--transition-fast)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        opacity: isDragging ? 0.8 : 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}
                                                    onMouseDown={(e) => handleNoteMouseDown(e, note, 'move')}
                                                >
                                                    {/* Resize handle */}
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

                                        {/* Click areas */}
                                        {!dragState && keys.map((pitch, yIndex) => (
                                            Array.from({ length: phrase.length * 4 }).map((_, xIndex) => (
                                                <div
                                                    key={`${pitch}-${xIndex}`}
                                                    data-clickarea="true"
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

                                        {/* Selection rectangle */}
                                        {selectionRect && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${selectionRect.x}px`,
                                                top: `${selectionRect.y}px`,
                                                width: `${selectionRect.width}px`,
                                                height: `${selectionRect.height}px`,
                                                border: '2px dashed rgba(139, 92, 246, 0.8)',
                                                background: 'rgba(139, 92, 246, 0.1)',
                                                pointerEvents: 'none',
                                                zIndex: 200
                                            }} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Keyboard shortcuts hint */}
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        gap: '1.5rem',
                        flexWrap: 'wrap'
                    }}>
                        <span><strong>Ctrl+A</strong> Tout sélectionner</span>
                        <span><strong>Ctrl+C</strong> Copier</span>
                        <span><strong>Ctrl+X</strong> Couper</span>
                        <span><strong>Ctrl+V</strong> Coller</span>
                        <span><strong>Ctrl+D</strong> Dupliquer</span>
                        <span><strong>Suppr</strong> Effacer</span>
                        <span><strong>Échap</strong> Fermer</span>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
