import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getPianoRollKeys, getFrenchNoteName, getMidiNumber } from '../../models/song';
import { audioEngine } from '../../services/AudioEngine';
import { useNoteSelection, useNoteClipboard } from '../../hooks/useNoteSelection';
import { useScaleContext } from '../../hooks/useScaleContext';
import { usePlaybackPosition } from '../../hooks/usePlaybackPosition';
import PianoRollCanvas from './canvas/PianoRollCanvas';
import { Toolbar } from './controls/Toolbar';
import { ContextMenu } from './controls/ContextMenu';
import { Minimap } from './controls/Minimap';
import { ShortcutsHint } from './controls/ShortcutsHint';
import { MidiRecorder } from './MidiRecorder';
import styles from './PianoRollEditor.module.css';

const DEFAULT_CELL_WIDTH = 40;
const DEFAULT_CELL_HEIGHT = 24;

/**
 * PianoRollEditor - Main wrapper component for the Piano Roll
 * Combines Canvas rendering with React controls for optimal performance
 */
export function PianoRollEditor({
    // Data
    phrase,
    allPhrases = null,
    keySignature,
    tempo = 120,
    timeSignature = { numerator: 4, denominator: 4 },

    // Callbacks
    onAddNote,
    onRemoveNote,
    onUpdateNote,
    // eslint-disable-next-line no-unused-vars
    onUpdatePhraseLength,

    // UI state
    isFullscreen = false,
    onClose
}) {
    // Refs
    const containerRef = useRef(null);
    const isApplyingHistoryRef = useRef(false);

    // Viewport dimensions state (for minimap)
    const [viewportWidth, setViewportWidth] = useState(800);

    // Piano keys — range expands dynamically to include all notes in the phrase
    const keys = useMemo(() => {
        const allPitches = [
            ...phrase.tracks.melody,
            ...phrase.tracks.chords
        ]
            .map(n => typeof n.pitch === 'string' ? getMidiNumber(n.pitch) : n.pitch)
            .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

        let startOctave = 1;
        let endOctave = 5;

        if (allPitches.length > 0) {
            const minPitch = Math.min(...allPitches);
            const maxPitch = Math.max(...allPitches);
            const minOctave = Math.floor((minPitch - 12) / 12);
            const maxOctave = Math.floor((maxPitch - 12) / 12);
            startOctave = Math.min(startOctave, minOctave);
            endOctave = Math.max(endOctave, maxOctave);
        }

        return getPianoRollKeys(startOctave, endOctave);
    }, [phrase.tracks.melody, phrase.tracks.chords]);

    // View state
    const [zoom, setZoom] = useState(isFullscreen ? 0.75 : 0.5);
    const [scrollX, setScrollX] = useState(0);
    const [scrollY, setScrollY] = useState(0);

    // Grid state
    const [gridSize, setGridSize] = useState(0.25); // 1/4 beat (quarter note)
    const [snapToGrid, setSnapToGrid] = useState(true);

    // Features state
    const [showScaleHighlight, setShowScaleHighlight] = useState(true);
    const [metronomeEnabled, setMetronomeEnabled] = useState(false);
    const [metronomeSubdivision, setMetronomeSubdivision] = useState('quarter');
    const [loopEnabled, setLoopEnabled] = useState(false);
    // eslint-disable-next-line no-unused-vars
    const [loopRegion, setLoopRegion] = useState(null); // Reserved for loop region feature
    // eslint-disable-next-line no-unused-vars
    const [showMinimap, setShowMinimap] = useState(isFullscreen); // Reserved for minimap toggle

    // Recording state
    const [recordingPreviewNotes, setRecordingPreviewNotes] = useState([]);
    const [activeRecordingNotes, setActiveRecordingNotes] = useState([]);
    const [isRecording, setIsRecording] = useState(false);

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);

    // History state for undo/redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Calculated values
    const cellWidth = DEFAULT_CELL_WIDTH * zoom;
    const cellHeight = DEFAULT_CELL_HEIGHT * zoom;

    // Time signature calculations
    const beatsPerMeasure = useMemo(() => {
        if (!timeSignature?.numerator || !timeSignature?.denominator) return 4;
        return (timeSignature.numerator / timeSignature.denominator) * 4;
    }, [timeSignature]);

    const isCompoundTime = useMemo(() => {
        if (!timeSignature?.numerator || !timeSignature?.denominator) return false;
        return timeSignature.denominator === 8 && timeSignature.numerator % 3 === 0;
    }, [timeSignature]);

    // Phrases management
    const phrases = useMemo(() => allPhrases || [phrase], [allPhrases, phrase]);

    // Phrase layouts (for multi-phrase view)
    const phraseLayouts = useMemo(() => {
        const layouts = [];
        let cumulativeBeats = 0;
        let totalMeasures = 0;

        phrases.forEach((p, index) => {
            const phraseLengthBeats = p.length * beatsPerMeasure;

            layouts.push({
                phraseId: p.id,
                phraseIndex: index,
                phraseName: p.name,
                startBeat: cumulativeBeats,
                endBeat: cumulativeBeats + phraseLengthBeats,
                lengthBeats: phraseLengthBeats,
                lengthMeasures: p.length
            });

            cumulativeBeats += phraseLengthBeats;
            totalMeasures += p.length;
        });

        return {
            layouts,
            totalBeats: cumulativeBeats,
            totalMeasures
        };
    }, [phrases, beatsPerMeasure]);

    // Transform notes to global coordinates
    const allNotesGlobal = useMemo(() => {
        const notes = [];

        phraseLayouts.layouts.forEach(layout => {
            const p = phrases.find(ph => ph.id === layout.phraseId);
            if (!p) return;

            ['melody', 'chords'].forEach(trackName => {
                p.tracks[trackName].forEach(note => {
                    notes.push({
                        ...note,
                        phraseId: layout.phraseId,
                        phraseName: layout.phraseName,
                        trackName,
                        localStartTime: note.startTime,
                        globalStartTime: layout.startBeat + note.startTime,
                        globalEndTime: layout.startBeat + note.startTime + note.duration
                    });
                });
            });
        });

        return notes;
    }, [phrases, phraseLayouts]);

    // Hooks
    const {
        selectedNoteIdsSet,
        justEndedSelectionRef,
        selectNote,
        selectNotes,
        deselectNotes,
        clearSelection,
        selectAll,
        isSelected
    } = useNoteSelection();

    const {
        copy,
        cut,
        paste,
        duplicate,
        hasClipboard
    } = useNoteClipboard();

    const { isInScale, keySignature: displayKeySignature } = useScaleContext(keySignature);
    const { playbackPosition, isPlaying, seek } = usePlaybackPosition();

    // Note name helper
    const getNoteName = useCallback((pitch) => {
        const fullName = getFrenchNoteName(pitch, keySignature);
        return fullName.replace(/[0-9-]+$/, '');
    }, [keySignature]);

    // Get phrase at global beat
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

    // Selected notes
    const selectedNotes = useMemo(() => {
        return allNotesGlobal.filter(note => isSelected(note.id));
    }, [allNotesGlobal, isSelected]);

    // Undo/Redo functions
    const createSnapshot = useCallback(() => {
        return phrases.map(p => ({
            id: p.id,
            melody: [...p.tracks.melody],
            chords: [...p.tracks.chords]
        }));
    }, [phrases]);

    const saveStateToHistory = useCallback(() => {
        if (isApplyingHistoryRef.current) return;

        const snapshot = createSnapshot();
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(snapshot);
            if (newHistory.length > 50) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [createSnapshot, historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex < 0) return;

        isApplyingHistoryRef.current = true;
        const previousState = history[historyIndex];

        previousState.forEach(phraseSnapshot => {
            const targetPhrase = phrases.find(p => p.id === phraseSnapshot.id);
            if (!targetPhrase) return;

            phraseSnapshot.melody.forEach(note => {
                if (!targetPhrase.tracks.melody.find(n => n.id === note.id)) {
                    onAddNote(targetPhrase.id, 'melody', note.pitch, note.startTime, note.duration);
                }
            });

            targetPhrase.tracks.melody.forEach(note => {
                if (!phraseSnapshot.melody.find(n => n.id === note.id)) {
                    onRemoveNote(targetPhrase.id, 'melody', note.id);
                }
            });

            phraseSnapshot.chords.forEach(note => {
                if (!targetPhrase.tracks.chords.find(n => n.id === note.id)) {
                    onAddNote(targetPhrase.id, 'chords', note.pitch, note.startTime, note.duration);
                }
            });

            targetPhrase.tracks.chords.forEach(note => {
                if (!phraseSnapshot.chords.find(n => n.id === note.id)) {
                    onRemoveNote(targetPhrase.id, 'chords', note.id);
                }
            });
        });

        setHistoryIndex(prev => prev - 1);
        setTimeout(() => { isApplyingHistoryRef.current = false; }, 50);
    }, [historyIndex, history, phrases, onAddNote, onRemoveNote]);

    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        isApplyingHistoryRef.current = true;
        const nextState = history[historyIndex + 1];

        nextState.forEach(phraseSnapshot => {
            const targetPhrase = phrases.find(p => p.id === phraseSnapshot.id);
            if (!targetPhrase) return;

            [...targetPhrase.tracks.melody].forEach(note => {
                onRemoveNote(targetPhrase.id, 'melody', note.id);
            });
            [...targetPhrase.tracks.chords].forEach(note => {
                onRemoveNote(targetPhrase.id, 'chords', note.id);
            });

            phraseSnapshot.melody.forEach(note => {
                onAddNote(targetPhrase.id, 'melody', note.pitch, note.startTime, note.duration);
            });
            phraseSnapshot.chords.forEach(note => {
                onAddNote(targetPhrase.id, 'chords', note.pitch, note.startTime, note.duration);
            });
        });

        setHistoryIndex(prev => prev + 1);
        setTimeout(() => { isApplyingHistoryRef.current = false; }, 50);
    }, [historyIndex, history, phrases, onAddNote, onRemoveNote]);

    // Snap value to grid
    const snapValue = useCallback((value) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    }, [snapToGrid, gridSize]);

    /**
     * Quantize notes - align start times to the nearest grid position
     * If notes are selected, quantize only those; otherwise quantize all notes
     */
    const quantizeNotes = useCallback(() => {
        const notesToQuantize = selectedNoteIdsSet.size > 0
            ? allNotesGlobal.filter(n => selectedNoteIdsSet.has(n.id))
            : allNotesGlobal;

        if (notesToQuantize.length === 0) return;

        // Check if any note needs quantization
        const hasChanges = notesToQuantize.some(note => {
            const quantizedStartTime = Math.round(note.localStartTime / gridSize) * gridSize;
            return Math.abs(quantizedStartTime - note.localStartTime) > 0.001;
        });

        if (!hasChanges) return;

        saveStateToHistory();

        notesToQuantize.forEach(note => {
            const quantizedStartTime = Math.round(note.localStartTime / gridSize) * gridSize;

            // Only update if position actually changes
            if (Math.abs(quantizedStartTime - note.localStartTime) > 0.001) {
                onUpdateNote(note.phraseId, note.trackName, note.id, {
                    startTime: quantizedStartTime
                });
            }
        });
    }, [allNotesGlobal, selectedNoteIdsSet, gridSize, onUpdateNote, saveStateToHistory]);

    // Add/remove measures handler
    const handleAddMeasures = useCallback((delta) => {
        if (!phrase || !onUpdatePhraseLength) return;
        const newLength = Math.max(1, Math.min(999, phrase.length + delta));
        if (newLength !== phrase.length) {
            onUpdatePhraseLength(newLength);
        }
    }, [phrase, onUpdatePhraseLength]);

    // Grid click handler
    const handleGridClick = useCallback((pitch, globalBeat) => {
        if (justEndedSelectionRef.current) return;

        const phraseInfo = getPhraseAtBeat(globalBeat);
        if (!phraseInfo) return;

        const localBeat = globalBeat - phraseInfo.layout.startBeat;
        const snappedLocalBeat = snapValue(localBeat);

        const existingNote = allNotesGlobal.find(
            n => n.pitch === pitch && Math.abs(n.globalStartTime - globalBeat) < 0.1
        );

        if (existingNote) {
            saveStateToHistory();
            onRemoveNote(existingNote.phraseId, existingNote.trackName, existingNote.id);
        } else {
            saveStateToHistory();
            const autoTrack = pitch >= 60 ? 'melody' : 'chords';
            onAddNote(phraseInfo.phrase.id, autoTrack, pitch, snappedLocalBeat, gridSize);
            audioEngine.playNote(pitch);
        }

        clearSelection();
    }, [getPhraseAtBeat, allNotesGlobal, onAddNote, onRemoveNote, snapValue, gridSize, justEndedSelectionRef, saveStateToHistory, clearSelection]);

    // Note click handler
    const handleNoteClick = useCallback((note, e) => {
        if (!note) {
            // Piano key press
            if (e?.pitch) {
                audioEngine.playNote(e.pitch);
            }
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            selectNote(note.id, true);
        } else {
            selectNote(note.id, false);
        }

        audioEngine.playNote(note.pitch);
    }, [selectNote]);

    // Note drag end handler
    const handleNoteDragEnd = useCallback((dragResult) => {
        if (!dragResult || dragResult.cancelled || !dragResult.hasMoved) return;
        if (!dragResult.updates || dragResult.updates.length === 0) return;

        saveStateToHistory();

        if (dragResult.type === 'resize') {
            // Resize: single note duration change
            const update = dragResult.updates[0];
            const note = allNotesGlobal.find(n => n.id === update.noteId);
            if (note && update.duration !== undefined) {
                onUpdateNote(note.phraseId, note.trackName, note.id, {
                    duration: update.duration
                });
            }
        } else if (dragResult.isMultiDrag) {
            // BATCH MOVE: Apply updates to all selected notes
            dragResult.updates.forEach(update => {
                const note = allNotesGlobal.find(n => n.id === update.noteId);
                if (!note) return;

                const phraseInfo = getPhraseAtBeat(update.globalStartTime);
                if (!phraseInfo) return;

                const samePhrase = phraseInfo.phrase.id === note.phraseId;

                if (samePhrase) {
                    onUpdateNote(note.phraseId, note.trackName, note.id, {
                        startTime: update.localStartTime,
                        pitch: update.pitch
                    });
                } else {
                    // Cross-phrase move: remove from old phrase, add to new
                    onRemoveNote(note.phraseId, note.trackName, note.id);
                    const autoTrack = update.pitch >= 60 ? 'melody' : 'chords';
                    onAddNote(phraseInfo.phrase.id, autoTrack, update.pitch, update.localStartTime, note.duration);
                }
            });
        } else {
            // Single note move
            const update = dragResult.updates[0];
            const note = allNotesGlobal.find(n => n.id === update.noteId);
            if (!note) return;

            const phraseInfo = getPhraseAtBeat(update.globalStartTime);
            if (!phraseInfo) return;

            const samePhrase = phraseInfo.phrase.id === note.phraseId;

            if (samePhrase) {
                onUpdateNote(note.phraseId, note.trackName, note.id, {
                    startTime: update.localStartTime,
                    pitch: update.pitch
                });
            } else {
                // Cross-phrase move
                onRemoveNote(note.phraseId, note.trackName, note.id);
                const autoTrack = update.pitch >= 60 ? 'melody' : 'chords';
                onAddNote(phraseInfo.phrase.id, autoTrack, update.pitch, update.localStartTime, note.duration);
            }
        }
    }, [allNotesGlobal, getPhraseAtBeat, onUpdateNote, onRemoveNote, onAddNote, saveStateToHistory]);

    // Selection complete handler
    // Ctrl/Cmd = deselect, Shift = add to selection, nothing = replace
    const handleSelectionComplete = useCallback((selectedIds, e) => {
        if (selectedIds.length > 0) {
            if (e.ctrlKey || e.metaKey) {
                // Deselect mode
                deselectNotes(selectedIds);
            } else {
                // Select mode (additive if shift)
                selectNotes(selectedIds, e.shiftKey);
            }
        } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            clearSelection();
        }
    }, [selectNotes, deselectNotes, clearSelection]);

    // Playhead seek handler
    const handlePlayheadSeek = useCallback((beat) => {
        seek(beat);
    }, [seek]);

    // Context menu handler
    const handleContextMenu = useCallback((e, context) => {
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            context
        });
    }, []);

    // Context menu action handler
    const handleContextMenuAction = useCallback((action) => {
        const { context } = contextMenu;

        switch (action) {
            case 'delete':
                if (context.note) {
                    saveStateToHistory();
                    onRemoveNote(context.note.phraseId, context.note.trackName, context.note.id);
                }
                break;
            case 'duplicate':
                if (context.note) {
                    const duplicated = duplicate([context.note], gridSize);
                    duplicated.forEach(note => {
                        const phraseInfo = getPhraseAtBeat(note.startTime);
                        if (phraseInfo) {
                            onAddNote(phraseInfo.phrase.id, note.trackName || 'melody', note.pitch, note.startTime - phraseInfo.layout.startBeat, note.duration);
                        }
                    });
                }
                break;
            case 'copy':
                if (selectedNotes.length > 0) {
                    copy(selectedNotes);
                } else if (context.note) {
                    copy([context.note]);
                }
                break;
            case 'cut':
                if (selectedNotes.length > 0) {
                    const toCut = cut(selectedNotes);
                    saveStateToHistory();
                    toCut.forEach(note => {
                        onRemoveNote(note.phraseId, note.trackName, note.id);
                    });
                    clearSelection();
                }
                break;
            case 'paste':
                if (hasClipboard()) {
                    const pasted = paste(context.beat || playbackPosition);
                    saveStateToHistory();
                    pasted.forEach(note => {
                        const phraseInfo = getPhraseAtBeat(note.startTime);
                        if (phraseInfo) {
                            onAddNote(phraseInfo.phrase.id, note.trackName || 'melody', note.pitch, note.startTime - phraseInfo.layout.startBeat, note.duration);
                        }
                    });
                }
                break;
            case 'selectAll':
                selectAll(allNotesGlobal.map(n => n.id));
                break;
            case 'assignLeft':
            case 'assignRight':
                // Assign notes to left/right hand track
                if (selectedNotes.length > 0) {
                    const newTrack = action === 'assignLeft' ? 'chords' : 'melody';
                    saveStateToHistory();
                    selectedNotes.forEach(note => {
                        if (note.trackName !== newTrack) {
                            onRemoveNote(note.phraseId, note.trackName, note.id);
                            onAddNote(note.phraseId, newTrack, note.pitch, note.localStartTime, note.duration);
                        }
                    });
                }
                break;
            default:
                break;
        }

        setContextMenu(null);
    }, [contextMenu, selectedNotes, allNotesGlobal, copy, cut, paste, duplicate, hasClipboard, playbackPosition, getPhraseAtBeat, onAddNote, onRemoveNote, saveStateToHistory, clearSelection, selectAll, gridSize]);

    // Play handler using playPhrase API
    const handlePlay = useCallback(() => {
        const combinedPhrase = { tracks: { melody: [], chords: [] } };
        phrases.forEach(p => {
            combinedPhrase.tracks.melody.push(...(p.tracks.melody || []));
            combinedPhrase.tracks.chords.push(...(p.tracks.chords || []));
        });
        audioEngine.playPhrase(combinedPhrase, tempo, playbackPosition, false, null, beatsPerMeasure);
    }, [phrases, tempo, playbackPosition, beatsPerMeasure]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

            switch (e.key.toLowerCase()) {
                case 'a':
                    if (cmdOrCtrl) {
                        e.preventDefault();
                        selectAll(allNotesGlobal.map(n => n.id));
                    }
                    break;
                case 'c':
                    if (cmdOrCtrl && selectedNotes.length > 0) {
                        e.preventDefault();
                        copy(selectedNotes);
                    }
                    break;
                case 'x':
                    if (cmdOrCtrl && selectedNotes.length > 0) {
                        e.preventDefault();
                        const toCut = cut(selectedNotes);
                        saveStateToHistory();
                        toCut.forEach(note => {
                            onRemoveNote(note.phraseId, note.trackName, note.id);
                        });
                        clearSelection();
                    }
                    break;
                case 'v':
                    if (cmdOrCtrl && hasClipboard()) {
                        e.preventDefault();
                        const pasted = paste(playbackPosition);
                        saveStateToHistory();
                        pasted.forEach(note => {
                            const phraseInfo = getPhraseAtBeat(note.startTime);
                            if (phraseInfo) {
                                onAddNote(phraseInfo.phrase.id, note.trackName || 'melody', note.pitch, note.startTime - phraseInfo.layout.startBeat, note.duration);
                            }
                        });
                    }
                    break;
                case 'd':
                    if (cmdOrCtrl && selectedNotes.length > 0) {
                        e.preventDefault();
                        const duplicated = duplicate(selectedNotes, gridSize);
                        saveStateToHistory();
                        duplicated.forEach(note => {
                            const phraseInfo = getPhraseAtBeat(note.startTime);
                            if (phraseInfo) {
                                onAddNote(phraseInfo.phrase.id, note.trackName || 'melody', note.pitch, note.startTime - phraseInfo.layout.startBeat, note.duration);
                            }
                        });
                    }
                    break;
                case 'z':
                    if (cmdOrCtrl) {
                        e.preventDefault();
                        if (e.shiftKey) {
                            redo();
                        } else {
                            undo();
                        }
                    }
                    break;
                case 'y':
                    if (cmdOrCtrl) {
                        e.preventDefault();
                        redo();
                    }
                    break;
                case 'q':
                    // Quantize selected notes (or all if none selected)
                    if (!cmdOrCtrl) {
                        e.preventDefault();
                        quantizeNotes();
                    }
                    break;
                case 'delete':
                case 'backspace':
                    if (selectedNotes.length > 0) {
                        e.preventDefault();
                        saveStateToHistory();
                        selectedNotes.forEach(note => {
                            onRemoveNote(note.phraseId, note.trackName, note.id);
                        });
                        clearSelection();
                    }
                    break;
                case ' ':
                    e.preventDefault();
                    if (isPlaying) {
                        audioEngine.stop();
                    } else {
                        handlePlay();
                    }
                    break;
                case 'escape':
                    if (contextMenu) {
                        setContextMenu(null);
                    } else if (isFullscreen && onClose) {
                        onClose();
                    } else {
                        clearSelection();
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        allNotesGlobal, selectedNotes, copy, cut, paste, duplicate, hasClipboard,
        playbackPosition, isPlaying, gridSize, tempo, undo, redo, quantizeNotes,
        onAddNote, onRemoveNote, getPhraseAtBeat, saveStateToHistory,
        clearSelection, selectAll, isFullscreen, onClose, contextMenu, handlePlay
    ]);

    // Scroll handler
    const handleScroll = useCallback(({ scrollX: newScrollX, scrollY: newScrollY }) => {
        setScrollX(newScrollX);
        setScrollY(newScrollY);
    }, []);

    // Handle loop at end of playback
    useEffect(() => {
        if (!isPlaying) return;

        const loopStart = loopRegion?.start ?? 0;
        const loopEnd = loopRegion?.end ?? phraseLayouts.totalBeats;

        if (playbackPosition >= loopEnd) {
            if (loopEnabled) {
                seek(loopStart);
            } else {
                audioEngine.stop();
            }
        }
    }, [playbackPosition, isPlaying, loopEnabled, loopRegion, phraseLayouts.totalBeats, seek]);

    // Memoized callbacks for Toolbar to prevent unnecessary re-renders
    const handleStop = useCallback(() => {
        audioEngine.stop();
    }, []);

    const handleCopy = useCallback(() => {
        if (selectedNotes.length > 0) {
            copy(selectedNotes);
        }
    }, [selectedNotes, copy]);

    const handleCut = useCallback(() => {
        if (selectedNotes.length > 0) {
            const toCut = cut(selectedNotes);
            saveStateToHistory();
            toCut.forEach(note => onRemoveNote(note.phraseId, note.trackName, note.id));
            clearSelection();
        }
    }, [selectedNotes, cut, saveStateToHistory, onRemoveNote, clearSelection]);

    const handlePaste = useCallback(() => {
        if (hasClipboard()) {
            const pasted = paste(playbackPosition);
            saveStateToHistory();
            pasted.forEach(note => {
                const phraseInfo = getPhraseAtBeat(note.startTime);
                if (phraseInfo) {
                    onAddNote(phraseInfo.phrase.id, note.trackName || 'melody', note.pitch, note.startTime - phraseInfo.layout.startBeat, note.duration);
                }
            });
        }
    }, [hasClipboard, paste, playbackPosition, saveStateToHistory, getPhraseAtBeat, onAddNote]);

    const handleDelete = useCallback(() => {
        if (selectedNotes.length > 0) {
            saveStateToHistory();
            selectedNotes.forEach(note => onRemoveNote(note.phraseId, note.trackName, note.id));
            clearSelection();
        }
    }, [selectedNotes, saveStateToHistory, onRemoveNote, clearSelection]);

    const handleDuplicate = useCallback(() => {
        if (selectedNotes.length > 0) {
            const duplicated = duplicate(selectedNotes, gridSize);
            saveStateToHistory();
            duplicated.forEach(note => {
                const phraseInfo = getPhraseAtBeat(note.startTime);
                if (phraseInfo) {
                    onAddNote(phraseInfo.phrase.id, note.trackName || 'melody', note.pitch, note.startTime - phraseInfo.layout.startBeat, note.duration);
                }
            });
        }
    }, [selectedNotes, duplicate, gridSize, saveStateToHistory, getPhraseAtBeat, onAddNote]);

    // Body scroll lock for fullscreen
    useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [isFullscreen]);

    // Track container size for minimap
    useEffect(() => {
        if (!containerRef.current) return;

        const updateViewportWidth = () => {
            if (containerRef.current) {
                setViewportWidth(containerRef.current.offsetWidth);
            }
        };

        updateViewportWidth();

        const resizeObserver = new ResizeObserver(updateViewportWidth);
        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    // Minimap navigation handler
    const handleMinimapNavigate = useCallback((beat) => {
        const newScrollX = Math.max(0, beat * cellWidth - viewportWidth / 2);
        setScrollX(newScrollX);
    }, [cellWidth, viewportWidth]);

    const content = (
        <div
            ref={containerRef}
            className={`${styles.container} ${isFullscreen ? styles.fullscreen : ''}`}
        >
            {/* Toolbar */}
            <Toolbar
                zoom={zoom}
                onZoomChange={setZoom}
                gridSize={gridSize}
                onGridSizeChange={setGridSize}
                snapToGrid={snapToGrid}
                onSnapToGridChange={setSnapToGrid}
                showScaleHighlight={showScaleHighlight}
                onShowScaleHighlightChange={setShowScaleHighlight}
                keySignature={displayKeySignature}
                metronomeEnabled={metronomeEnabled}
                onMetronomeEnabledChange={setMetronomeEnabled}
                metronomeSubdivision={metronomeSubdivision}
                onMetronomeSubdivisionChange={setMetronomeSubdivision}
                loopEnabled={loopEnabled}
                onLoopEnabledChange={setLoopEnabled}
                totalMeasures={phraseLayouts.totalMeasures}
                phraseLength={phrase?.length || 0}
                onAddMeasures={onUpdatePhraseLength ? handleAddMeasures : null}
                isPlaying={isPlaying}
                playbackPosition={playbackPosition}
                tempo={tempo}
                onPlay={handlePlay}
                onStop={handleStop}
                onSeek={seek}
                selectedNotesCount={selectedNotes.length}
                totalNotesCount={allNotesGlobal.length}
                hasClipboard={hasClipboard()}
                onCopy={handleCopy}
                onCut={handleCut}
                onPaste={handlePaste}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onQuantize={quantizeNotes}
                canUndo={historyIndex >= 0}
                canRedo={historyIndex < history.length - 1}
                onUndo={undo}
                onRedo={redo}
                isFullscreen={isFullscreen}
                onClose={onClose}
                isRecording={isRecording}
                onRecordingChange={setIsRecording}
            />

            {/* Main canvas area */}
            <div className={styles.canvasArea}>
                <PianoRollCanvas
                    notes={allNotesGlobal}
                    keys={keys}
                    selectedNoteIds={selectedNoteIdsSet}
                    phraseLayouts={phraseLayouts}
                    cellWidth={cellWidth}
                    cellHeight={cellHeight}
                    totalBeats={phraseLayouts.totalBeats}
                    beatsPerMeasure={beatsPerMeasure}
                    playbackPosition={playbackPosition}
                    isPlaying={isPlaying}
                    gridSize={gridSize}
                    snapToGridEnabled={snapToGrid}
                    isCompoundTime={isCompoundTime}
                    loopEnabled={loopEnabled}
                    loopRegion={loopRegion}
                    showScaleHighlight={showScaleHighlight}
                    isInScale={isInScale}
                    recordingPreviewNotes={recordingPreviewNotes}
                    activeRecordingNotes={activeRecordingNotes}
                    getNoteName={getNoteName}
                    scrollX={scrollX}
                    scrollY={scrollY}
                    onScroll={handleScroll}
                    onNoteClick={handleNoteClick}
                    onGridClick={handleGridClick}
                    onNoteDragEnd={handleNoteDragEnd}
                    onSelectionComplete={handleSelectionComplete}
                    onPlayheadSeek={handlePlayheadSeek}
                    onContextMenu={handleContextMenu}
                    className={styles.canvas}
                />
            </div>

            {/* Minimap (fullscreen only) */}
            {showMinimap && isFullscreen && (
                <Minimap
                    notes={allNotesGlobal}
                    totalBeats={phraseLayouts.totalBeats}
                    viewportStart={scrollX / cellWidth}
                    viewportEnd={(scrollX + viewportWidth) / cellWidth}
                    onNavigate={handleMinimapNavigate}
                />
            )}

            {/* MIDI Recorder (fullscreen only) */}
            {isFullscreen && isRecording && (
                <MidiRecorder
                    phrase={phrase}
                    tempo={tempo}
                    timeSignature={timeSignature}
                    gridSize={gridSize}
                    metronomeEnabled={metronomeEnabled}
                    metronomeSubdivision={metronomeSubdivision}
                    onAddNote={onAddNote}
                    onRecordingPreviewChange={setRecordingPreviewNotes}
                    onActiveNotesChange={setActiveRecordingNotes}
                />
            )}

            {/* Shortcuts hint */}
            <ShortcutsHint className={styles.shortcutsHint} />

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    context={contextMenu.context}
                    hasClipboard={hasClipboard()}
                    onAction={handleContextMenuAction}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );

    // Render in portal for fullscreen mode
    if (isFullscreen) {
        return createPortal(content, document.body);
    }

    return content;
}

export default PianoRollEditor;
