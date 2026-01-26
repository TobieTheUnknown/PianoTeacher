/**
 * Canvas utility functions for PianoRollCanvas
 * Handles coordinate conversion, hit testing, and mouse interaction helpers
 */

/**
 * Convert mouse event coordinates to canvas grid coordinates
 */
export const getGridCoordinates = (e, {
    canvasRef,
    scrollX,
    scrollY,
    cellWidth,
    cellHeight,
    pianoKeyWidth = 90,
    headerHeight = 32,
    zoom = 1
}) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) / zoom;
    const canvasY = (e.clientY - rect.top) / zoom;

    // Grid coordinates (relative to grid area, not piano keys/header)
    const gridX = canvasX - pianoKeyWidth + scrollX;
    const gridY = canvasY - headerHeight + scrollY;

    // Beat and key calculations
    const beat = gridX / cellWidth;
    const keyIndex = Math.floor(gridY / cellHeight);

    return {
        canvasX,
        canvasY,
        gridX,
        gridY,
        beat,
        keyIndex,
        // Helper to check if click is in grid area
        isInGridArea: canvasX >= pianoKeyWidth && canvasY >= headerHeight,
        // Helper to check if click is in piano key area
        isInPianoKeyArea: canvasX < pianoKeyWidth && canvasY >= headerHeight,
        // Helper to check if click is in header area
        isInHeaderArea: canvasY < headerHeight
    };
};

/**
 * Snap a beat value to the nearest grid position
 */
export const snapToGrid = (beat, gridSize, enabled = true) => {
    if (!enabled) return beat;
    return Math.round(beat / gridSize) * gridSize;
};

/**
 * Find a note at the given grid position
 */
// eslint-disable-next-line no-unused-vars
export const findNoteAtPosition = (notes, beat, pitch, _cellWidth, _cellHeight) => {
    return notes.find(note => {
        const noteStartTime = note.globalStartTime !== undefined ? note.globalStartTime : note.startTime;
        const noteEndTime = noteStartTime + note.duration;

        return (
            note.pitch === pitch &&
            beat >= noteStartTime &&
            beat < noteEndTime
        );
    });
};

/**
 * Find all notes within a selection rectangle
 */
export const findNotesInRect = (notes, rect, keys, cellWidth, cellHeight) => {
    const selectedIds = [];

    notes.forEach(note => {
        const noteStartTime = note.globalStartTime !== undefined ? note.globalStartTime : note.startTime;
        const keyIndex = keys.indexOf(note.pitch);
        if (keyIndex === -1) return;

        const noteX = noteStartTime * cellWidth;
        const noteY = keyIndex * cellHeight;
        const noteWidth = note.duration * cellWidth;
        const noteHeight = cellHeight;

        // AABB intersection test
        const rectRight = rect.x + rect.width;
        const rectBottom = rect.y + rect.height;
        const noteRight = noteX + noteWidth;
        const noteBottom = noteY + noteHeight;

        // Normalize rect (handle negative width/height from dragging)
        const normalizedRect = {
            x: Math.min(rect.x, rectRight),
            y: Math.min(rect.y, rectBottom),
            right: Math.max(rect.x, rectRight),
            bottom: Math.max(rect.y, rectBottom)
        };

        if (
            noteX < normalizedRect.right &&
            noteRight > normalizedRect.x &&
            noteY < normalizedRect.bottom &&
            noteBottom > normalizedRect.y
        ) {
            selectedIds.push(note.id);
        }
    });

    return selectedIds;
};

/**
 * Check if mouse is over note resize handle
 */
export const isOverResizeHandle = (mouseX, note, cellWidth, pianoKeyWidth, scrollX, handleWidth = 8) => {
    const noteStartTime = note.globalStartTime !== undefined ? note.globalStartTime : note.startTime;
    const noteEndX = pianoKeyWidth + (noteStartTime + note.duration) * cellWidth - scrollX;

    return mouseX >= noteEndX - handleWidth && mouseX <= noteEndX;
};

/**
 * Determine drag type based on mouse position over note
 */
export const getDragType = (e, note, {
    canvasRef,
    cellWidth,
    pianoKeyWidth,
    scrollX,
    zoom = 1
}) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;

    if (isOverResizeHandle(mouseX, note, cellWidth, pianoKeyWidth, scrollX)) {
        return 'resize';
    }
    return 'move';
};

/**
 * Calculate new note position during drag
 */
export const calculateDragPosition = (originalNote, deltaX, deltaY, {
    keys,
    cellWidth,
    cellHeight,
    gridSize,
    snapEnabled,
    phraseLayouts = null
}) => {
    const deltaBeats = deltaX / cellWidth;
    const deltaPitch = Math.round(deltaY / cellHeight);

    // Calculate new start time
    const originalStartTime = originalNote.globalStartTime !== undefined
        ? originalNote.globalStartTime
        : originalNote.startTime;

    let newStartTime = Math.max(0, originalStartTime + deltaBeats);
    if (snapEnabled) {
        newStartTime = snapToGrid(newStartTime, gridSize);
    }

    // Calculate new pitch
    const originalKeyIndex = keys.indexOf(originalNote.pitch);
    const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
    const newPitch = keys[newKeyIndex];

    // If multi-phrase, find which phrase the new position falls into
    let localStartTime = newStartTime;
    let phraseId = originalNote.phraseId;

    if (phraseLayouts && phraseLayouts.layouts) {
        const layout = phraseLayouts.layouts.find(l =>
            newStartTime >= l.startBeat && newStartTime < l.endBeat
        );

        if (layout) {
            phraseId = layout.phraseId;
            localStartTime = newStartTime - layout.startBeat;
        }
    }

    return {
        globalStartTime: newStartTime,
        localStartTime,
        pitch: newPitch,
        duration: originalNote.duration,
        phraseId,
        trackName: originalNote.trackName
    };
};

/**
 * Calculate new duration during resize drag
 */
export const calculateResizeDuration = (originalNote, deltaX, {
    cellWidth,
    gridSize,
    snapEnabled,
    minDuration = 0.0625 // 1/16 note minimum
}) => {
    const deltaBeats = deltaX / cellWidth;
    let newDuration = Math.max(minDuration, originalNote.duration + deltaBeats);

    if (snapEnabled) {
        newDuration = Math.max(gridSize, snapToGrid(newDuration, gridSize));
    }

    return newDuration;
};

/**
 * Throttle function for performance
 */
export const throttle = (fn, delay) => {
    let lastCall = 0;
    let timeoutId = null;

    return (...args) => {
        const now = Date.now();
        const remaining = delay - (now - lastCall);

        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastCall = now;
            fn(...args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn(...args);
            }, remaining);
        }
    };
};

/**
 * Debounce function for resize/scroll events
 */
export const debounce = (fn, delay) => {
    let timeoutId = null;

    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    };
};

/**
 * Get cursor style based on interaction state
 */
export const getCursorStyle = (state) => {
    if (state.isDragging) {
        return state.dragType === 'resize' ? 'ew-resize' : 'grabbing';
    }
    if (state.isOverNote) {
        return state.isOverResizeHandle ? 'ew-resize' : 'grab';
    }
    if (state.isOverPianoKey) {
        return 'pointer';
    }
    if (state.isOverHeader) {
        return 'pointer';
    }
    return 'crosshair';
};

/**
 * Calculate scroll position to center on a beat
 */
export const calculateScrollToCenter = (beat, {
    cellWidth,
    viewportWidth,
    pianoKeyWidth = 90,
    totalBeats
}) => {
    const targetX = beat * cellWidth;
    const centerOffset = (viewportWidth - pianoKeyWidth) / 2;
    const maxScrollX = Math.max(0, totalBeats * cellWidth - (viewportWidth - pianoKeyWidth));

    return Math.max(0, Math.min(maxScrollX, targetX - centerOffset));
};

/**
 * Check if a beat position is visible in the current viewport
 */
export const isBeatVisible = (beat, {
    scrollX,
    cellWidth,
    viewportWidth,
    pianoKeyWidth = 90
}) => {
    const x = beat * cellWidth;
    return x >= scrollX && x <= scrollX + viewportWidth - pianoKeyWidth;
};

/**
 * Auto-scroll calculation for dragging near edges
 */
export const calculateAutoScroll = (mouseX, mouseY, {
    viewportWidth,
    viewportHeight,
    scrollX,
    scrollY,
    maxScrollX,
    maxScrollY,
    edgeThreshold = 50,
    scrollSpeed = 10
}) => {
    let dx = 0;
    let dy = 0;

    // Horizontal auto-scroll
    if (mouseX < edgeThreshold && scrollX > 0) {
        dx = -scrollSpeed;
    } else if (mouseX > viewportWidth - edgeThreshold && scrollX < maxScrollX) {
        dx = scrollSpeed;
    }

    // Vertical auto-scroll
    if (mouseY < edgeThreshold && scrollY > 0) {
        dy = -scrollSpeed;
    } else if (mouseY > viewportHeight - edgeThreshold && scrollY < maxScrollY) {
        dy = scrollSpeed;
    }

    return { dx, dy };
};

/**
 * Format beat position for display
 */
export const formatBeatPosition = (beat, beatsPerMeasure) => {
    const measure = Math.floor(beat / beatsPerMeasure) + 1;
    const beatInMeasure = (beat % beatsPerMeasure) + 1;
    const tick = Math.round((beatInMeasure % 1) * 480); // Standard MIDI ticks

    if (tick === 0) {
        return `${measure}.${Math.floor(beatInMeasure)}`;
    }
    return `${measure}.${Math.floor(beatInMeasure)}.${tick}`;
};

/**
 * Format duration for display
 */
export const formatDuration = (duration) => {
    if (duration >= 4) return `${duration / 4} mesure${duration >= 8 ? 's' : ''}`;
    if (duration >= 1) return `${duration} temps`;
    if (duration >= 0.5) return `${duration * 2}/2`;
    if (duration >= 0.25) return `${duration * 4}/4`;
    if (duration >= 0.125) return `${duration * 8}/8`;
    return `${duration * 16}/16`;
};
