import React, { useEffect, useCallback, useRef, useState, memo, useMemo } from 'react';
import { useCanvasLayers } from '../../../hooks/useCanvasLayers';
import {
    drawGrid,
    drawPianoKeys,
    drawMeasureNumbers,
    drawNotes,
    drawPlayhead,
    drawSelectionRect,
    drawNotePreview,
    drawLoopRegion,
    drawDragPreview,
    drawRecordingNotes
} from './drawFunctions';
import {
    getGridCoordinates,
    snapToGrid,
    findNoteAtPosition,
    findNotesInRect,
    getDragType,
    calculateDragPosition,
    calculateResizeDuration,
    calculateAutoScroll,
    isBeatVisible,
    calculateScrollToCenter
} from './canvasUtils';

// Default dimensions
const PIANO_KEY_WIDTH = 90;
const HEADER_HEIGHT = 32;
const DEFAULT_CELL_WIDTH = 40;
const DEFAULT_CELL_HEIGHT = 24;

/**
 * High-performance Canvas-based Piano Roll
 * Uses 3-layer canvas architecture for optimal rendering
 */
const PianoRollCanvas = memo(({
    // Data
    notes,
    keys,
    selectedNoteIds = new Set(),
    phraseLayouts = null,

    // Dimensions
    cellWidth = DEFAULT_CELL_WIDTH,
    cellHeight = DEFAULT_CELL_HEIGHT,
    totalBeats,
    beatsPerMeasure = 4,

    // State
    playbackPosition = 0,
    isPlaying = false,
    gridSize = 0.25,
    snapToGridEnabled = true,
    isCompoundTime = false,
    loopEnabled = false,
    loopRegion = null,

    // Scale highlighting
    showScaleHighlight = false,
    isInScale = () => true,

    // Recording
    recordingPreviewNotes = [],
    activeRecordingNotes = [],

    // Note naming
    getNoteName,

    // Active MIDI notes
    activeNotes = new Set(),

    // Callbacks
    onNoteClick,
    onNoteDoubleClick,
    onGridClick,
    // eslint-disable-next-line no-unused-vars
    onNoteUpdate, // Reserved for future use
    onNoteDragStart,
    onNoteDrag,
    onNoteDragEnd,
    onSelectionRectChange,
    onSelectionComplete,
    onPlayheadSeek,
    // eslint-disable-next-line no-unused-vars
    onLoopHandleDrag, // Reserved for loop handle interaction
    onContextMenu,

    // Scroll sync (controlled mode)
    scrollX: controlledScrollX,
    scrollY: controlledScrollY,
    onScroll,

    // Style
    className,
    style
}) => {
    // Refs
    const containerRef = useRef(null);
    const lastDrawTimeRef = useRef(0);
    const animationFrameRef = useRef(null);
    const autoScrollIntervalRef = useRef(null);
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const scrollRef = useRef({ x: 0, y: 0 });

    // Internal state
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [internalScrollX, setInternalScrollX] = useState(0);
    const [internalScrollY, setInternalScrollY] = useState(0);
    const [hoverState, setHoverState] = useState(null);
    const [dragState, setDragState] = useState(null);
    const [selectionRect, setSelectionRect] = useState(null);
    const [cursor, setCursor] = useState('crosshair');

    // Ref for storing original positions during multi-drag
    const originalPositionsRef = useRef(new Map());

    // Use controlled or internal scroll state
    const scrollX = controlledScrollX !== undefined ? controlledScrollX : internalScrollX;
    const scrollY = controlledScrollY !== undefined ? controlledScrollY : internalScrollY;

    // Keep scrollRef synchronized for auto-scroll interval
    scrollRef.current = { x: scrollX, y: scrollY };

    // Calculate total dimensions
    const totalWidth = totalBeats * cellWidth + PIANO_KEY_WIDTH + 50;
    const totalHeight = keys.length * cellHeight + HEADER_HEIGHT + 50;

    // Canvas layers hook
    const {
        staticLayerRef,
        dynamicLayerRef,
        overlayLayerRef,
        drawLayer,
        markStaticDirty,
        markDynamicDirty,
        markOverlayDirty,
        needsRedraw
    } = useCanvasLayers(dimensions.width, dimensions.height);

    // Memoized selected IDs set
    const selectedIdsSet = useMemo(() => {
        return selectedNoteIds instanceof Set ? selectedNoteIds : new Set(selectedNoteIds);
    }, [selectedNoteIds]);

    // Handle container resize
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width: Math.floor(width), height: Math.floor(height) });
                markStaticDirty();
                markDynamicDirty();
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [markStaticDirty, markDynamicDirty]);

    // Drawing functions
    const drawStaticLayer = useCallback((ctx) => {
        // Clear with background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);

        drawGrid(ctx, {
            cellWidth,
            cellHeight,
            keys,
            beatsPerMeasure,
            totalBeats,
            gridSize,
            isCompoundTime,
            scrollX,
            scrollY,
            viewportWidth: dimensions.width,
            viewportHeight: dimensions.height,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT,
            showScaleHighlight,
            isInScale,
            phraseLayouts
        });

        drawPianoKeys(ctx, {
            cellHeight,
            keys,
            scrollY,
            viewportHeight: dimensions.height,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT,
            getNoteName,
            activeNotes
        });

        drawMeasureNumbers(ctx, {
            cellWidth,
            beatsPerMeasure,
            totalBeats,
            scrollX,
            viewportWidth: dimensions.width,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT,
            phraseLayouts
        });
    }, [
        dimensions, cellWidth, cellHeight, keys, beatsPerMeasure, totalBeats,
        gridSize, isCompoundTime, scrollX, scrollY, showScaleHighlight, isInScale,
        getNoteName, activeNotes, phraseLayouts
    ]);

    const drawDynamicLayer = useCallback((ctx) => {
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);

        // Draw loop region first (background)
        if (loopEnabled && loopRegion) {
            drawLoopRegion(ctx, {
                loopStart: loopRegion.start,
                loopEnd: loopRegion.end,
                cellWidth,
                scrollX,
                viewportHeight: dimensions.height - HEADER_HEIGHT,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT
            });
        }

        // Draw notes
        drawNotes(ctx, {
            notes,
            keys,
            cellWidth,
            cellHeight,
            selectedIds: selectedIdsSet,
            scrollX,
            scrollY,
            viewportWidth: dimensions.width,
            viewportHeight: dimensions.height,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT,
            dragState
        });

        // Draw recording notes
        if (recordingPreviewNotes.length > 0 || activeRecordingNotes.length > 0) {
            drawRecordingNotes(ctx, {
                recordingNotes: recordingPreviewNotes,
                activeRecordingNotes,
                keys,
                cellWidth,
                cellHeight,
                scrollX,
                scrollY,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT
            });
        }

        // Draw playhead
        drawPlayhead(ctx, {
            position: playbackPosition,
            cellWidth,
            scrollX,
            viewportHeight: dimensions.height - HEADER_HEIGHT,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT,
            isPlaying
        });
    }, [
        dimensions, notes, keys, cellWidth, cellHeight, selectedIdsSet,
        scrollX, scrollY, playbackPosition, isPlaying, loopEnabled, loopRegion,
        recordingPreviewNotes, activeRecordingNotes, dragState
    ]);

    const drawOverlayLayer = useCallback((ctx) => {
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);

        // Draw selection rectangle
        if (selectionRect) {
            drawSelectionRect(ctx, {
                rect: selectionRect,
                scrollX,
                scrollY,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT
            });
        }

        // Draw note preview on hover
        if (hoverState && !dragState && !selectionRect) {
            drawNotePreview(ctx, {
                beat: hoverState.beat,
                pitch: hoverState.pitch,
                duration: gridSize,
                keys,
                cellWidth,
                cellHeight,
                scrollX,
                scrollY,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT
            });
        }

        // Draw drag preview
        if (dragState) {
            drawDragPreview(ctx, {
                dragState,
                keys,
                cellWidth,
                cellHeight,
                scrollX,
                scrollY,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT
            });
        }
    }, [dimensions, selectionRect, hoverState, dragState, keys, cellWidth, cellHeight, scrollX, scrollY, gridSize]);

    // Animation loop
    useEffect(() => {
        let animationFrameId;
        const FPS_INTERVAL = 1000 / 60;

        const render = (timestamp) => {
            const elapsed = timestamp - lastDrawTimeRef.current;

            if (elapsed > FPS_INTERVAL) {
                lastDrawTimeRef.current = timestamp - (elapsed % FPS_INTERVAL);

                // Only redraw layers that need it
                if (needsRedraw.current.static) {
                    drawLayer('static', drawStaticLayer);
                }

                // Dynamic layer redraws every frame during playback or drag
                if (isPlaying || dragState || needsRedraw.current.dynamic) {
                    drawLayer('dynamic', drawDynamicLayer);
                }

                if (needsRedraw.current.overlay || selectionRect || hoverState || dragState) {
                    drawLayer('overlay', drawOverlayLayer);
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
        animationFrameRef.current = animationFrameId;

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [drawLayer, drawStaticLayer, drawDynamicLayer, drawOverlayLayer, isPlaying, dragState, selectionRect, hoverState, needsRedraw]);

    // Mark layers dirty when relevant props change
    useEffect(() => {
        markStaticDirty();
        markDynamicDirty(); // Notes also need redraw when scroll changes
    }, [scrollX, scrollY, showScaleHighlight, phraseLayouts, markStaticDirty, markDynamicDirty]);

    useEffect(() => {
        markDynamicDirty();
    }, [notes, selectedIdsSet, playbackPosition, loopRegion, recordingPreviewNotes, activeRecordingNotes, markDynamicDirty]);

    // Follow playhead during playback
    useEffect(() => {
        if (isPlaying && !dragState) {
            if (!isBeatVisible(playbackPosition, {
                scrollX,
                cellWidth,
                viewportWidth: dimensions.width,
                pianoKeyWidth: PIANO_KEY_WIDTH
            })) {
                const newScrollX = calculateScrollToCenter(playbackPosition, {
                    cellWidth,
                    viewportWidth: dimensions.width,
                    pianoKeyWidth: PIANO_KEY_WIDTH,
                    totalBeats
                });

                if (onScroll) {
                    onScroll({ scrollX: newScrollX, scrollY });
                } else {
                    setInternalScrollX(newScrollX);
                }
            }
        }
    }, [isPlaying, playbackPosition, scrollX, scrollY, cellWidth, dimensions.width, totalBeats, dragState, onScroll]);

    // Auto-scroll helper functions
    const startAutoScroll = useCallback(() => {
        if (autoScrollIntervalRef.current) return; // Already running

        autoScrollIntervalRef.current = setInterval(() => {
            const { x: mouseX, y: mouseY } = mousePositionRef.current;
            const { x: currentScrollX, y: currentScrollY } = scrollRef.current;

            const autoScroll = calculateAutoScroll(mouseX, mouseY, {
                viewportWidth: dimensions.width,
                viewportHeight: dimensions.height,
                scrollX: currentScrollX,
                scrollY: currentScrollY,
                maxScrollX: Math.max(0, totalWidth - dimensions.width),
                maxScrollY: Math.max(0, totalHeight - dimensions.height)
            });

            if (autoScroll.dx !== 0 || autoScroll.dy !== 0) {
                const newScrollX = Math.max(0, Math.min(
                    totalWidth - dimensions.width,
                    currentScrollX + autoScroll.dx
                ));
                const newScrollY = Math.max(0, Math.min(
                    totalHeight - dimensions.height,
                    currentScrollY + autoScroll.dy
                ));

                if (onScroll) {
                    onScroll({ scrollX: newScrollX, scrollY: newScrollY });
                } else {
                    setInternalScrollX(newScrollX);
                    setInternalScrollY(newScrollY);
                }
            }
        }, 16);
    }, [dimensions, totalWidth, totalHeight, onScroll]);

    const stopAutoScroll = useCallback(() => {
        if (autoScrollIntervalRef.current) {
            clearInterval(autoScrollIntervalRef.current);
            autoScrollIntervalRef.current = null;
        }
    }, []);

    // Mouse event handlers
    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return; // Only handle left click

        const coords = getGridCoordinates(e, {
            canvasRef: containerRef,
            scrollX,
            scrollY,
            cellWidth,
            cellHeight,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT
        });

        if (coords.isInHeaderArea) {
            // Click on header - seek playhead
            const beat = Math.max(0, Math.min(totalBeats, coords.beat));
            if (onPlayheadSeek) {
                onPlayheadSeek(beat);
            }
            return;
        }

        if (coords.isInPianoKeyArea) {
            // Click on piano key - play note
            if (coords.keyIndex >= 0 && coords.keyIndex < keys.length) {
                const pitch = keys[coords.keyIndex];
                // Trigger audio preview via callback or direct
                if (onNoteClick) {
                    onNoteClick(null, { pitch, isKeyPress: true });
                }
            }
            return;
        }

        if (!coords.isInGridArea) return;

        // Check if clicking on a note
        const clickedNote = findNoteAtPosition(
            notes,
            coords.beat,
            keys[coords.keyIndex],
            cellWidth,
            cellHeight
        );

        if (clickedNote) {
            // Determine drag type (move or resize)
            const dragType = getDragType(e, clickedNote, {
                canvasRef: containerRef,
                cellWidth,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                scrollX
            });

            // Check if this is a multi-drag (note is selected and there are multiple selections)
            const isMultiDrag = dragType !== 'resize' &&
                selectedIdsSet.has(clickedNote.id) &&
                selectedIdsSet.size > 1;

            // Store original positions for all notes involved in the drag
            const originalPositions = new Map();
            if (isMultiDrag) {
                notes.filter(n => selectedIdsSet.has(n.id)).forEach(n => {
                    originalPositions.set(n.id, {
                        localStartTime: n.localStartTime || n.startTime,
                        globalStartTime: n.globalStartTime || n.startTime,
                        pitch: n.pitch,
                        duration: n.duration,
                        phraseId: n.phraseId,
                        trackName: n.trackName
                    });
                });
            } else {
                originalPositions.set(clickedNote.id, {
                    localStartTime: clickedNote.localStartTime || clickedNote.startTime,
                    globalStartTime: clickedNote.globalStartTime || clickedNote.startTime,
                    pitch: clickedNote.pitch,
                    duration: clickedNote.duration,
                    phraseId: clickedNote.phraseId,
                    trackName: clickedNote.trackName
                });
            }
            originalPositionsRef.current = originalPositions;

            // Start drag
            setDragState({
                type: dragType,
                noteId: clickedNote.id,
                note: clickedNote,
                startX: e.clientX,
                startY: e.clientY,
                startScrollX: scrollX,
                startScrollY: scrollY,
                hasMoved: false,
                previewPosition: null,
                isMultiDrag,
                previewUpdates: null
            });

            if (onNoteDragStart) {
                onNoteDragStart(clickedNote, dragType, e);
            }
        } else {
            // Start selection rectangle
            setSelectionRect({
                x: coords.gridX,
                y: coords.gridY,
                width: 0,
                height: 0,
                startX: coords.gridX,
                startY: coords.gridY,
                // Store initial scroll to compensate for scroll changes during selection
                initialScrollX: scrollX,
                initialScrollY: scrollY
            });
        }
    }, [scrollX, scrollY, cellWidth, cellHeight, keys, notes, totalBeats, selectedIdsSet, onPlayheadSeek, onNoteClick, onNoteDragStart]);

    const handleMouseMove = useCallback((e) => {
        const coords = getGridCoordinates(e, {
            canvasRef: containerRef,
            scrollX,
            scrollY,
            cellWidth,
            cellHeight,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT
        });

        // Always track mouse position for auto-scroll
        mousePositionRef.current = { x: coords.canvasX, y: coords.canvasY };

        // Update cursor based on state
        let newCursor = 'crosshair';

        if (dragState) {
            // Handle drag
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const hasMoved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;

            if (hasMoved || dragState.hasMoved) {
                if (dragState.type === 'resize') {
                    const newDuration = calculateResizeDuration(dragState.note, deltaX, {
                        cellWidth,
                        gridSize,
                        snapEnabled: snapToGridEnabled
                    });

                    setDragState(prev => ({
                        ...prev,
                        hasMoved: true,
                        previewPosition: {
                            ...prev.note,
                            duration: newDuration
                        }
                    }));

                    if (onNoteDrag) {
                        onNoteDrag(dragState.note, { duration: newDuration });
                    }
                } else {
                    // Calculate main note position
                    const newPosition = calculateDragPosition(dragState.note, deltaX, deltaY, {
                        keys,
                        cellWidth,
                        cellHeight,
                        gridSize,
                        snapEnabled: snapToGridEnabled,
                        phraseLayouts
                    });

                    // For multi-drag, calculate positions for all selected notes
                    let previewUpdates = null;
                    if (dragState.isMultiDrag) {
                        previewUpdates = [];
                        const deltaBeats = deltaX / cellWidth;
                        const deltaPitch = Math.round(deltaY / cellHeight);

                        originalPositionsRef.current.forEach((original, noteId) => {
                            let newStartTime = original.globalStartTime + deltaBeats;
                            if (snapToGridEnabled) {
                                newStartTime = snapToGrid(newStartTime, gridSize, true);
                            }
                            newStartTime = Math.max(0, newStartTime);

                            // Calculate new pitch
                            const originalKeyIndex = keys.indexOf(original.pitch);
                            const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
                            const newPitch = keys[newKeyIndex];

                            // Determine phrase for new position
                            let localStartTime = newStartTime;
                            let phraseId = original.phraseId;

                            if (phraseLayouts?.layouts) {
                                const layout = phraseLayouts.layouts.find(
                                    l => newStartTime >= l.startBeat && newStartTime < l.endBeat
                                );
                                if (layout) {
                                    phraseId = layout.phraseId;
                                    localStartTime = newStartTime - layout.startBeat;
                                }
                            }

                            previewUpdates.push({
                                noteId,
                                globalStartTime: newStartTime,
                                localStartTime,
                                pitch: newPitch,
                                phraseId,
                                duration: original.duration,
                                trackName: original.trackName
                            });
                        });
                    }

                    setDragState(prev => ({
                        ...prev,
                        hasMoved: true,
                        previewPosition: newPosition,
                        previewUpdates
                    }));

                    if (onNoteDrag) {
                        onNoteDrag(dragState.note, newPosition);
                    }
                }
            }

            newCursor = dragState.type === 'resize' ? 'ew-resize' : 'grabbing';

            // Auto-scroll during drag
            const autoScroll = calculateAutoScroll(coords.canvasX, coords.canvasY, {
                viewportWidth: dimensions.width,
                viewportHeight: dimensions.height,
                scrollX,
                scrollY,
                maxScrollX: Math.max(0, totalWidth - dimensions.width),
                maxScrollY: Math.max(0, totalHeight - dimensions.height)
            });

            if (autoScroll.dx !== 0 || autoScroll.dy !== 0) {
                startAutoScroll();
            } else {
                stopAutoScroll();
            }

            markOverlayDirty();
        } else if (selectionRect) {
            // Update selection rectangle
            // Compensate for scroll delta since the start of selection
            const scrollDeltaX = scrollX - selectionRect.initialScrollX;
            const scrollDeltaY = scrollY - selectionRect.initialScrollY;

            const newRect = {
                ...selectionRect,
                width: coords.gridX - selectionRect.startX + scrollDeltaX,
                height: coords.gridY - selectionRect.startY + scrollDeltaY
            };

            setSelectionRect(newRect);

            if (onSelectionRectChange) {
                onSelectionRectChange(newRect);
            }

            // Auto-scroll during selection
            const autoScroll = calculateAutoScroll(coords.canvasX, coords.canvasY, {
                viewportWidth: dimensions.width,
                viewportHeight: dimensions.height,
                scrollX,
                scrollY,
                maxScrollX: Math.max(0, totalWidth - dimensions.width),
                maxScrollY: Math.max(0, totalHeight - dimensions.height)
            });

            if (autoScroll.dx !== 0 || autoScroll.dy !== 0) {
                startAutoScroll();
            } else {
                stopAutoScroll();
            }

            newCursor = 'crosshair';
            markOverlayDirty();
        } else if (coords.isInGridArea) {
            // Hover state
            const hoveredNote = findNoteAtPosition(
                notes,
                coords.beat,
                keys[coords.keyIndex],
                cellWidth,
                cellHeight
            );

            if (hoveredNote) {
                const isOverResize = getDragType(e, hoveredNote, {
                    canvasRef: containerRef,
                    cellWidth,
                    pianoKeyWidth: PIANO_KEY_WIDTH,
                    scrollX
                }) === 'resize';

                newCursor = isOverResize ? 'ew-resize' : 'grab';
                setHoverState(null);
            } else if (coords.keyIndex >= 0 && coords.keyIndex < keys.length) {
                // Show note preview
                const snappedBeat = snapToGrid(coords.beat, gridSize, snapToGridEnabled);
                setHoverState({
                    beat: snappedBeat,
                    pitch: keys[coords.keyIndex]
                });
                markOverlayDirty();
            }
        } else {
            setHoverState(null);
            newCursor = coords.isInPianoKeyArea ? 'pointer' : 'default';
        }

        setCursor(newCursor);
    }, [
        scrollX, scrollY, cellWidth, cellHeight, keys, notes, dragState, selectionRect,
        gridSize, snapToGridEnabled, phraseLayouts, dimensions, totalWidth, totalHeight,
        onNoteDrag, onSelectionRectChange, markOverlayDirty, startAutoScroll, stopAutoScroll
    ]);

    const handleMouseUp = useCallback((e) => {
        // Clear auto-scroll
        stopAutoScroll();

        if (dragState) {
            if (!dragState.hasMoved) {
                // Click without drag - toggle selection or delete
                if (onNoteClick) {
                    onNoteClick(dragState.note, e);
                }
            } else if (onNoteDragEnd) {
                // Build drag result with all updates
                const dragResult = {
                    type: dragState.type,
                    noteId: dragState.noteId,
                    note: dragState.note,
                    hasMoved: dragState.hasMoved,
                    isMultiDrag: dragState.isMultiDrag || false,
                    cancelled: false
                };

                if (dragState.type === 'resize') {
                    dragResult.updates = [{
                        noteId: dragState.noteId,
                        duration: dragState.previewPosition?.duration
                    }];
                } else if (dragState.isMultiDrag && dragState.previewUpdates) {
                    dragResult.updates = dragState.previewUpdates;
                } else if (dragState.previewPosition) {
                    // Single note move
                    dragResult.updates = [{
                        noteId: dragState.noteId,
                        globalStartTime: dragState.previewPosition.globalStartTime,
                        localStartTime: dragState.previewPosition.localStartTime,
                        pitch: dragState.previewPosition.pitch,
                        phraseId: dragState.previewPosition.phraseId,
                        duration: dragState.note.duration,
                        trackName: dragState.note.trackName
                    }];
                }

                onNoteDragEnd(dragResult);
            }

            // Clear original positions ref
            originalPositionsRef.current.clear();
            setDragState(null);
            markOverlayDirty();
        } else if (selectionRect) {
            // Complete selection
            if (onSelectionComplete) {
                const selected = findNotesInRect(notes, selectionRect, keys, cellWidth, cellHeight);
                onSelectionComplete(selected, e);
            }

            setSelectionRect(null);
            markOverlayDirty();
        } else {
            // Click on empty grid - add note
            const coords = getGridCoordinates(e, {
                canvasRef: containerRef,
                scrollX,
                scrollY,
                cellWidth,
                cellHeight,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT
            });

            if (coords.isInGridArea && coords.keyIndex >= 0 && coords.keyIndex < keys.length) {
                const snappedBeat = snapToGrid(coords.beat, gridSize, snapToGridEnabled);
                const pitch = keys[coords.keyIndex];

                if (onGridClick) {
                    onGridClick(pitch, snappedBeat);
                }
            }
        }

        setCursor('crosshair');
    }, [
        dragState, selectionRect, notes, keys, cellWidth, cellHeight, scrollX, scrollY,
        gridSize, snapToGridEnabled, onNoteClick, onNoteDragEnd, onSelectionComplete,
        onGridClick, markOverlayDirty, stopAutoScroll
    ]);

    const handleMouseLeave = useCallback(() => {
        stopAutoScroll();
        setHoverState(null);
        markOverlayDirty();
    }, [stopAutoScroll, markOverlayDirty]);

    const handleDoubleClick = useCallback((e) => {
        const coords = getGridCoordinates(e, {
            canvasRef: containerRef,
            scrollX,
            scrollY,
            cellWidth,
            cellHeight,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT
        });

        if (!coords.isInGridArea) return;

        const clickedNote = findNoteAtPosition(
            notes,
            coords.beat,
            keys[coords.keyIndex],
            cellWidth,
            cellHeight
        );

        if (clickedNote && onNoteDoubleClick) {
            onNoteDoubleClick(clickedNote, e);
        }
    }, [scrollX, scrollY, cellWidth, cellHeight, keys, notes, onNoteDoubleClick]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();

        if (onContextMenu) {
            const coords = getGridCoordinates(e, {
                canvasRef: containerRef,
                scrollX,
                scrollY,
                cellWidth,
                cellHeight,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT
            });

            const clickedNote = coords.isInGridArea
                ? findNoteAtPosition(notes, coords.beat, keys[coords.keyIndex], cellWidth, cellHeight)
                : null;

            onContextMenu(e, {
                note: clickedNote,
                beat: coords.beat,
                pitch: coords.keyIndex >= 0 && coords.keyIndex < keys.length ? keys[coords.keyIndex] : null,
                coords
            });
        }
    }, [scrollX, scrollY, cellWidth, cellHeight, keys, notes, onContextMenu]);

    // Wheel handler for scrolling
    const handleWheel = useCallback((e) => {
        e.preventDefault();

        const maxScrollX = Math.max(0, totalWidth - dimensions.width);
        const maxScrollY = Math.max(0, totalHeight - dimensions.height);

        let newScrollX = scrollX;
        let newScrollY = scrollY;

        if (e.shiftKey) {
            // Horizontal scroll
            newScrollX = Math.max(0, Math.min(maxScrollX, scrollX + e.deltaY));
        } else {
            // Vertical scroll (with horizontal for large deltaX)
            newScrollY = Math.max(0, Math.min(maxScrollY, scrollY + e.deltaY));
            newScrollX = Math.max(0, Math.min(maxScrollX, scrollX + e.deltaX));
        }

        if (onScroll) {
            onScroll({ scrollX: newScrollX, scrollY: newScrollY });
        } else {
            setInternalScrollX(newScrollX);
            setInternalScrollY(newScrollY);
        }
    }, [scrollX, scrollY, totalWidth, totalHeight, dimensions, onScroll]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                cursor,
                overscrollBehavior: 'contain', // Prevent browser swipe back/forward
                touchAction: 'none', // Prevent touch gestures interference
                ...style
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
        >
            <canvas
                ref={staticLayerRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 1,
                    pointerEvents: 'none'
                }}
            />
            <canvas
                ref={dynamicLayerRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 2,
                    pointerEvents: 'none'
                }}
            />
            <canvas
                ref={overlayLayerRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 3,
                    pointerEvents: 'none'
                }}
            />
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for performance optimization
    // Only re-render if essential props change
    return (
        prevProps.notes === nextProps.notes &&
        prevProps.selectedNoteIds === nextProps.selectedNoteIds &&
        prevProps.playbackPosition === nextProps.playbackPosition &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.cellWidth === nextProps.cellWidth &&
        prevProps.cellHeight === nextProps.cellHeight &&
        prevProps.scrollX === nextProps.scrollX &&
        prevProps.scrollY === nextProps.scrollY &&
        prevProps.gridSize === nextProps.gridSize &&
        prevProps.showScaleHighlight === nextProps.showScaleHighlight &&
        prevProps.loopEnabled === nextProps.loopEnabled &&
        prevProps.loopRegion === nextProps.loopRegion &&
        prevProps.recordingPreviewNotes === nextProps.recordingPreviewNotes &&
        prevProps.activeRecordingNotes === nextProps.activeRecordingNotes
    );
});

PianoRollCanvas.displayName = 'PianoRollCanvas';

export default PianoRollCanvas;
