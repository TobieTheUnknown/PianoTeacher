import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getPianoRollKeys, getFrenchNoteName, getMidiNumber } from '../../models/song';
import { audioEngine } from '../../services/AudioEngine';
import { useNoteSelection, useNoteClipboard } from '../../hooks/useNoteSelection';
import { useScaleContext } from '../../hooks/useScaleContext';
import { usePlaybackPosition } from '../../hooks/usePlaybackPosition';
import { MidiRecorder } from './MidiRecorder';

const CELL_WIDTH = 40; // px per beat
const CELL_HEIGHT = 24; // px per note

/**
 * Advanced Piano Roll Component with Multi-Phrase Continuous View
 */
export function AdvancedPianoRoll({
    phrase,
    allPhrases,
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

    // Use allPhrases if provided, otherwise fallback to single phrase
    const phrases = useMemo(() => allPhrases || [phrase], [allPhrases, phrase]);

    // Helper to get note name without octave (French notation)
    const getNoteName = useCallback((pitch) => {
        const fullName = getFrenchNoteName(pitch, keySignature);
        return fullName.replace(/[0-9-]+$/, '');
    }, [keySignature]);

    // Calculate phrase layouts (cumulative offsets)
    const phraseLayouts = useMemo(() => {
        const layouts = [];
        let cumulativeBeats = 0;
        let cumulativeMeasures = 0;

        phrases.forEach((p, index) => {
            const phraseLengthBeats = p.length * 4;

            layouts.push({
                phraseId: p.id,
                phraseIndex: index,
                phraseName: p.name,
                startBeat: cumulativeBeats,
                endBeat: cumulativeBeats + phraseLengthBeats,
                lengthBeats: phraseLengthBeats,
                startMeasure: cumulativeMeasures,
                endMeasure: cumulativeMeasures + p.length,
                lengthMeasures: p.length,
                startX: cumulativeBeats * cellWidth,
                endX: (cumulativeBeats + phraseLengthBeats) * cellWidth,
                widthX: phraseLengthBeats * cellWidth
            });

            cumulativeBeats += phraseLengthBeats;
            cumulativeMeasures += p.length;
        });

        return {
            layouts,
            totalBeats: cumulativeBeats,
            totalMeasures: cumulativeMeasures,
            totalWidth: cumulativeBeats * cellWidth + 90
        };
    }, [phrases, cellWidth]);

    // Transform notes to global coordinates
    const allNotesGlobal = useMemo(() => {
        const notes = [];

        phraseLayouts.layouts.forEach(layout => {
            const p = phrases.find(ph => ph.id === layout.phraseId);

            ['melody', 'chords'].forEach(trackName => {
                p.tracks[trackName].forEach(note => {
                    notes.push({
                        ...note,
                        phraseId: layout.phraseId,
                        phraseName: layout.phraseName,
                        trackName,
                        localStartTime: note.startTime,
                        globalStartTime: layout.startBeat + note.startTime,
                        globalEndTime: layout.startBeat + note.startTime + note.duration,
                        globalX: (layout.startBeat + note.startTime) * cellWidth
                    });
                });
            });
        });

        return notes;
    }, [phrases, phraseLayouts, cellWidth]);

    // Get phrase at global beat position
    const getPhraseAtBeat = useCallback((globalBeat) => {
        const layout = phraseLayouts.layouts.find(
            l => globalBeat >= l.startBeat && globalBeat < l.endBeat
        );

        if (!layout) return null;

        return {
            layout,
            phrase: phrases.find(p => p.id === layout.phraseId),
            localBeat: globalBeat - layout.startBeat
        };
    }, [phraseLayouts, phrases]);

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

    // Track playback position for playhead visualization
    const { playbackPosition, isPlaying } = usePlaybackPosition();

    // Get selected notes
    const selectedNotes = allNotesGlobal.filter(note => isSelected(note.id));

    // Snap value to grid
    const snapValue = useCallback((value) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    }, [snapToGrid, gridSize]);

    // Handle grid click
    const handleGridClick = useCallback((pitch, globalBeatIndex) => {
        const phraseInfo = getPhraseAtBeat(globalBeatIndex);
        if (!phraseInfo) return;

        const localBeat = globalBeatIndex - phraseInfo.layout.startBeat;
        const snappedLocalBeat = snapValue(localBeat);

        // Check for existing note
        const existingNote = allNotesGlobal.find(
            n => n.pitch === pitch && Math.abs(n.globalStartTime - globalBeatIndex) < 0.1
        );

        if (existingNote) {
            onRemoveNote(existingNote.phraseId, existingNote.trackName, existingNote.id);
        } else {
            const autoTrack = pitch >= 60 ? 'melody' : 'chords';
            onAddNote(phraseInfo.phrase.id, autoTrack, pitch, snappedLocalBeat, gridSize);
            audioEngine.playNote(pitch);
        }
    }, [getPhraseAtBeat, allNotesGlobal, onAddNote, onRemoveNote, snapValue, gridSize]);

    // Handle note mouse down
    const handleNoteMouseDown = useCallback((e, note, type) => {
        e.stopPropagation();
        e.preventDefault();

        const noteIsSelected = isSelected(note.id);

        if (e.ctrlKey || e.metaKey) {
            selectNote(note.id, true);
        } else if (!noteIsSelected) {
            selectNote(note.id, false);
        }

        if (!scrollRef.current) return;
        const rect = scrollRef.current.getBoundingClientRect();
        const gridX = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const gridY = e.clientY - rect.top + scrollRef.current.scrollTop;

        lastPlayedPitchRef.current = note.pitch;
        setDragState({
            type,
            noteId: note.id,
            trackName: note.trackName,
            phraseId: note.phraseId,
            startX: gridX,
            startY: gridY,
            originalNote: { ...note },
            hasMoved: false,
            isMultiDrag: noteIsSelected && selectedNoteIdsSet.size > 1
        });
    }, [isSelected, selectNote, selectedNoteIdsSet]);

    // Handle mouse move (drag)
    const handleMouseMove = useCallback((e) => {
        if (!dragState || !scrollRef.current) return;

        const rect = scrollRef.current.getBoundingClientRect();
        const gridX = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const gridY = e.clientY - rect.top + scrollRef.current.scrollTop;

        const deltaX = gridX - dragState.startX;
        const deltaY = gridY - dragState.startY;

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
                const deltaDuration = snappedDuration - dragState.originalNote.duration;
                selectedNotes.forEach(note => {
                    const noteNewDuration = Math.max(gridSize, note.duration + deltaDuration);
                    const noteSnappedDuration = snapValue(noteNewDuration);

                    if (noteSnappedDuration !== note.duration) {
                        onUpdateNote(note.phraseId, note.trackName, note.id, {
                            duration: noteSnappedDuration
                        });
                    }
                });
            } else {
                if (snappedDuration !== dragState.originalNote.duration) {
                    onUpdateNote(dragState.phraseId, dragState.trackName, dragState.noteId, {
                        duration: snappedDuration
                    });
                }
            }
        } else if (dragState.type === 'move') {
            const newLocalStartTime = Math.max(0, dragState.originalNote.localStartTime + deltaBeats);
            const snappedLocalStartTime = snapValue(newLocalStartTime);

            const originalKeyIndex = keys.indexOf(dragState.originalNote.pitch);
            const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
            const newPitch = keys[newKeyIndex];

            if (dragState.isMultiDrag) {
                selectedNotes.forEach(note => {
                    const noteDelta = snappedLocalStartTime - dragState.originalNote.localStartTime;
                    const noteNewLocalTime = Math.max(0, note.localStartTime + noteDelta);
                    const noteSnappedLocalTime = snapValue(noteNewLocalTime);

                    const noteOriginalKeyIndex = keys.indexOf(note.pitch);
                    const noteNewKeyIndex = Math.max(0, Math.min(keys.length - 1, noteOriginalKeyIndex + deltaPitch));
                    const noteNewPitch = keys[noteNewKeyIndex];

                    if (noteSnappedLocalTime !== note.localStartTime || noteNewPitch !== note.pitch) {
                        onUpdateNote(note.phraseId, note.trackName, note.id, {
                            startTime: noteSnappedLocalTime,
                            pitch: noteNewPitch
                        });
                    }
                });

                if (newPitch !== lastPlayedPitchRef.current) {
                    audioEngine.playNote(newPitch);
                    lastPlayedPitchRef.current = newPitch;
                }
            } else {
                if (snappedLocalStartTime !== dragState.originalNote.localStartTime || newPitch !== dragState.originalNote.pitch) {
                    onUpdateNote(dragState.phraseId, dragState.trackName, dragState.noteId, {
                        startTime: snappedLocalStartTime,
                        pitch: newPitch
                    });

                    if (newPitch !== lastPlayedPitchRef.current) {
                        audioEngine.playNote(newPitch);
                        lastPlayedPitchRef.current = newPitch;
                    }
                }
            }
        }
    }, [dragState, cellWidth, cellHeight, keys, snapValue, gridSize, selectedNotes, onUpdateNote]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        setDragState(null);
    }, []);

    // Handle background mouse down (start rect selection)
    const handleBackgroundMouseDown = useCallback((e) => {
        if (e.target.dataset.clickarea && scrollRef.current) {
            const rect = scrollRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
            const y = e.clientY - rect.top + scrollRef.current.scrollTop;

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
                if (!selectionRect) return;

                const { x, y, width, height } = selectionRect;

                const selectedIds = allNotesGlobal.filter(note => {
                    const noteX = note.globalX;
                    const noteY = keys.indexOf(note.pitch) * cellHeight;
                    const noteWidth = note.duration * cellWidth;
                    const noteHeight = cellHeight;

                    return !(
                        noteX + noteWidth < x ||
                        noteX > x + width ||
                        noteY + noteHeight < y ||
                        noteY > y + height
                    );
                }).map(note => note.id);

                selectNotes(selectedIds, e.ctrlKey || e.metaKey);
                cancelRectSelection();
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);

            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [selectionRect, allNotesGlobal, cellWidth, cellHeight, keys, updateRectSelection, selectNotes, cancelRectSelection]);

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
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    selectedNotes.forEach(note => {
                        onRemoveNote(note.phraseId, note.trackName, note.id);
                    });
                    clearSelection();
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                selectAll(allNotesGlobal.map(n => n.id));
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    copy(selectedNotes);
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    const { clipboardData, noteIdsToDelete } = cut(selectedNotes);
                    noteIdsToDelete.forEach(id => {
                        const note = allNotesGlobal.find(n => n.id === id);
                        if (note) {
                            onRemoveNote(note.phraseId, note.trackName, id);
                        }
                    });
                    clearSelection();
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (hasClipboard()) {
                    e.preventDefault();
                    const pastedNotes = paste(0);
                    if (pastedNotes.length > 0 && phrases.length > 0) {
                        pastedNotes.forEach(note => {
                            onAddNote(phrases[0].id, note.trackName, note.pitch, note.startTime, note.duration);
                        });
                    }
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                if (selectedNotes.length > 0) {
                    e.preventDefault();
                    const maxEndTime = Math.max(...selectedNotes.map(n => n.localStartTime + n.duration));
                    const offset = Math.ceil(maxEndTime / 4) * 4;

                    const duplicatedNotes = duplicate(selectedNotes, offset);
                    duplicatedNotes.forEach(note => {
                        const original = selectedNotes.find(n => n.id === note.id);
                        if (original) {
                            onAddNote(original.phraseId, note.trackName, note.pitch, note.startTime, note.duration);
                        }
                    });
                }
            }

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
    }, [selectedNotes, allNotesGlobal, phrases, onAddNote, onRemoveNote, clearSelection, selectAll, copy, cut, paste, duplicate, hasClipboard, onClose]);

    // Handle MIDI recording complete
    const handleRecordingComplete = useCallback((recordedNotes) => {
        if (phrases.length === 0) return;

        recordedNotes.forEach(note => {
            const trackName = note.pitch >= 60 ? 'melody' : 'chords';
            onAddNote(phrases[0].id, trackName, note.pitch, note.startTime, note.duration);
        });
    }, [phrases, onAddNote]);

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
                        🎹 Éditeur Avancé ({phrases.length} phrase{phrases.length > 1 ? 's' : ''}, {phraseLayouts.totalMeasures} mesures)
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
                        phraseLength={phrases[0]?.length || 4}
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
                                width: `${phraseLayouts.totalWidth}px`,
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
                                                {getNoteName(pitch)}
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
                                        {phraseLayouts.layouts.map((layout) => (
                                            Array.from({ length: layout.lengthMeasures }).map((_, measureOffset) => {
                                                const globalMeasureNum = layout.startMeasure + measureOffset;
                                                const isPhraseBoundary = measureOffset === 0;

                                                return (
                                                    <div
                                                        key={`measure-${layout.phraseId}-${measureOffset}`}
                                                        style={{
                                                            width: `${4 * cellWidth}px`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: isPhraseBoundary ? '900' : '700',
                                                            fontSize: isPhraseBoundary ? '1.1rem' : '1rem',
                                                            color: isPhraseBoundary ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                            borderRight: '1px solid rgba(139, 92, 246, 0.3)',
                                                            background: isPhraseBoundary
                                                                ? 'rgba(139, 92, 246, 0.3)'
                                                                : globalMeasureNum % 2 === 0
                                                                ? 'rgba(139, 92, 246, 0.15)'
                                                                : 'transparent'
                                                        }}
                                                    >
                                                        {globalMeasureNum + 1}
                                                    </div>
                                                );
                                            })
                                        ))}
                                    </div>

                                    {/* Grid content */}
                                    <div style={{
                                        width: '100%',
                                        height: `${keys.length * cellHeight}px`,
                                        position: 'relative'
                                    }}>
                                        {/* Phrase backgrounds (alternating) */}
                                        {phraseLayouts.layouts.map((layout, idx) => (
                                            <div
                                                key={`bg-${layout.phraseId}`}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${layout.startX}px`,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: `${layout.widthX}px`,
                                                    background: idx % 2 === 0 ? 'rgba(139, 92, 246, 0.03)' : 'transparent',
                                                    pointerEvents: 'none',
                                                    zIndex: 1
                                                }}
                                            />
                                        ))}

                                        {/* Phrase boundary separators */}
                                        {phraseLayouts.layouts.map((layout, idx) => {
                                            if (idx === 0) return null;

                                            return (
                                                <div
                                                    key={`separator-${layout.phraseId}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${layout.startX}px`,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: '3px',
                                                        background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.8) 0%, rgba(249, 115, 22, 0.8) 100%)',
                                                        zIndex: 40,
                                                        boxShadow: '0 0 12px rgba(245, 158, 11, 0.6)',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Phrase labels */}
                                        {phraseLayouts.layouts.map((layout) => (
                                            <div
                                                key={`label-${layout.phraseId}`}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${layout.startX + 8}px`,
                                                    top: '40px',
                                                    padding: '0.5rem 1rem',
                                                    background: 'rgba(139, 92, 246, 0.9)',
                                                    color: 'white',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '700',
                                                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.6)',
                                                    zIndex: 45,
                                                    pointerEvents: 'none',
                                                    backdropFilter: 'blur(4px)'
                                                }}
                                            >
                                                {layout.phraseName}
                                            </div>
                                        ))}

                                        {/* Vertical grid lines */}
                                        {Array.from({ length: phraseLayouts.totalBeats }).map((_, beatIndex) => (
                                            <div key={`v-${beatIndex}`} style={{
                                                position: 'absolute',
                                                left: `${beatIndex * cellWidth}px`,
                                                top: 0,
                                                bottom: 0,
                                                width: beatIndex % 4 === 0 ? '2px' : '1px',
                                                background: beatIndex % 4 === 0
                                                    ? 'linear-gradient(180deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%)'
                                                    : 'rgba(255, 255, 255, 0.05)',
                                                pointerEvents: 'none',
                                                zIndex: beatIndex % 4 === 0 ? 3 : 2
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
                                                    pointerEvents: 'none',
                                                    zIndex: 1
                                                }} />
                                            );
                                        })}

                                        {/* Notes */}
                                        {allNotesGlobal.map(note => {
                                            const notePitch = typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch;
                                            const keyIndex = keys.indexOf(notePitch);
                                            if (keyIndex === -1) return null;

                                            const noteIsSelected = isSelected(note.id);
                                            const isDragging = dragState?.noteId === note.id;

                                            return (
                                                <div
                                                    key={`${note.phraseId}-${note.trackName}-${note.id}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${note.globalX}px`,
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
                                                            transition: 'opacity 0.2s',
                                                            zIndex: 1
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
                                            Array.from({ length: phraseLayouts.totalBeats }).map((_, beatIndex) => (
                                                <div
                                                    key={`${pitch}-${beatIndex}`}
                                                    data-clickarea="true"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleGridClick(pitch, beatIndex);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${beatIndex * cellWidth}px`,
                                                        top: `${yIndex * cellHeight}px`,
                                                        width: `${cellWidth}px`,
                                                        height: `${cellHeight}px`,
                                                        zIndex: 5,
                                                        cursor: 'crosshair'
                                                    }}
                                                />
                                            ))
                                        ))}

                                        {/* Playback head */}
                                        {isPlaying && (
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
