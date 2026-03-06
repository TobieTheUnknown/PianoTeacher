import React, { useEffect, useCallback, useRef, useState, memo, useMemo } from 'react';
import { useCanvasLayers } from '../../../hooks/useCanvasLayers';
import handColorsService from '../../../services/HandColorsService';
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
    playbackPosition = 0, // used only for non-animation reads (paste, etc.)
    positionRef = null,    // ref updated every frame for smooth animation
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
    onLoopRegionChange,
    onContextMenu,

    // Tool mode
    activeTool = 'draw',

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
    const [isDeselectMode, setIsDeselectMode] = useState(false);
    const [cursor, setCursor] = useState('crosshair');

    // Ref for storing original positions during multi-drag
    const originalPositionsRef = useRef(new Map());

    // Ref for loop handle dragging (avoids state re-renders during drag)
    const loopDragRef = useRef(null); // { handle: 'start'|'end', initialBeat, originalRegion }

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

    // Subscribe to hand color changes to trigger redraw
    useEffect(() => {
        const unsubscribe = handColorsService.addListener(() => {
            markStaticDirty();  // Grid colors (scale highlighting)
            markDynamicDirty(); // Note colors
        });
        return unsubscribe;
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

        // Draw loop region on static layer (handles sit on the header bar)
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
    }, [
        dimensions, cellWidth, cellHeight, keys, beatsPerMeasure, totalBeats,
        gridSize, isCompoundTime, scrollX, scrollY, showScaleHighlight, isInScale,
        getNoteName, activeNotes, phraseLayouts, loopEnabled, loopRegion
    ]);

    const drawDynamicLayer = useCallback((ctx) => {
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);

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

        // Playhead is drawn on the overlay layer for performance (not here)
    }, [
        dimensions, notes, keys, cellWidth, cellHeight, selectedIdsSet,
        scrollX, scrollY,
        recordingPreviewNotes, activeRecordingNotes, dragState
    ]);

    const drawOverlayLayer = useCallback((ctx) => {
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);

        // Draw playhead on overlay (lightweight - just a line, redrawn every frame during playback)
        drawPlayhead(ctx, {
            position: positionRef ? positionRef.current : 0,
            cellWidth,
            scrollX,
            viewportWidth: dimensions.width,
            viewportHeight: dimensions.height - HEADER_HEIGHT,
            pianoKeyWidth: PIANO_KEY_WIDTH,
            headerHeight: HEADER_HEIGHT,
            isPlaying
        });

        // Draw selection rectangle
        if (selectionRect) {
            drawSelectionRect(ctx, {
                rect: selectionRect,
                scrollX,
                scrollY,
                pianoKeyWidth: PIANO_KEY_WIDTH,
                headerHeight: HEADER_HEIGHT,
                isDeselectMode
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
    }, [dimensions, selectionRect, isDeselectMode, hoverState, dragState, keys, cellWidth, cellHeight, scrollX, scrollY, gridSize, positionRef, isPlaying]);

    // Animation loop - OPTIMIZED: continuous during playback, on-demand otherwise
    useEffect(() => {
        let animationFrameId;

        // Determine if continuous animation is needed
        const needsContinuousAnimation = isPlaying || dragState || selectionRect;

        const render = (timestamp) => {
            const elapsed = timestamp - lastDrawTimeRef.current;
            const FPS_INTERVAL = 1000 / 60;

            if (elapsed > FPS_INTERVAL) {
                lastDrawTimeRef.current = timestamp - (elapsed % FPS_INTERVAL);

                let didDraw = false;

                // Only redraw layers that need it
                if (needsRedraw.current.static) {
                    drawLayer('static', drawStaticLayer);
                    didDraw = true;
                }

                // Dynamic layer redraws only when dirty (notes changed, scroll, etc.)
                if (needsRedraw.current.dynamic || dragState) {
                    drawLayer('dynamic', drawDynamicLayer);
                    didDraw = true;
                }

                // Overlay redraws every frame during playback (playhead) or on interaction
                if (isPlaying || needsRedraw.current.overlay || selectionRect || hoverState || dragState) {
                    drawLayer('overlay', drawOverlayLayer);
                    didDraw = true;
                }

                // Follow playhead during playback (every ~200ms check)
                if (isPlaying && positionRef) {
                    const now = timestamp;
                    if (now - lastFollowCheckRef.current > 200) {
                        lastFollowCheckRef.current = now;
                        const fp = followPlayheadRef.current;
                        const pos = positionRef.current;
                        if (!fp.dragState && !isBeatVisible(pos, {
                            scrollX: fp.scrollX,
                            cellWidth: fp.cellWidth,
                            viewportWidth: fp.viewportWidth,
                            pianoKeyWidth: PIANO_KEY_WIDTH
                        })) {
                            const newScrollX = calculateScrollToCenter(pos, {
                                cellWidth: fp.cellWidth,
                                viewportWidth: fp.viewportWidth,
                                pianoKeyWidth: PIANO_KEY_WIDTH,
                                totalBeats: fp.totalBeats
                            });
                            if (fp.onScroll) {
                                fp.onScroll({ scrollX: newScrollX, scrollY: fp.scrollY });
                            } else if (fp.setInternalScrollX) {
                                fp.setInternalScrollX(newScrollX);
                            }
                        }
                    }
                }

                // If nothing was drawn and we don't need continuous animation, stop the loop
                if (!didDraw && !needsContinuousAnimation) {
                    return;
                }
            }

            // Continue loop only if needed
            if (needsContinuousAnimation ||
                needsRedraw.current.static ||
                needsRedraw.current.dynamic ||
                needsRedraw.current.overlay) {
                animationFrameId = requestAnimationFrame(render);
            }
        };

        // Start the loop
        animationFrameId = requestAnimationFrame(render);
        animationFrameRef.current = animationFrameId;

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [drawLayer, drawStaticLayer, drawDynamicLayer, drawOverlayLayer, isPlaying, dragState, selectionRect, hoverState, needsRedraw, positionRef]);

    // Re-trigger render loop when hover state changes
    useEffect(() => {
        if (hoverState && !animationFrameRef.current) {
            markOverlayDirty();
        }
    }, [hoverState, markOverlayDirty]);

    // Mark layers dirty when relevant props change
    useEffect(() => {
        markStaticDirty();
        markDynamicDirty(); // Notes also need redraw when scroll changes
    }, [scrollX, scrollY, showScaleHighlight, phraseLayouts, gridSize, cellWidth, cellHeight, markStaticDirty, markDynamicDirty]);

    useEffect(() => {
        markDynamicDirty();
    }, [notes, selectedIdsSet, recordingPreviewNotes, activeRecordingNotes, markDynamicDirty]);

    // Loop region changes affect static layer
    useEffect(() => {
        markStaticDirty();
    }, [loopRegion, loopEnabled, markStaticDirty]);

    // Follow playhead during playback (checked in animation loop, not state-driven)
    const lastFollowCheckRef = useRef(0);
    const followPlayheadRef = useRef({ scrollX, scrollY, cellWidth, viewportWidth: dimensions.width, totalBeats, dragState, onScroll, setInternalScrollX, isPlaying });
    followPlayheadRef.current = { scrollX, scrollY, cellWidth, viewportWidth: dimensions.width, totalBeats, dragState, onScroll, setInternalScrollX, isPlaying };

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
            // Check if clicking on a loop handle first
            if (loopEnabled && loopRegion && onLoopRegionChange) {
                const startHandleX = PIANO_KEY_WIDTH + loopRegion.start * cellWidth - scrollX;
                const endHandleX = PIANO_KEY_WIDTH + loopRegion.end * cellWidth - scrollX;
                const handleWidth = 12;
                const clickX = coords.canvasX;

                if (clickX >= startHandleX && clickX <= startHandleX + handleWidth) {
                    loopDragRef.current = { handle: 'start', originalRegion: { ...loopRegion } };
                    setCursor('ew-resize');
                    return;
                }
                if (clickX >= endHandleX - handleWidth && clickX <= endHandleX) {
                    loopDragRef.current = { handle: 'end', originalRegion: { ...loopRegion } };
                    setCursor('ew-resize');
                    return;
                }
            }

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
            if (activeTool === 'select') {
                // Start selection rectangle
                // Ctrl/Cmd = deselect mode
                setIsDeselectMode(e.ctrlKey || e.metaKey);
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
            // 'draw' mode → no selectionRect → mouseup will call onGridClick
        }
    }, [scrollX, scrollY, cellWidth, cellHeight, keys, notes, totalBeats, selectedIdsSet, onPlayheadSeek, onNoteClick, onNoteDragStart, loopEnabled, loopRegion, onLoopRegionChange, activeTool]);

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

        // Handle loop handle dragging
        if (loopDragRef.current && onLoopRegionChange && loopRegion) {
            const beat = Math.max(0, Math.min(totalBeats, coords.beat));
            const snappedBeat = snapToGrid(beat, gridSize, snapToGridEnabled);

            if (loopDragRef.current.handle === 'start') {
                const newStart = Math.min(snappedBeat, loopRegion.end - gridSize);
                onLoopRegionChange({ start: Math.max(0, newStart), end: loopRegion.end });
            } else {
                const newEnd = Math.max(snappedBeat, loopRegion.start + gridSize);
                onLoopRegionChange({ start: loopRegion.start, end: Math.min(totalBeats, newEnd) });
            }
            setCursor('ew-resize');
            return;
        }

        // Update cursor based on state
        let newCursor = 'crosshair';

        // Check if hovering over a loop handle (for cursor feedback)
        if (loopEnabled && loopRegion && coords.isInHeaderArea) {
            const startHandleX = PIANO_KEY_WIDTH + loopRegion.start * cellWidth - scrollX;
            const endHandleX = PIANO_KEY_WIDTH + loopRegion.end * cellWidth - scrollX;
            const handleWidth = 12;
            const clickX = coords.canvasX;

            if ((clickX >= startHandleX && clickX <= startHandleX + handleWidth) ||
                (clickX >= endHandleX - handleWidth && clickX <= endHandleX)) {
                newCursor = 'ew-resize';
            }
        }

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
        onNoteDrag, onSelectionRectChange, markOverlayDirty, startAutoScroll, stopAutoScroll,
        loopEnabled, loopRegion, onLoopRegionChange, totalBeats
    ]);

    const handleMouseUp = useCallback((e) => {
        // Clear auto-scroll
        stopAutoScroll();

        // Finalize loop handle drag
        if (loopDragRef.current) {
            loopDragRef.current = null;
            setCursor('crosshair');
            return;
        }

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
            setIsDeselectMode(false);
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
        onGridClick, markOverlayDirty, stopAutoScroll, activeTool
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

    // Wheel handler ref for native event listener (avoids passive event issue)
    const wheelHandlerRef = useRef(null);
    wheelHandlerRef.current = (e) => {
        e.preventDefault();

        const maxScrollX = Math.max(0, totalWidth - dimensions.width);
        const maxScrollY = Math.max(0, totalHeight - dimensions.height);

        let newScrollX = scrollX;
        let newScrollY = scrollY;

        if (e.shiftKey) {
            newScrollX = Math.max(0, Math.min(maxScrollX, scrollX + e.deltaY));
        } else {
            newScrollY = Math.max(0, Math.min(maxScrollY, scrollY + e.deltaY));
            newScrollX = Math.max(0, Math.min(maxScrollX, scrollX + e.deltaX));
        }

        if (onScroll) {
            onScroll({ scrollX: newScrollX, scrollY: newScrollY });
        } else {
            setInternalScrollX(newScrollX);
            setInternalScrollY(newScrollY);
        }
    };

    // Attach wheel listener natively with { passive: false }
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = (e) => wheelHandlerRef.current(e);
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

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
