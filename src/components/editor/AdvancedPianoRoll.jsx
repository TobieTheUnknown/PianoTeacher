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
    timeSignature = { numerator: 4, denominator: 4 },
    onAddNote,
    onRemoveNote,
    onUpdateNote,
    onUpdateHandSeparators,
    onUpdatePhraseLength,
    onClose
}) {
    const [keys] = useState(() => getPianoRollKeys(1, 5));
    const scrollRef = useRef(null);
    const [dragState, setDragState] = useState(null);
    const lastPlayedPitchRef = useRef(null);
    const originalSelectedNotesRef = useRef(new Map()); // Store original positions for multi-drag
    const dragThrottleRef = useRef(null); // Throttle drag updates to 60fps

    // Advanced features
    const [zoom, setZoom] = useState(0.75);
    const [showScaleHighlight, setShowScaleHighlight] = useState(true);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridSize, setGridSize] = useState(0.25); // 1/16 note
    const [metronomeEnabled, setMetronomeEnabled] = useState(false);
    const [metronomeSubdivision, setMetronomeSubdivision] = useState('quarter'); // 'quarter' | 'eighth'
    const [loopEnabled, setLoopEnabled] = useState(false); // Loop playback when reaching end
    const [loopRegion, setLoopRegion] = useState(null); // { start: beats, end: beats } or null for full loop
    const [draggingLoopHandle, setDraggingLoopHandle] = useState(null); // 'start' | 'end' | null
    const [draggingResizeHandle, setDraggingResizeHandle] = useState(false); // For phrase resize handle
    const [recordingPreviewNotes, setRecordingPreviewNotes] = useState([]); // Notes being recorded in real-time
    const [activeRecordingNotes, setActiveRecordingNotes] = useState([]); // Notes currently being held during recording

    // Undo/Redo state
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isApplyingHistoryRef = useRef(false);

    const cellWidth = CELL_WIDTH * zoom;
    const cellHeight = CELL_HEIGHT * zoom;

    // Calculate beats per measure based on time signature
    // beatsPerMeasure represents quarter notes per measure
    const beatsPerMeasure = useMemo(() => {
        if (!timeSignature || !timeSignature.numerator || !timeSignature.denominator) {
            return 4; // Default to 4/4
        }
        return (timeSignature.numerator / timeSignature.denominator) * 4;
    }, [timeSignature]);

    // Detect if time signature is compound (ternary)
    // Compound time: denominator is 8 and numerator is divisible by 3 (e.g., 6/8, 9/8, 12/8)
    const isCompoundTime = useMemo(() => {
        if (!timeSignature || !timeSignature.numerator || !timeSignature.denominator) {
            return false;
        }
        return timeSignature.denominator === 8 && timeSignature.numerator % 3 === 0;
    }, [timeSignature]);

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
            const phraseLengthBeats = p.length * beatsPerMeasure;

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
    }, [phrases, cellWidth, beatsPerMeasure]);

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

    // Track playback position for playhead visualization
    const { playbackPosition, isPlaying, seek } = usePlaybackPosition();

    // Initialize playhead position to the start of the opened phrase (on mount only)
    useEffect(() => {
        // Find the layout for the phrase that was opened
        const openedPhraseLayout = phraseLayouts.layouts.find(l => l.phraseId === phrase.id);

        if (openedPhraseLayout && openedPhraseLayout.startBeat > 0) {
            // Seek to the start of this phrase (unless it's the first phrase at beat 0)
            seek(openedPhraseLayout.startBeat);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array - only run on mount

    // Handle loop/stop at end of playback
    useEffect(() => {
        if (!isPlaying) return;

        // Determine loop boundaries
        const loopStart = loopRegion ? loopRegion.start : 0;
        const loopEnd = loopRegion ? loopRegion.end : phraseLayouts.totalBeats;

        // Check if playback has reached or exceeded the end
        if (playbackPosition >= loopEnd) {
            if (loopEnabled) {
                // Loop back to the loop start position
                seek(loopStart);
            } else {
                // Stop playback
                audioEngine.stop();
            }
        }
    }, [playbackPosition, isPlaying, loopEnabled, loopRegion, phraseLayouts.totalBeats, seek]);

    // Get selected notes
    const selectedNotes = allNotesGlobal.filter(note => isSelected(note.id));

    // Create snapshot of current notes state
    const createSnapshot = useCallback(() => {
        return phrases.map(p => ({
            id: p.id,
            melody: [...p.tracks.melody],
            chords: [...p.tracks.chords]
        }));
    }, [phrases]);

    // Save state to history before modifications
    const saveStateToHistory = useCallback(() => {
        if (isApplyingHistoryRef.current) return;

        const snapshot = createSnapshot();
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(snapshot);
            // Limit history to 50 items
            if (newHistory.length > 50) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [createSnapshot, historyIndex]);

    // Undo function
    const undo = useCallback(() => {
        if (historyIndex < 0) return;

        isApplyingHistoryRef.current = true;
        const previousState = history[historyIndex];

        // Restore all notes from snapshot
        previousState.forEach(phraseSnapshot => {
            const phrase = phrases.find(p => p.id === phraseSnapshot.id);
            if (!phrase) return;

            // Restore melody track
            phraseSnapshot.melody.forEach(note => {
                if (!phrase.tracks.melody.find(n => n.id === note.id)) {
                    onAddNote(phrase.id, 'melody', note.pitch, note.startTime, note.duration);
                }
            });

            // Remove notes that shouldn't be there
            phrase.tracks.melody.forEach(note => {
                if (!phraseSnapshot.melody.find(n => n.id === note.id)) {
                    onRemoveNote(phrase.id, 'melody', note.id);
                }
            });

            // Same for chords
            phraseSnapshot.chords.forEach(note => {
                if (!phrase.tracks.chords.find(n => n.id === note.id)) {
                    onAddNote(phrase.id, 'chords', note.pitch, note.startTime, note.duration);
                }
            });

            phrase.tracks.chords.forEach(note => {
                if (!phraseSnapshot.chords.find(n => n.id === note.id)) {
                    onRemoveNote(phrase.id, 'chords', note.id);
                }
            });
        });

        setHistoryIndex(prev => prev - 1);
        setTimeout(() => {
            isApplyingHistoryRef.current = false;
        }, 50);
    }, [historyIndex, history, phrases, onAddNote, onRemoveNote]);

    // Redo function
    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        isApplyingHistoryRef.current = true;
        const nextState = history[historyIndex + 1];

        // Restore all notes from snapshot
        nextState.forEach(phraseSnapshot => {
            const phrase = phrases.find(p => p.id === phraseSnapshot.id);
            if (!phrase) return;

            // Clear current notes
            [...phrase.tracks.melody].forEach(note => {
                onRemoveNote(phrase.id, 'melody', note.id);
            });
            [...phrase.tracks.chords].forEach(note => {
                onRemoveNote(phrase.id, 'chords', note.id);
            });

            // Restore from snapshot
            phraseSnapshot.melody.forEach(note => {
                onAddNote(phrase.id, 'melody', note.pitch, note.startTime, note.duration);
            });
            phraseSnapshot.chords.forEach(note => {
                onAddNote(phrase.id, 'chords', note.pitch, note.startTime, note.duration);
            });
        });

        setHistoryIndex(prev => prev + 1);
        setTimeout(() => {
            isApplyingHistoryRef.current = false;
        }, 50);
    }, [historyIndex, history, phrases, onAddNote, onRemoveNote]);

    // Snap value to grid
    const snapValue = useCallback((value) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    }, [snapToGrid, gridSize]);

    // Handle grid click
    const handleGridClick = useCallback((pitch, globalBeatIndex) => {
        // Prevent click if we just ended a drag selection
        if (justEndedSelectionRef.current) return;

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
    }, [getPhraseAtBeat, allNotesGlobal, onAddNote, onRemoveNote, snapValue, gridSize, justEndedSelectionRef]);

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

        // Store original positions for ALL selected notes when starting multi-drag
        const isMultiDrag = noteIsSelected && selectedNoteIdsSet.size > 1;
        if (isMultiDrag) {
            const originalPositions = new Map();
            selectedNotes.forEach(n => {
                originalPositions.set(n.id, {
                    localStartTime: n.localStartTime,
                    pitch: n.pitch,
                    duration: n.duration,
                    phraseId: n.phraseId,
                    trackName: n.trackName
                });
            });
            originalSelectedNotesRef.current = originalPositions;
        }

        setDragState({
            type,
            noteId: note.id,
            trackName: note.trackName,
            phraseId: note.phraseId,
            startX: gridX,
            startY: gridY,
            originalNote: { ...note },
            hasMoved: false,
            isMultiDrag
        });
    }, [isSelected, selectNote, selectedNoteIdsSet]);

    // Handle mouse move (drag) with throttling for performance
    const handleMouseMove = useCallback((e) => {
        // Handle phrase resize handle dragging
        if (draggingResizeHandle && scrollRef.current && onUpdatePhraseLength) {
            const rect = scrollRef.current.getBoundingClientRect();
            const PIANO_KEYS_WIDTH = 90;
            const x = e.clientX - rect.left + scrollRef.current.scrollLeft - PIANO_KEYS_WIDTH;
            const beatPosition = Math.max(beatsPerMeasure, x / cellWidth); // Minimum 1 measure
            const measures = Math.round(beatPosition / beatsPerMeasure); // Round to nearest measure
            const clampedMeasures = Math.max(1, Math.min(16, measures)); // 1-16 measures
            onUpdatePhraseLength(clampedMeasures);
            return;
        }

        // Handle loop handle dragging
        if (draggingLoopHandle && scrollRef.current) {
            const rect = scrollRef.current.getBoundingClientRect();
            const PIANO_KEYS_WIDTH = 90;
            const x = e.clientX - rect.left + scrollRef.current.scrollLeft - PIANO_KEYS_WIDTH;
            const beatPosition = Math.max(0, Math.min(phraseLayouts.totalBeats, x / cellWidth));
            const snappedBeat = snapValue(beatPosition);

            if (draggingLoopHandle === 'start') {
                setLoopRegion(prev => ({
                    start: Math.min(snappedBeat, prev.end - gridSize),
                    end: prev.end
                }));
            } else if (draggingLoopHandle === 'end') {
                setLoopRegion(prev => ({
                    start: prev.start,
                    end: Math.max(snappedBeat, prev.start + gridSize)
                }));
            }
            return;
        }

        if (!dragState || !scrollRef.current) return;

        // Throttle updates to 60fps using requestAnimationFrame
        if (dragThrottleRef.current) return;

        dragThrottleRef.current = requestAnimationFrame(() => {
            dragThrottleRef.current = null;

            if (!scrollRef.current) return;

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
                        const originalNote = originalSelectedNotesRef.current.get(note.id);
                        if (!originalNote) return;

                        const noteNewDuration = Math.max(gridSize, originalNote.duration + deltaDuration);
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
                    const timeDelta = snappedLocalStartTime - dragState.originalNote.localStartTime;

                    selectedNotes.forEach(note => {
                        const originalNote = originalSelectedNotesRef.current.get(note.id);
                        if (!originalNote) return;

                        // Apply delta to ORIGINAL position, not current position
                        const noteNewLocalTime = Math.max(0, originalNote.localStartTime + timeDelta);
                        const noteSnappedLocalTime = snapValue(noteNewLocalTime);

                        const noteOriginalKeyIndex = keys.indexOf(originalNote.pitch);
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
        });
    }, [dragState, draggingLoopHandle, draggingResizeHandle, cellWidth, cellHeight, keys, snapValue, gridSize, selectedNotes, onUpdateNote, onUpdatePhraseLength, phraseLayouts.totalBeats]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        setDragState(null);
        setDraggingLoopHandle(null);
        setDraggingResizeHandle(false);
    }, []);

    // Handle background mouse down (start rect selection)
    const handleBackgroundMouseDown = useCallback((e) => {
        if (e.target.dataset.clickarea && scrollRef.current) {
            const rect = scrollRef.current.getBoundingClientRect();

            // Account for piano keys (90px) and measure header (32px) offset
            const PIANO_KEYS_WIDTH = 90;
            const MEASURE_HEADER_HEIGHT = 32;

            const x = e.clientX - rect.left + scrollRef.current.scrollLeft - PIANO_KEYS_WIDTH;
            const y = e.clientY - rect.top + scrollRef.current.scrollTop - MEASURE_HEADER_HEIGHT;

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

                // Account for piano keys (90px) and measure header (32px) offset
                const PIANO_KEYS_WIDTH = 90;
                const MEASURE_HEADER_HEIGHT = 32;

                const x = e.clientX - rect.left + scrollRef.current.scrollLeft - PIANO_KEYS_WIDTH;
                const y = e.clientY - rect.top + scrollRef.current.scrollTop - MEASURE_HEADER_HEIGHT;
                updateRectSelection(x, y);
            };

            const handleMouseUp = (e) => {
                if (!selectionRect) return;

                const { x, y, width, height } = selectionRect;

                // If the selection rectangle is too small (simple click), cancel silently
                // This allows the onClick handler to create notes
                const MIN_DRAG_SIZE = 5;
                if (width < MIN_DRAG_SIZE && height < MIN_DRAG_SIZE) {
                    cancelRectSelection(true); // silently = true
                    return;
                }

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

    // Handle loop handle dragging
    useEffect(() => {
        if (draggingLoopHandle) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggingLoopHandle, handleMouseMove, handleMouseUp]);

    // Handle phrase resize handle dragging
    useEffect(() => {
        if (draggingResizeHandle) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggingResizeHandle, handleMouseMove, handleMouseUp]);

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

            // Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }

            // Redo
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
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
                    const offset = Math.ceil(maxEndTime / beatsPerMeasure) * beatsPerMeasure;

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

            // Space bar for play/pause
            if (e.key === ' ') {
                e.preventDefault();
                if (isPlaying) {
                    audioEngine.stop();
                } else if (phrases.length > 0) {
                    audioEngine.playPhrase(phrases[0], tempo, null, false, null, beatsPerMeasure);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNotes, allNotesGlobal, phrases, tempo, isPlaying, undo, redo, onAddNote, onRemoveNote, clearSelection, selectAll, copy, cut, paste, duplicate, hasClipboard, onClose]);

    // Initialize history with first snapshot
    useEffect(() => {
        if (history.length === 0) {
            const initialSnapshot = createSnapshot();
            setHistory([initialSnapshot]);
            setHistoryIndex(0);
        }
    }, []);  // Only run once on mount

    // Track changes to phrases and save to history
    const prevPhrasesRef = useRef(null);
    useEffect(() => {
        if (!prevPhrasesRef.current) {
            prevPhrasesRef.current = phrases;
            return;
        }

        // Check if phrases actually changed (deep comparison of notes)
        const hasChanged = phrases.some((p, idx) => {
            const prevPhrase = prevPhrasesRef.current[idx];
            if (!prevPhrase) return true;

            return p.tracks.melody.length !== prevPhrase.tracks.melody.length ||
                   p.tracks.chords.length !== prevPhrase.tracks.chords.length;
        });

        if (hasChanged && !isApplyingHistoryRef.current) {
            saveStateToHistory();
        }

        prevPhrasesRef.current = phrases;
    }, [phrases, saveStateToHistory]);

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

    // Combine all phrases into a single continuous phrase for playback
    const combinePhrases = useCallback(() => {
        if (phrases.length === 0) return null;
        if (phrases.length === 1) return phrases[0];

        // Create a combined phrase with all notes from all phrases
        let totalBeats = 0;
        const combinedMelody = [];
        const combinedChords = [];

        phrases.forEach((phrase) => {
            // Add melody notes with time offset
            phrase.tracks.melody.forEach(note => {
                combinedMelody.push({
                    ...note,
                    startTime: note.startTime + totalBeats
                });
            });

            // Add chord notes with time offset
            phrase.tracks.chords.forEach(note => {
                combinedChords.push({
                    ...note,
                    startTime: note.startTime + totalBeats
                });
            });

            // Accumulate total beats (phrase length * beatsPerMeasure)
            totalBeats += phrase.length * beatsPerMeasure;
        });

        return {
            id: 'combined',
            length: totalBeats / beatsPerMeasure, // Convert back to measures
            tracks: {
                melody: combinedMelody,
                chords: combinedChords
            }
        };
    }, [phrases]);

    // Handle play/pause
    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            audioEngine.stop();
        } else if (phrases.length > 0) {
            // Determine start position
            let startPos = playbackPosition;

            // If loop is enabled, start at loop start
            if (loopEnabled && loopRegion) {
                startPos = loopRegion.start;
                seek(loopRegion.start);
            }

            // Combine all phrases for continuous playback
            const combinedPhrase = combinePhrases();
            if (combinedPhrase) {
                audioEngine.playPhrase(combinedPhrase, tempo, startPos, false, null, beatsPerMeasure);
            }
        }
    }, [isPlaying, phrases, tempo, loopEnabled, loopRegion, seek, combinePhrases, playbackPosition]);

    // Handle real-time note recorded (during recording)
    const handleNoteRecorded = useCallback((note) => {
        setRecordingPreviewNotes(prev => [...prev, note]);
    }, []);

    // Handle MIDI recording complete
    const handleRecordingComplete = useCallback((recordedNotes) => {
        if (phrases.length === 0) return;

        recordedNotes.forEach(note => {
            const trackName = note.pitch >= 60 ? 'melody' : 'chords';
            onAddNote(phrases[0].id, trackName, note.pitch, note.startTime, note.duration);
        });

        // Clear preview notes
        setRecordingPreviewNotes([]);
    }, [phrases, onAddNote]);

    // Handle recording state change (wrapped in useCallback to prevent infinite loop)
    const handleRecordingStateChange = useCallback((recording) => {
        // Auto-enable metronome during recording
        if (recording && !metronomeEnabled) {
            setMetronomeEnabled(true);
        }
        // Force-restart metronome when recording starts (even if already enabled)
        // This ensures metronome works on subsequent recordings after playback cancelled it
        if (recording && metronomeEnabled) {
            audioEngine.startMetronome(tempo, metronomeSubdivision);
        }
        // Reset playhead to start when pre-roll begins
        if (recording) {
            seek(0);
        }
        // Clear active notes when recording stops
        if (!recording) {
            setActiveRecordingNotes([]);
        }
    }, [metronomeEnabled, tempo, metronomeSubdivision, seek]);

    // Handle pre-roll complete (wrapped in useCallback)
    const handlePreRollComplete = useCallback(() => {
        // Start playback after pre-roll completes with all phrases combined
        const combinedPhrase = combinePhrases();
        if (combinedPhrase) {
            audioEngine.playPhrase(combinedPhrase, tempo, null, false, null, beatsPerMeasure);
        }
    }, [combinePhrases, tempo, beatsPerMeasure]);

    // Quantize all notes to the current grid
    const quantizeAllNotes = useCallback(() => {
        if (!phrases || phrases.length === 0) {
            console.log('No phrases to quantize');
            return;
        }

        console.log('Quantizing with grid size:', gridSize);
        console.log('Number of phrases:', phrases.length);

        const quantize = (value) => {
            return Math.round(value / gridSize) * gridSize;
        };

        let quantizedCount = 0;
        let totalNotes = 0;

        phrases.forEach((phrase, idx) => {
            console.log(`Phrase ${idx}:`, {
                melodyCount: phrase.tracks?.melody?.length || 0,
                chordsCount: phrase.tracks?.chords?.length || 0
            });

            // Quantize melody notes
            if (phrase.tracks?.melody) {
                phrase.tracks.melody.forEach(note => {
                    totalNotes++;
                    const quantizedStart = quantize(note.startTime);
                    const quantizedDuration = Math.max(gridSize, quantize(note.duration));

                    if (quantizedStart !== note.startTime || quantizedDuration !== note.duration) {
                        console.log(`Quantizing melody note: ${note.startTime} -> ${quantizedStart}, duration: ${note.duration} -> ${quantizedDuration}`);
                        onUpdateNote(phrase.id, 'melody', note.id, {
                            startTime: quantizedStart,
                            duration: quantizedDuration
                        });
                        quantizedCount++;
                    }
                });
            }

            // Quantize chord notes
            if (phrase.tracks?.chords) {
                phrase.tracks.chords.forEach(note => {
                    totalNotes++;
                    const quantizedStart = quantize(note.startTime);
                    const quantizedDuration = Math.max(gridSize, quantize(note.duration));

                    if (quantizedStart !== note.startTime || quantizedDuration !== note.duration) {
                        console.log(`Quantizing chord note: ${note.startTime} -> ${quantizedStart}, duration: ${note.duration} -> ${quantizedDuration}`);
                        onUpdateNote(phrase.id, 'chords', note.id, {
                            startTime: quantizedStart,
                            duration: quantizedDuration
                        });
                        quantizedCount++;
                    }
                });
            }
        });

        console.log(`Quantized ${quantizedCount} notes out of ${totalNotes} total notes`);
    }, [phrases, gridSize, onUpdateNote]);

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
                        {/* Play/Pause Button */}
                        <button
                            onClick={handlePlayPause}
                            style={{
                                background: isPlaying
                                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
                                boxShadow: isPlaying
                                    ? '0 2px 8px rgba(239, 68, 68, 0.3)'
                                    : '0 2px 8px rgba(16, 185, 129, 0.3)',
                                transition: 'all 0.2s',
                                minWidth: '110px',
                                justifyContent: 'center'
                            }}
                        >
                            <span>{isPlaying ? '⏸' : '▶'}</span>
                            <span>{isPlaying ? 'Pause' : 'Play'}</span>
                        </button>
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
                        onNoteRecorded={handleNoteRecorded}
                        onActiveNotesChange={setActiveRecordingNotes}
                        snapToGrid={snapToGrid}
                        onRecordingStateChange={handleRecordingStateChange}
                        onPreRollComplete={handlePreRollComplete}
                        metronomeSubdivision={metronomeEnabled ? metronomeSubdivision : 'quarter'}
                    />

                    {/* Toolbar - Compact unified design */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        background: 'var(--bg-elevated)',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-light)'
                    }}>
                        {/* Zoom Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <button
                                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    color: 'var(--text-secondary)'
                                }}
                                title="Zoom arrière"
                            >−</button>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', minWidth: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    color: 'var(--text-secondary)'
                                }}
                                title="Zoom avant"
                            >+</button>
                        </div>

                        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

                        {/* Grid Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <select
                                value={gridSize}
                                onChange={(e) => setGridSize(parseFloat(e.target.value))}
                                style={{
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                                    border: 'none',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                }}
                                title="Taille de la grille"
                            >
                                <option value={1}>1/4</option>
                                <option value={0.5}>1/8</option>
                                <option value={0.25}>1/16</option>
                                <option value={0.125}>1/32</option>
                            </select>
                            <button
                                onClick={() => setSnapToGrid(!snapToGrid)}
                                style={{
                                    background: snapToGrid ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: snapToGrid ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                                title="Magnétisme à la grille"
                            >
                                🧲
                            </button>
                            <button
                                onClick={quantizeAllNotes}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    border: 'none',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    marginLeft: '2px'
                                }}
                                title="Quantizer toutes les notes sur la grille"
                            >
                                ⚡
                            </button>
                        </div>

                        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

                        {/* Metronome - Compact */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <button
                                onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                                style={{
                                    background: metronomeEnabled ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: metronomeEnabled ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                }}
                                title={metronomeEnabled ? 'Désactiver le métronome' : 'Activer le métronome'}
                            >
                                {metronomeEnabled ? '🔔' : '🔕'}
                            </button>
                            {metronomeEnabled && (
                                <>
                                    <button
                                        onClick={() => setMetronomeSubdivision('quarter')}
                                        style={{
                                            background: metronomeSubdivision === 'quarter' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                                            color: metronomeSubdivision === 'quarter' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            border: 'none',
                                            padding: '0.35rem 0.4rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.875rem',
                                            cursor: 'pointer'
                                        }}
                                        title="Noire (1/4)"
                                    >♩</button>
                                    <button
                                        onClick={() => setMetronomeSubdivision('eighth')}
                                        style={{
                                            background: metronomeSubdivision === 'eighth' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                                            color: metronomeSubdivision === 'eighth' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            border: 'none',
                                            padding: '0.35rem 0.4rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.875rem',
                                            cursor: 'pointer'
                                        }}
                                        title="Croche (1/8)"
                                    >♪♪</button>
                                </>
                            )}
                        </div>

                        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

                        {/* Loop & Scale */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                                onClick={() => {
                                    const newLoopEnabled = !loopEnabled;
                                    setLoopEnabled(newLoopEnabled);
                                    if (newLoopEnabled) {
                                        const defaultEnd = Math.min(16, phraseLayouts.totalBeats);
                                        setLoopRegion({ start: 0, end: defaultEnd });
                                    } else {
                                        setLoopRegion(null);
                                    }
                                }}
                                style={{
                                    background: loopEnabled ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: loopEnabled ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer'
                                }}
                                title="Boucle"
                            >
                                🔁
                            </button>
                            <button
                                onClick={() => setShowScaleHighlight(!showScaleHighlight)}
                                style={{
                                    background: showScaleHighlight ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: showScaleHighlight ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                                title={`Afficher la gamme ${normalizedKeySignature}`}
                            >
                                🎼 {normalizedKeySignature}
                            </button>
                        </div>

                        {/* Selection Actions - Only when notes selected */}
                        {selectedNotes.length > 0 && (
                            <>
                                <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    padding: '0.25rem',
                                    borderRadius: 'var(--radius-sm)'
                                }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: '600', padding: '0 0.25rem' }}>
                                        {selectedNotes.length}
                                    </span>
                                    <button
                                        onClick={() => {
                                            saveStateToHistory();
                                            selectedNotes.forEach(note => {
                                                if (note.trackName !== 'chords') {
                                                    onRemoveNote(note.phraseId, note.trackName, note.id);
                                                    onAddNote(note.phraseId, 'chords', note.pitch, note.localStartTime, note.duration);
                                                }
                                            });
                                            clearSelection();
                                        }}
                                        style={{
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.3rem 0.5rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.7rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                        title="Assigner à la main gauche"
                                    >
                                        👈 MG
                                    </button>
                                    <button
                                        onClick={() => {
                                            saveStateToHistory();
                                            selectedNotes.forEach(note => {
                                                if (note.trackName !== 'melody') {
                                                    onRemoveNote(note.phraseId, note.trackName, note.id);
                                                    onAddNote(note.phraseId, 'melody', note.pitch, note.localStartTime, note.duration);
                                                }
                                            });
                                            clearSelection();
                                        }}
                                        style={{
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.3rem 0.5rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.7rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                        title="Assigner à la main droite"
                                    >
                                        MD 👉
                                    </button>
                                    <button
                                        onClick={clearSelection}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '0.3rem 0.4rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)'
                                        }}
                                        title="Désélectionner"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </>
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
                                    <div
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const clickX = e.clientX - rect.left;
                                            const beatPosition = clickX / cellWidth;
                                            seek(beatPosition);
                                        }}
                                        style={{
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
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {phraseLayouts.layouts.map((layout) => (
                                            Array.from({ length: layout.lengthMeasures }).map((_, measureOffset) => {
                                                const globalMeasureNum = layout.startMeasure + measureOffset;
                                                const isPhraseBoundary = measureOffset === 0;

                                                return (
                                                    <div
                                                        key={`measure-${layout.phraseId}-${measureOffset}`}
                                                        style={{
                                                            width: `${beatsPerMeasure * cellWidth}px`,
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

                                        {/* Loop Region Visualization */}
                                        {loopEnabled && loopRegion && (
                                            <>
                                                {/* Loop region highlight */}
                                                <div style={{
                                                    position: 'absolute',
                                                    left: `${loopRegion.start * cellWidth}px`,
                                                    top: 0,
                                                    height: '100%',
                                                    width: `${(loopRegion.end - loopRegion.start) * cellWidth}px`,
                                                    background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.2) 100%)',
                                                    border: '2px solid rgba(34, 197, 94, 0.6)',
                                                    borderTop: 'none',
                                                    pointerEvents: 'none',
                                                    zIndex: 5
                                                }} />

                                                {/* Start handle */}
                                                <div
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setDraggingLoopHandle('start');
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${loopRegion.start * cellWidth - 6}px`,
                                                        top: 0,
                                                        width: '12px',
                                                        height: '100%',
                                                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                                        cursor: 'ew-resize',
                                                        zIndex: 10,
                                                        borderRadius: '2px 0 0 2px',
                                                        boxShadow: '0 2px 6px rgba(34, 197, 94, 0.5)',
                                                        transition: draggingLoopHandle === 'start' ? 'none' : 'left 0.1s'
                                                    }}
                                                >
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '50%',
                                                        top: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        width: '2px',
                                                        height: '14px',
                                                        background: 'rgba(255, 255, 255, 0.8)',
                                                        borderRadius: '1px'
                                                    }} />
                                                </div>

                                                {/* End handle */}
                                                <div
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setDraggingLoopHandle('end');
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${loopRegion.end * cellWidth - 6}px`,
                                                        top: 0,
                                                        width: '12px',
                                                        height: '100%',
                                                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                                        cursor: 'ew-resize',
                                                        zIndex: 10,
                                                        borderRadius: '0 2px 2px 0',
                                                        boxShadow: '0 2px 6px rgba(34, 197, 94, 0.5)',
                                                        transition: draggingLoopHandle === 'end' ? 'none' : 'left 0.1s'
                                                    }}
                                                >
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '50%',
                                                        top: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        width: '2px',
                                                        height: '14px',
                                                        background: 'rgba(255, 255, 255, 0.8)',
                                                        borderRadius: '1px'
                                                    }} />
                                                </div>
                                            </>
                                        )}

                                        {/* Phrase Resize Handle - at the end of the timeline */}
                                        {onUpdatePhraseLength && (
                                            <div
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setDraggingResizeHandle(true);
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    right: '-6px',
                                                    top: 0,
                                                    width: '12px',
                                                    height: '100%',
                                                    background: draggingResizeHandle
                                                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                                        : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                                    cursor: 'ew-resize',
                                                    zIndex: 15,
                                                    borderRadius: '0 4px 4px 0',
                                                    boxShadow: '0 2px 6px rgba(139, 92, 246, 0.5)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title="Redimensionner la phrase"
                                            >
                                                <div style={{
                                                    width: '2px',
                                                    height: '14px',
                                                    background: 'rgba(255, 255, 255, 0.8)',
                                                    borderRadius: '1px'
                                                }} />
                                            </div>
                                        )}
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

                                        {/* Vertical grid lines - adapts to gridSize and time signature */}
                                        {(() => {
                                            // Safety checks with fallbacks
                                            const safeGridSize = gridSize && gridSize > 0 ? gridSize : 0.25;
                                            const safeTotalBeats = phraseLayouts.totalBeats || 16;
                                            const safeBeatsPerMeasure = beatsPerMeasure || 4;

                                            const totalSubdivisions = Math.ceil(safeTotalBeats / safeGridSize);

                                            return Array.from({ length: totalSubdivisions }).map((_, subdivIndex) => {
                                                const beatPosition = subdivIndex * safeGridSize;
                                                const isMeasureLine = Math.abs(beatPosition % safeBeatsPerMeasure) < 0.01;

                                                // Determine line type based on time signature
                                                let lineType; // 'measure', 'beat', 'subdivision', or 'fine'

                                                if (isMeasureLine) {
                                                    lineType = 'measure';
                                                } else if (isCompoundTime) {
                                                    // In compound time (6/8, 9/8, 12/8):
                                                    // - "beat" = dotted quarter (1.5 quarter notes / 3 eighth notes)
                                                    // - "subdivision" = eighth note (0.5 quarter notes)
                                                    const isOnDottedQuarter = Math.abs(beatPosition % 1.5) < 0.01;
                                                    const isOnEighth = Math.abs(beatPosition % 0.5) < 0.01;

                                                    if (isOnDottedQuarter) {
                                                        lineType = 'beat';
                                                    } else if (isOnEighth) {
                                                        lineType = 'subdivision';
                                                    } else {
                                                        lineType = 'fine';
                                                    }
                                                } else {
                                                    // In simple time (4/4, 3/4, 2/4):
                                                    // - "beat" = quarter note (1.0 beat)
                                                    // - "subdivision" = anything aligned with gridSize
                                                    const isOnQuarter = Math.abs(beatPosition % 1) < 0.01;

                                                    if (isOnQuarter) {
                                                        lineType = 'beat';
                                                    } else {
                                                        lineType = 'subdivision';
                                                    }
                                                }

                                                // Style based on line type
                                                let lineStyle;
                                                switch (lineType) {
                                                    case 'measure':
                                                        lineStyle = {
                                                            width: '2px',
                                                            background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%)',
                                                            zIndex: 3
                                                        };
                                                        break;
                                                    case 'beat':
                                                        lineStyle = {
                                                            width: '1px',
                                                            background: 'rgba(255, 255, 255, 0.12)',
                                                            zIndex: 2
                                                        };
                                                        break;
                                                    case 'subdivision':
                                                        lineStyle = {
                                                            width: '1px',
                                                            background: 'rgba(255, 255, 255, 0.12)',
                                                            zIndex: 1
                                                        };
                                                        break;
                                                    default: // 'fine'
                                                        lineStyle = {
                                                            width: '1px',
                                                            background: 'rgba(255, 255, 255, 0.06)',
                                                            zIndex: 1
                                                        };
                                                }

                                                return (
                                                    <div key={`v-${subdivIndex}`} style={{
                                                        position: 'absolute',
                                                        left: `${beatPosition * cellWidth}px`,
                                                        top: 0,
                                                        height: '100%',
                                                        pointerEvents: 'none',
                                                        ...lineStyle
                                                    }} />
                                                );
                                            });
                                        })()}

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

                                        {/* Recording Preview Notes (real-time display) */}
                                        {recordingPreviewNotes.map((note, idx) => {
                                            const notePitch = typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch;
                                            const keyIndex = keys.indexOf(notePitch);
                                            if (keyIndex === -1) return null;

                                            return (
                                                <div
                                                    key={`preview-${idx}-${note.id}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${note.startTime * cellWidth}px`,
                                                        top: `${keyIndex * cellHeight + 1}px`,
                                                        width: `${note.duration * cellWidth - 2}px`,
                                                        height: `${cellHeight - 2}px`,
                                                        background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)', // Orange for preview
                                                        borderRadius: 'var(--radius-sm)',
                                                        boxShadow: '0 2px 8px rgba(251, 146, 60, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                                                        zIndex: 15,
                                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                                        opacity: 0.85,
                                                        animation: 'pulse 1s ease-in-out infinite',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Active Recording Notes (stretching in real-time) */}
                                        {activeRecordingNotes.map((note, idx) => {
                                            const notePitch = typeof note.pitch === 'string' ? getMidiNumber(note.pitch) : note.pitch;
                                            const keyIndex = keys.indexOf(notePitch);
                                            if (keyIndex === -1) return null;

                                            // Calculate dynamic duration from startTime to current playback position
                                            const dynamicDuration = Math.max(0.125, playbackPosition - note.startTime);

                                            return (
                                                <div
                                                    key={`active-${idx}-${note.id}`}
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${note.startTime * cellWidth}px`,
                                                        top: `${keyIndex * cellHeight + 1}px`,
                                                        width: `${dynamicDuration * cellWidth - 2}px`,
                                                        height: `${cellHeight - 2}px`,
                                                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', // Amber/gold for live notes
                                                        borderRadius: 'var(--radius-sm)',
                                                        boxShadow: '0 2px 12px rgba(251, 191, 36, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                                                        zIndex: 16, // Above preview notes
                                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                                        opacity: 0.9,
                                                        pointerEvents: 'none',
                                                        transition: 'width 0.05s linear' // Smooth stretching
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Click overlay - Single div instead of thousands of individual click areas */}
                                        {!dragState && (
                                            <div
                                                data-clickarea="true"
                                                onClick={(e) => {
                                                    if (!scrollRef.current) return;
                                                    const rect = scrollRef.current.getBoundingClientRect();

                                                    // Account for piano keys (90px) and measure header (32px) offset
                                                    const PIANO_KEYS_WIDTH = 90;
                                                    const MEASURE_HEADER_HEIGHT = 32;

                                                    const gridX = e.clientX - rect.left + scrollRef.current.scrollLeft - PIANO_KEYS_WIDTH;
                                                    const gridY = e.clientY - rect.top + scrollRef.current.scrollTop - MEASURE_HEADER_HEIGHT;

                                                    const beatIndex = Math.floor(gridX / cellWidth);
                                                    const pitchIndex = Math.floor(gridY / cellHeight);

                                                    if (beatIndex >= 0 && beatIndex < phraseLayouts.totalBeats &&
                                                        pitchIndex >= 0 && pitchIndex < keys.length) {
                                                        e.stopPropagation();
                                                        handleGridClick(keys[pitchIndex], beatIndex);
                                                    }
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    width: `${phraseLayouts.totalWidth}px`,
                                                    height: `${keys.length * cellHeight}px`,
                                                    zIndex: 5,
                                                    cursor: 'crosshair'
                                                }}
                                            />
                                        )}

                                        {/* Playback head - Always visible */}
                                        <div style={{
                                            position: 'absolute',
                                            left: `${playbackPosition * cellWidth}px`,
                                            top: 0,
                                            bottom: 0,
                                            width: '3px',
                                            background: isPlaying
                                                ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.7) 100%)'
                                                : 'linear-gradient(180deg, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.6) 100%)',
                                            boxShadow: isPlaying
                                                ? '0 0 8px rgba(239, 68, 68, 0.6), 0 0 16px rgba(239, 68, 68, 0.3)'
                                                : '0 0 8px rgba(59, 130, 246, 0.5)',
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
                                                borderTop: isPlaying
                                                    ? '8px solid rgba(239, 68, 68, 0.95)'
                                                    : '8px solid rgba(59, 130, 246, 0.95)',
                                                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                                            }} />
                                        </div>

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
