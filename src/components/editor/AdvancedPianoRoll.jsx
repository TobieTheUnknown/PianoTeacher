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
 * Advanced Piano Roll Component - Single Phrase Editor
 */
export function AdvancedPianoRoll({
    phrase,
    keySignature,
    tempo = 120,
    onAddNote,
    onRemoveNote,
    onUpdateNote,
    onUpdatePhraseLength,
    onClose
}) {
    const [keys] = useState(() => getPianoRollKeys(1, 5));
    const scrollRef = useRef(null);
    const [dragState, setDragState] = useState(null);
    const lastPlayedPitchRef = useRef(null);
    const originalSelectedNotesRef = useRef(new Map());
    const dragThrottleRef = useRef(null);

    // Advanced features
    const [zoom, setZoom] = useState(0.75);
    const [showScaleHighlight, setShowScaleHighlight] = useState(true);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridSize, setGridSize] = useState(0.25); // 1/16 note
    const [metronomeEnabled, setMetronomeEnabled] = useState(false);
    const [metronomeSubdivision, setMetronomeSubdivision] = useState('quarter');
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [loopRegion, setLoopRegion] = useState(null);
    const [draggingLoopHandle, setDraggingLoopHandle] = useState(null);
    const [recordingPreviewNotes, setRecordingPreviewNotes] = useState([]);
    const [activeRecordingNotes, setActiveRecordingNotes] = useState([]);

    // Undo/Redo state
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isApplyingHistoryRef = useRef(false);

    const cellWidth = CELL_WIDTH * zoom;
    const cellHeight = CELL_HEIGHT * zoom;

    // Helper to get note name without octave
    const getNoteName = useCallback((pitch) => {
        const fullName = getFrenchNoteName(pitch, keySignature);
        return fullName.replace(/[0-9-]+$/, '');
    }, [keySignature]);

    // Hooks
    const {
        selectedNoteIdsSet,
        selectionRect,
        justEndedSelectionRef,
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

    // Track playback position
    const { playbackPosition, isPlaying, seek } = usePlaybackPosition();

    // Combine notes from both tracks
    const allNotes = useMemo(() => [
        ...phrase.tracks.melody.map(n => ({ ...n, trackName: 'melody' })),
        ...phrase.tracks.chords.map(n => ({ ...n, trackName: 'chords' }))
    ], [phrase.tracks.melody, phrase.tracks.chords]);

    // Get selected notes
    const selectedNotes = allNotes.filter(note => isSelected(note.id));

    // Phrase length in beats
    const phraseLengthBeats = phrase.length * 4;

    // Create snapshot for undo/redo
    const createSnapshot = useCallback(() => {
        return {
            id: phrase.id,
            melody: [...phrase.tracks.melody],
            chords: [...phrase.tracks.chords]
        };
    }, [phrase]);

    // Save state to history
    const saveStateToHistory = useCallback(() => {
        if (isApplyingHistoryRef.current) return;

        const snapshot = createSnapshot();
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(snapshot);
            if (newHistory.length > 50) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [createSnapshot, historyIndex]);

    // Undo
    const undo = useCallback(() => {
        if (historyIndex < 0) return;

        isApplyingHistoryRef.current = true;
        const previousState = history[historyIndex];

        // Restore melody
        previousState.melody.forEach(note => {
            if (!phrase.tracks.melody.find(n => n.id === note.id)) {
                onAddNote(phrase.id, 'melody', note.pitch, note.startTime, note.duration);
            }
        });
        phrase.tracks.melody.forEach(note => {
            if (!previousState.melody.find(n => n.id === note.id)) {
                onRemoveNote(phrase.id, 'melody', note.id);
            }
        });

        // Restore chords
        previousState.chords.forEach(note => {
            if (!phrase.tracks.chords.find(n => n.id === note.id)) {
                onAddNote(phrase.id, 'chords', note.pitch, note.startTime, note.duration);
            }
        });
        phrase.tracks.chords.forEach(note => {
            if (!previousState.chords.find(n => n.id === note.id)) {
                onRemoveNote(phrase.id, 'chords', note.id);
            }
        });

        setHistoryIndex(prev => prev - 1);
        setTimeout(() => {
            isApplyingHistoryRef.current = false;
        }, 50);
    }, [historyIndex, history, phrase, onAddNote, onRemoveNote]);

    // Redo
    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        isApplyingHistoryRef.current = true;
        const nextState = history[historyIndex + 1];

        // Clear current notes
        [...phrase.tracks.melody].forEach(note => {
            onRemoveNote(phrase.id, 'melody', note.id);
        });
        [...phrase.tracks.chords].forEach(note => {
            onRemoveNote(phrase.id, 'chords', note.id);
        });

        // Restore from snapshot
        nextState.melody.forEach(note => {
            onAddNote(phrase.id, 'melody', note.pitch, note.startTime, note.duration);
        });
        nextState.chords.forEach(note => {
            onAddNote(phrase.id, 'chords', note.pitch, note.startTime, note.duration);
        });

        setHistoryIndex(prev => prev + 1);
        setTimeout(() => {
            isApplyingHistoryRef.current = false;
        }, 50);
    }, [historyIndex, history, phrase, onAddNote, onRemoveNote]);

    // Auto-save to history on phrase changes
    const prevPhrasesRef = useRef(phrase);
    useEffect(() => {
        const hasChanged = JSON.stringify(phrase.tracks) !== JSON.stringify(prevPhrasesRef.current.tracks);
        if (hasChanged && !isApplyingHistoryRef.current) {
            saveStateToHistory();
        }
        prevPhrasesRef.current = phrase;
    }, [phrase, saveStateToHistory]);

    // Metronome control
    useEffect(() => {
        if (metronomeEnabled) {
            audioEngine.startMetronome(tempo, metronomeSubdivision);
        } else {
            audioEngine.stopMetronome();
        }
        return () => {
            audioEngine.stopMetronome();
        };
    }, [metronomeEnabled, tempo, metronomeSubdivision]);

    // Handle loop/stop at end of playback
    useEffect(() => {
        if (!isPlaying) return;

        const loopStart = loopRegion ? loopRegion.start : 0;
        const loopEnd = loopRegion ? loopRegion.end : phraseLengthBeats;

        if (playbackPosition >= loopEnd) {
            if (loopEnabled) {
                seek(loopStart);
            } else {
                audioEngine.stop();
            }
        }
    }, [isPlaying, playbackPosition, loopEnabled, loopRegion, phraseLengthBeats, seek]);

    // Snap value to grid
    const snapValue = useCallback((value) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    }, [snapToGrid, gridSize]);

    // Handle grid click
    const handleGridClick = useCallback((pitch, beatIndex) => {
        if (justEndedSelectionRef.current) return;

        // Check for existing note
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
    }, [phrase, onAddNote, onRemoveNote, snapValue, gridSize, justEndedSelectionRef]);

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

        if (type === 'move') {
            // Store original positions for all selected notes
            originalSelectedNotesRef.current.clear();
            const notesToMove = noteIsSelected ? selectedNotes : [note];
            notesToMove.forEach(n => {
                originalSelectedNotesRef.current.set(n.id, {
                    startTime: n.startTime,
                    pitch: n.pitch
                });
            });
        }

        setDragState({
            type,
            noteId: note.id,
            startX: gridX,
            startY: gridY,
            originalNote: { ...note },
            trackName: note.trackName
        });
    }, [isSelected, selectNote, selectedNotes]);

    // Handle mouse move during drag
    const handleMouseMove = useCallback((e) => {
        if (!dragState || !scrollRef.current) return;

        // Throttle to 60fps
        const now = performance.now();
        if (dragThrottleRef.current && now - dragThrottleRef.current < 16) {
            return;
        }
        dragThrottleRef.current = now;

        const rect = scrollRef.current.getBoundingClientRect();
        const gridX = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const gridY = e.clientY - rect.top + scrollRef.current.scrollTop;

        const deltaX = gridX - dragState.startX;
        const deltaY = gridY - dragState.startY;

        if (dragState.type === 'move') {
            const deltaBeats = deltaX / cellWidth;
            const deltaPitch = -Math.round(deltaY / cellHeight);

            // Move all selected notes
            const notesToMove = isSelected(dragState.noteId) ? selectedNotes : [allNotes.find(n => n.id === dragState.noteId)];

            notesToMove.forEach(note => {
                if (!note) return;
                const original = originalSelectedNotesRef.current.get(note.id);
                if (!original) return;

                const newStartTime = snapValue(Math.max(0, original.startTime + deltaBeats));
                const newPitch = Math.max(48, Math.min(83, original.pitch + deltaPitch));

                if (newStartTime !== note.startTime || newPitch !== note.pitch) {
                    onUpdateNote(phrase.id, note.trackName, note.id, {
                        startTime: newStartTime,
                        pitch: newPitch
                    });

                    if (newPitch !== lastPlayedPitchRef.current) {
                        audioEngine.playNote(newPitch);
                        lastPlayedPitchRef.current = newPitch;
                    }
                }
            });
        } else if (dragState.type === 'resize') {
            const deltaBeats = deltaX / cellWidth;
            const newDuration = snapValue(Math.max(gridSize, dragState.originalNote.duration + deltaBeats));

            if (newDuration !== dragState.originalNote.duration) {
                onUpdateNote(phrase.id, dragState.trackName, dragState.noteId, {
                    duration: newDuration
                });
            }
        }
    }, [dragState, cellWidth, cellHeight, snapValue, isSelected, selectedNotes, allNotes, onUpdateNote, phrase.id, gridSize]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        if (dragState) {
            setDragState(null);
            originalSelectedNotesRef.current.clear();
        }
    }, [dragState]);

    // Handle play/pause
    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            audioEngine.stop();
        } else {
            let startPos = playbackPosition;

            if (loopEnabled && loopRegion) {
                startPos = loopRegion.start;
                seek(loopRegion.start);
            }

            audioEngine.playPhrase(phrase, tempo, startPos);
        }
    }, [isPlaying, phrase, tempo, loopEnabled, loopRegion, playbackPosition, seek]);

    // Handle MIDI recording
    const handleNoteRecorded = useCallback((note) => {
        setRecordingPreviewNotes(prev => [...prev, note]);
    }, []);

    const handleRecordingComplete = useCallback((recordedNotes) => {
        recordedNotes.forEach(note => {
            const trackName = note.pitch >= 60 ? 'melody' : 'chords';
            onAddNote(phrase.id, trackName, note.pitch, note.startTime, note.duration);
        });
        setRecordingPreviewNotes([]);
    }, [phrase.id, onAddNote]);

    const handleRecordingStateChange = useCallback((recording) => {
        if (recording && !metronomeEnabled) {
            setMetronomeEnabled(true);
        }
        if (recording && metronomeEnabled) {
            audioEngine.startMetronome(tempo, metronomeSubdivision);
        }
        if (recording) {
            seek(0);
        }
        if (!recording) {
            setActiveRecordingNotes([]);
        }
    }, [metronomeEnabled, tempo, metronomeSubdivision, seek]);

    const handlePreRollComplete = useCallback(() => {
        audioEngine.playPhrase(phrase, tempo);
    }, [phrase, tempo]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === ' ') {
                e.preventDefault();
                handlePlayPause();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                selectAll(allNotes);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                copy(selectedNotes);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                e.preventDefault();
                cut(selectedNotes, (noteId) => {
                    const note = allNotes.find(n => n.id === noteId);
                    if (note) onRemoveNote(phrase.id, note.trackName, noteId);
                });
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                paste(playbackPosition, (trackName, pitch, startTime, duration) => {
                    onAddNote(phrase.id, trackName, pitch, startTime, duration);
                });
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                duplicate(selectedNotes, (trackName, pitch, startTime, duration) => {
                    onAddNote(phrase.id, trackName, pitch, startTime, duration);
                });
            } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
                e.preventDefault();
                redo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                selectedNotes.forEach(note => {
                    onRemoveNote(phrase.id, note.trackName, note.id);
                });
                clearSelection();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, handlePlayPause, selectAll, allNotes, copy, cut, paste, duplicate, selectedNotes, playbackPosition, undo, redo, phrase.id, onAddNote, onRemoveNote, clearSelection]);

    // Grid background click
    const handleGridMouseDown = useCallback((e) => {
        if (e.target !== e.currentTarget) return;

        const rect = scrollRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const y = e.clientY - rect.top + scrollRef.current.scrollTop;

        startRectSelection(x, y);
    }, [startRectSelection]);

    const handleGridMouseMoveSelection = useCallback((e) => {
        if (!selectionRect) return;

        const rect = scrollRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const y = e.clientY - rect.top + scrollRef.current.scrollTop;

        updateRectSelection(x, y);
    }, [selectionRect, updateRectSelection]);

    const handleGridMouseUpSelection = useCallback(() => {
        if (selectionRect) {
            endRectSelection(allNotes, cellWidth, cellHeight, keys, false);
        }
    }, [selectionRect, endRectSelection, allNotes, cellWidth, cellHeight, keys]);

    // Combined mouse handlers
    useEffect(() => {
        const handleMove = (e) => {
            handleMouseMove(e);
            handleGridMouseMoveSelection(e);
        };

        const handleUp = () => {
            handleMouseUp();
            handleGridMouseUpSelection();
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [handleMouseMove, handleMouseUp, handleGridMouseMoveSelection, handleGridMouseUpSelection]);

    // Measure bar click to seek
    const handleMeasureBarClick = useCallback((e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
        const beat = x / cellWidth;
        const clampedBeat = Math.max(0, Math.min(phraseLengthBeats - 0.1, beat));
        seek(clampedBeat);
    }, [cellWidth, phraseLengthBeats, seek]);

    // Loop region handlers
    const handleLoopButtonClick = useCallback(() => {
        if (!loopEnabled) {
            setLoopEnabled(true);
            if (!loopRegion) {
                setLoopRegion({ start: 0, end: phraseLengthBeats });
            }
        } else {
            setLoopEnabled(false);
        }
    }, [loopEnabled, loopRegion, phraseLengthBeats]);

    const handleLoopHandleMouseDown = useCallback((e, handle) => {
        e.stopPropagation();
        setDraggingLoopHandle(handle);
    }, []);

    useEffect(() => {
        if (!draggingLoopHandle || !scrollRef.current) return;

        const handleMouseMove = (e) => {
            const rect = scrollRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
            const beat = snapValue(Math.max(0, Math.min(phraseLengthBeats, x / cellWidth)));

            setLoopRegion(prev => {
                if (!prev) return prev;
                if (draggingLoopHandle === 'start') {
                    return { start: Math.min(beat, prev.end - 1), end: prev.end };
                } else {
                    return { start: prev.start, end: Math.max(beat, prev.start + 1) };
                }
            });
        };

        const handleMouseUp = () => {
            setDraggingLoopHandle(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingLoopHandle, cellWidth, phraseLengthBeats, snapValue]);

    // Render
    const totalBeats = phraseLengthBeats;
    const gridWidth = totalBeats * cellWidth;

    return createPortal(
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
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                {/* MIDI Recorder */}
                <MidiRecorder
                    tempo={tempo}
                    phraseLength={phrase.length}
                    onRecordingComplete={handleRecordingComplete}
                    onNoteRecorded={handleNoteRecorded}
                    onActiveNotesChange={setActiveRecordingNotes}
                    snapToGrid={snapToGrid}
                    onRecordingStateChange={handleRecordingStateChange}
                    onPreRollComplete={handlePreRollComplete}
                />

                {/* Toolbar */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Zoom */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>−</button>
                        <span style={{ fontSize: '0.875rem', minWidth: '60px', textAlign: 'center' }}>
                            {Math.round(zoom * 100)}%
                        </span>
                        <button onClick={() => setZoom(Math.min(2, zoom + 0.25))}>+</button>
                    </div>

                    {/* Play/Pause */}
                    <button onClick={handlePlayPause} style={{
                        background: isPlaying ? 'var(--gradient-danger)' : 'var(--gradient-success)',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        fontWeight: '600'
                    }}>
                        {isPlaying ? '⏸ Pause' : '▶ Lecture'}
                    </button>

                    {/* Grid */}
                    <select value={gridSize} onChange={(e) => setGridSize(parseFloat(e.target.value))} style={{
                        padding: '0.5rem',
                        fontSize: '0.875rem'
                    }}>
                        <option value={1}>1/4 (Noire)</option>
                        <option value={0.5}>1/8 (Croche)</option>
                        <option value={0.25}>1/16 (Double-croche)</option>
                        <option value={0.125}>1/32 (Triple-croche)</option>
                    </select>

                    {/* Snap to Grid */}
                    <button onClick={() => setSnapToGrid(!snapToGrid)} style={{
                        background: snapToGrid ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                        color: snapToGrid ? 'white' : 'var(--text-secondary)',
                        border: snapToGrid ? 'none' : '1px solid var(--border-light)',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                    }}>
                        {snapToGrid ? '✓' : '○'} Magnétisme
                    </button>

                    {/* Metronome */}
                    <button onClick={() => setMetronomeEnabled(!metronomeEnabled)} style={{
                        background: metronomeEnabled ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                        color: metronomeEnabled ? 'white' : 'var(--text-secondary)',
                        border: metronomeEnabled ? 'none' : '1px solid var(--border-light)',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                    }}>
                        {metronomeEnabled ? '🔔' : '🔕'} Métronome
                    </button>

                    {metronomeEnabled && (
                        <select value={metronomeSubdivision} onChange={(e) => setMetronomeSubdivision(e.target.value)} style={{
                            padding: '0.5rem',
                            fontSize: '0.875rem'
                        }}>
                            <option value="quarter">♩ Noire (1/4)</option>
                            <option value="eighth">♪ Croche (1/8)</option>
                        </select>
                    )}

                    {/* Loop */}
                    <button onClick={handleLoopButtonClick} style={{
                        background: loopEnabled ? 'var(--gradient-warning)' : 'var(--bg-elevated)',
                        color: loopEnabled ? 'white' : 'var(--text-secondary)',
                        border: loopEnabled ? 'none' : '1px solid var(--border-light)',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                    }}>
                        🔁 Boucle
                    </button>

                    {/* Scale highlight */}
                    <button onClick={() => setShowScaleHighlight(!showScaleHighlight)} style={{
                        background: showScaleHighlight ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                        color: showScaleHighlight ? 'white' : 'var(--text-secondary)',
                        border: showScaleHighlight ? 'none' : '1px solid var(--border-light)',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                    }}>
                        {showScaleHighlight ? '✓' : '○'} Gamme
                    </button>

                    {/* Hand labeling */}
                    {selectedNotes.length > 0 && (
                        <>
                            <button onClick={() => {
                                saveStateToHistory();
                                selectedNotes.forEach(note => {
                                    if (note.trackName !== 'chords') {
                                        onRemoveNote(phrase.id, note.trackName, note.id);
                                        onAddNote(phrase.id, 'chords', note.pitch, note.startTime, note.duration);
                                    }
                                });
                                clearSelection();
                            }} style={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                            }}>
                                👈 Main Gauche
                            </button>
                            <button onClick={() => {
                                saveStateToHistory();
                                selectedNotes.forEach(note => {
                                    if (note.trackName !== 'melody') {
                                        onRemoveNote(phrase.id, note.trackName, note.id);
                                        onAddNote(phrase.id, 'melody', note.pitch, note.startTime, note.duration);
                                    }
                                });
                                clearSelection();
                            }} style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                            }}>
                                👉 Main Droite
                            </button>
                        </>
                    )}

                    {/* Close */}
                    <button onClick={onClose} style={{
                        marginLeft: 'auto',
                        background: 'var(--bg-elevated)',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem'
                    }}>
                        ✕ Fermer
                    </button>
                </div>
            </div>

            {/* Piano Roll */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Measure bar */}
                <div style={{
                    height: '40px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    marginLeft: '60px',
                    position: 'relative',
                    cursor: 'pointer'
                }} onClick={handleMeasureBarClick}>
                    <div style={{
                        position: 'relative',
                        width: gridWidth,
                        height: '100%'
                    }}>
                        {/* Measures */}
                        {Array.from({ length: phrase.length }).map((_, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                left: i * 4 * cellWidth,
                                width: 4 * cellWidth,
                                height: '100%',
                                borderLeft: '1px solid var(--border-medium)',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: '0.5rem',
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)'
                            }}>
                                {i + 1}
                            </div>
                        ))}

                        {/* Loop region */}
                        {loopEnabled && loopRegion && (
                            <div style={{
                                position: 'absolute',
                                left: loopRegion.start * cellWidth,
                                width: (loopRegion.end - loopRegion.start) * cellWidth,
                                height: '100%',
                                background: 'rgba(245, 158, 11, 0.2)',
                                border: '2px solid #f59e0b',
                                pointerEvents: 'none'
                            }}>
                                {/* Start handle */}
                                <div
                                    onMouseDown={(e) => handleLoopHandleMouseDown(e, 'start')}
                                    style={{
                                        position: 'absolute',
                                        left: -6,
                                        top: 0,
                                        width: 12,
                                        height: '100%',
                                        background: '#f59e0b',
                                        cursor: 'ew-resize',
                                        pointerEvents: 'auto'
                                    }}
                                />
                                {/* End handle */}
                                <div
                                    onMouseDown={(e) => handleLoopHandleMouseDown(e, 'end')}
                                    style={{
                                        position: 'absolute',
                                        right: -6,
                                        top: 0,
                                        width: 12,
                                        height: '100%',
                                        background: '#f59e0b',
                                        cursor: 'ew-resize',
                                        pointerEvents: 'auto'
                                    }}
                                />
                            </div>
                        )}

                        {/* Playhead */}
                        {isPlaying && playbackPosition >= 0 && playbackPosition < phraseLengthBeats && (
                            <div style={{
                                position: 'absolute',
                                left: playbackPosition * cellWidth,
                                top: 0,
                                width: 2,
                                height: '100%',
                                background: '#ef4444',
                                pointerEvents: 'none',
                                zIndex: 100
                            }} />
                        )}
                    </div>
                </div>

                {/* Grid */}
                <div
                    ref={scrollRef}
                    onMouseDown={handleGridMouseDown}
                    style={{
                        flex: 1,
                        overflow: 'auto',
                        position: 'relative',
                        cursor: dragState ? 'grabbing' : 'default'
                    }}
                >
                    <div style={{
                        position: 'relative',
                        width: gridWidth + 60,
                        height: keys.length * cellHeight
                    }}>
                        {/* Piano keys (sticky) */}
                        <div style={{
                            position: 'sticky',
                            left: 0,
                            top: 0,
                            width: 60,
                            height: keys.length * cellHeight,
                            background: 'var(--bg-secondary)',
                            borderRight: '1px solid var(--border-color)',
                            zIndex: 10
                        }}>
                            {keys.map((pitch, index) => {
                                const noteName = getNoteName(pitch);
                                const isBlackKey = noteName.includes('#') || noteName.includes('♭');
                                const inScale = showScaleHighlight && isInScale(pitch);

                                return (
                                    <div key={pitch} style={{
                                        position: 'absolute',
                                        top: index * cellHeight,
                                        left: 0,
                                        width: 60,
                                        height: cellHeight,
                                        background: isBlackKey ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                        borderBottom: '1px solid var(--border-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        color: inScale ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontWeight: inScale ? '600' : '400'
                                    }}>
                                        {noteName}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Grid cells */}
                        <div style={{
                            position: 'absolute',
                            left: 60,
                            top: 0,
                            width: gridWidth,
                            height: keys.length * cellHeight
                        }}>
                            {keys.map((pitch, rowIndex) => {
                                const isBlackKey = getNoteName(pitch).includes('#') || getNoteName(pitch).includes('♭');
                                const inScale = showScaleHighlight && isInScale(pitch);

                                return (
                                    <div key={pitch} style={{
                                        position: 'absolute',
                                        top: rowIndex * cellHeight,
                                        left: 0,
                                        width: gridWidth,
                                        height: cellHeight,
                                        background: inScale ? 'rgba(59, 130, 246, 0.05)' : (isBlackKey ? 'var(--bg-tertiary)' : 'var(--bg-primary)'),
                                        borderBottom: '1px solid var(--border-light)'
                                    }}>
                                        {/* Beat lines */}
                                        {Array.from({ length: totalBeats }).map((_, beatIndex) => (
                                            <div
                                                key={beatIndex}
                                                onClick={() => handleGridClick(pitch, beatIndex)}
                                                style={{
                                                    position: 'absolute',
                                                    left: beatIndex * cellWidth,
                                                    width: cellWidth,
                                                    height: cellHeight,
                                                    borderLeft: beatIndex % 4 === 0 ? '1px solid var(--border-medium)' : '1px solid var(--border-light)',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                        ))}
                                    </div>
                                );
                            })}

                            {/* Notes */}
                            {allNotes.map(note => {
                                const keyIndex = keys.indexOf(note.pitch);
                                if (keyIndex === -1) return null;

                                const selected = isSelected(note.id);
                                const isMelody = note.trackName === 'melody';

                                return (
                                    <div key={note.id} style={{
                                        position: 'absolute',
                                        left: note.startTime * cellWidth,
                                        top: keyIndex * cellHeight + 2,
                                        width: note.duration * cellWidth - 4,
                                        height: cellHeight - 4,
                                        background: selected
                                            ? 'var(--accent-primary)'
                                            : (isMelody ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'),
                                        borderRadius: '4px',
                                        cursor: 'move',
                                        border: selected ? '2px solid white' : 'none',
                                        boxShadow: selected ? '0 0 0 2px var(--accent-primary)' : '0 2px 4px rgba(0,0,0,0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Move area */}
                                        <div
                                            onMouseDown={(e) => handleNoteMouseDown(e, note, 'move')}
                                            style={{
                                                flex: 1,
                                                height: '100%',
                                                cursor: 'move'
                                            }}
                                        />
                                        {/* Resize handle */}
                                        <div
                                            onMouseDown={(e) => handleNoteMouseDown(e, note, 'resize')}
                                            style={{
                                                width: 8,
                                                height: '100%',
                                                cursor: 'ew-resize',
                                                background: 'rgba(255,255,255,0.3)'
                                            }}
                                        />
                                    </div>
                                );
                            })}

                            {/* Recording preview notes */}
                            {recordingPreviewNotes.map((note, i) => {
                                const keyIndex = keys.indexOf(note.pitch);
                                if (keyIndex === -1) return null;

                                return (
                                    <div key={`preview-${i}`} style={{
                                        position: 'absolute',
                                        left: note.startTime * cellWidth,
                                        top: keyIndex * cellHeight + 2,
                                        width: note.duration * cellWidth - 4,
                                        height: cellHeight - 4,
                                        background: 'rgba(239, 68, 68, 0.5)',
                                        borderRadius: '4px',
                                        border: '2px dashed #ef4444',
                                        pointerEvents: 'none'
                                    }} />
                                );
                            })}

                            {/* Active recording notes (being held) */}
                            {activeRecordingNotes.map((note) => {
                                const keyIndex = keys.indexOf(note.pitch);
                                if (keyIndex === -1) return null;

                                const duration = Math.max(0.25, playbackPosition - note.startTime);

                                return (
                                    <div key={note.id} style={{
                                        position: 'absolute',
                                        left: note.startTime * cellWidth,
                                        top: keyIndex * cellHeight + 2,
                                        width: duration * cellWidth - 4,
                                        height: cellHeight - 4,
                                        background: 'rgba(239, 68, 68, 0.7)',
                                        borderRadius: '4px',
                                        border: '2px solid #ef4444',
                                        pointerEvents: 'none'
                                    }} />
                                );
                            })}

                            {/* Selection rectangle */}
                            {selectionRect && (
                                <div style={{
                                    position: 'absolute',
                                    left: Math.min(selectionRect.startX, selectionRect.currentX),
                                    top: Math.min(selectionRect.startY, selectionRect.currentY),
                                    width: Math.abs(selectionRect.currentX - selectionRect.startX),
                                    height: Math.abs(selectionRect.currentY - selectionRect.startY),
                                    border: '2px dashed var(--accent-primary)',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    pointerEvents: 'none',
                                    zIndex: 50
                                }} />
                            )}

                            {/* Playhead */}
                            {isPlaying && playbackPosition >= 0 && playbackPosition < phraseLengthBeats && (
                                <div style={{
                                    position: 'absolute',
                                    left: playbackPosition * cellWidth,
                                    top: 0,
                                    width: 2,
                                    height: keys.length * cellHeight,
                                    background: '#ef4444',
                                    pointerEvents: 'none',
                                    zIndex: 100
                                }} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
