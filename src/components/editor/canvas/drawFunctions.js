/**
 * Canvas drawing functions for PianoRollCanvas
 * Optimized for performance with minimal DOM operations
 */

import themeService from '../../../services/ThemeService';

// Function to get dynamic colors from ThemeService
export const getDynamicColors = () => {
    const colors = themeService.getColors();
    const scaleColors = colors.scaleHighlight;

    return {
        // Note colors from service (MD = right = melody, MG = left = chords)
        melodyNote: colors.rightHand.primary,
        melodyNoteSelected: colors.rightHand.selected,
        melodyNoteGradientEnd: colors.rightHand.dark,
        chordsNote: colors.leftHand.primary,
        chordsNoteSelected: colors.leftHand.selected,
        chordsNoteGradientEnd: colors.leftHand.dark,
        // Scale highlighting
        inScaleHighlight: scaleColors.inScale,
        outOfScaleHighlight: scaleColors.outOfScale,
    };
};

// Color constants for consistent theming
export const COLORS = {
    // Grid colors
    gridLine: 'rgba(255, 255, 255, 0.05)',
    measureLine: 'rgba(139, 92, 246, 0.3)',
    beatLine: 'rgba(255, 255, 255, 0.08)',
    blackKeyLane: 'rgba(0, 0, 0, 0.15)',
    whiteKeyLane: 'transparent',

    // Scale highlighting - these are defaults, use getDynamicColors() for current values
    inScaleHighlight: 'rgba(251, 191, 36, 0.15)',
    outOfScaleHighlight: 'rgba(30, 30, 40, 0.25)',

    // Note colors - defaults, use getDynamicColors() for current values
    melodyNote: '#f43f5e',           // Right hand (MD) - rose/red
    melodyNoteSelected: '#fda4af',   // Lighter when selected
    melodyNoteGradientEnd: '#e11d48',
    chordsNote: '#3b82f6',           // Left hand (MG) - blue
    chordsNoteSelected: '#93c5fd',   // Lighter when selected
    chordsNoteGradientEnd: '#2563eb',
    noteHover: 'rgba(255, 255, 255, 0.2)',

    // Selection
    selectionBorder: 'rgba(139, 92, 246, 0.8)',
    selectionFill: 'rgba(139, 92, 246, 0.15)',
    deselectBorder: 'rgba(239, 68, 68, 0.8)',
    deselectFill: 'rgba(239, 68, 68, 0.15)',

    // Playhead
    playheadPlaying: 'rgba(239, 68, 68, 0.9)',
    playheadStopped: 'rgba(59, 130, 246, 0.8)',

    // Piano keys
    whiteKey: '#f0f0f0',
    whiteKeyBorder: '#d1d5db',
    blackKey: '#1f2937',
    blackKeyBorder: '#111827',
    keyText: '#374151',
    keyTextBlack: '#d1d5db',

    // Loop region
    loopRegionFill: 'rgba(139, 92, 246, 0.1)',
    loopRegionBorder: 'rgba(139, 92, 246, 0.5)',

    // Phrase separator
    phraseSeparator: 'rgba(139, 92, 246, 0.6)',

    // Note preview (hover)
    notePreview: 'rgba(139, 92, 246, 0.3)',

    // Measure number
    measureNumber: 'rgba(255, 255, 255, 0.4)',
    measureNumberHighlight: '#8b5cf6'
};


/**
 * Helper to draw a rounded rectangle
 */
export const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    // Guard against negative dimensions
    if (width <= 0 || height <= 0) return;

    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;

    // Ensure radius is non-negative
    radius = Math.max(0, radius);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
};

/**
 * Check if a pitch is a black key
 */
export const isBlackKey = (pitch) => {
    const noteInOctave = pitch % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
};

/**
 * Draw the piano roll grid
 */
export const drawGrid = (ctx, {
    cellWidth,
    cellHeight,
    keys,
    beatsPerMeasure,
    totalBeats,
    gridSize,
    isCompoundTime,
    scrollX = 0,
    scrollY = 0,
    viewportWidth,
    viewportHeight,
    pianoKeyWidth = 90,
    headerHeight = 32,
    showScaleHighlight = false,
    isInScale = () => true,
    phraseLayouts = null
}) => {
    const gridStartX = pianoKeyWidth;
    const gridStartY = headerHeight;

    // Calculate visible range for optimization
    const startBeat = Math.max(0, Math.floor(scrollX / cellWidth) - 1);
    const endBeat = Math.min(totalBeats, Math.ceil((scrollX + viewportWidth) / cellWidth) + 1);
    const startKeyIndex = Math.max(0, Math.floor(scrollY / cellHeight) - 1);
    const endKeyIndex = Math.min(keys.length, Math.ceil((scrollY + viewportHeight) / cellHeight) + 1);

    // Draw horizontal pitch lanes
    for (let i = startKeyIndex; i < endKeyIndex; i++) {
        const pitch = keys[i];
        const y = gridStartY + i * cellHeight - scrollY;
        const isBlack = isBlackKey(pitch);

        // Lane background
        const noteInScale = isInScale(pitch);

        // Get dynamic colors from service
        const dynamicColors = getDynamicColors();

        if (showScaleHighlight) {
            if (noteInScale) {
                // Note is in scale - highlight with configured color
                ctx.fillStyle = dynamicColors.inScaleHighlight;
                ctx.fillRect(gridStartX, y, viewportWidth - pianoKeyWidth, cellHeight);
            } else {
                // Note is out of scale - darker
                ctx.fillStyle = dynamicColors.outOfScaleHighlight;
                ctx.fillRect(gridStartX, y, viewportWidth - pianoKeyWidth, cellHeight);
            }
            // Add black key darkening on top of scale highlight
            if (isBlack) {
                ctx.fillStyle = COLORS.blackKeyLane;
                ctx.fillRect(gridStartX, y, viewportWidth - pianoKeyWidth, cellHeight);
            }
        } else if (isBlack) {
            // No scale highlight - just darken black keys
            ctx.fillStyle = COLORS.blackKeyLane;
            ctx.fillRect(gridStartX, y, viewportWidth - pianoKeyWidth, cellHeight);
        }

        // Horizontal grid line
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gridStartX, y + cellHeight);
        ctx.lineTo(viewportWidth, y + cellHeight);
        ctx.stroke();
    }

    // Draw vertical beat/measure lines
    for (let beat = startBeat; beat <= endBeat; beat += gridSize) {
        const x = gridStartX + beat * cellWidth - scrollX;

        // Determine line type
        const beatInMeasure = beat % beatsPerMeasure;
        const isMeasureLine = Math.abs(beatInMeasure) < 0.01;
        const isMainBeat = Math.abs(beat - Math.round(beat)) < 0.01;

        // For compound time (6/8, etc.), emphasize strong beats (every 1.5 beats)
        const isStrongBeat = isCompoundTime &&
            Math.abs((beat % beatsPerMeasure) % 1.5) < 0.01;

        if (isMeasureLine) {
            ctx.strokeStyle = COLORS.measureLine;
            ctx.lineWidth = 2;
        } else if (isStrongBeat || isMainBeat) {
            ctx.strokeStyle = COLORS.beatLine;
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = COLORS.gridLine;
            ctx.lineWidth = 1;
        }

        ctx.beginPath();
        ctx.moveTo(x, gridStartY);
        ctx.lineTo(x, gridStartY + keys.length * cellHeight);
        ctx.stroke();
    }

    // Draw phrase separators if multi-phrase
    if (phraseLayouts && phraseLayouts.layouts) {
        phraseLayouts.layouts.forEach((layout, index) => {
            if (index > 0) {
                const x = gridStartX + layout.startBeat * cellWidth - scrollX;

                ctx.strokeStyle = COLORS.phraseSeparator;
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(x, gridStartY);
                ctx.lineTo(x, gridStartY + keys.length * cellHeight);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });
    }
};

/**
 * Draw piano keys on the left side
 */
export const drawPianoKeys = (ctx, {
    cellHeight,
    keys,
    scrollY = 0,
    viewportHeight,
    pianoKeyWidth = 90,
    headerHeight = 32,
    getNoteName,
    activeNotes = new Set()
}) => {
    const startKeyIndex = Math.max(0, Math.floor(scrollY / cellHeight) - 1);
    const endKeyIndex = Math.min(keys.length, Math.ceil((scrollY + viewportHeight) / cellHeight) + 1);

    // Draw white keys first (background layer)
    for (let i = startKeyIndex; i < endKeyIndex; i++) {
        const pitch = keys[i];
        const y = headerHeight + i * cellHeight - scrollY;
        const isBlack = isBlackKey(pitch);
        const isActive = activeNotes.has(pitch);

        if (!isBlack) {
            // White key background
            ctx.fillStyle = isActive ? '#a78bfa' : COLORS.whiteKey;
            ctx.fillRect(0, y, pianoKeyWidth - 1, cellHeight);

            // Border
            ctx.strokeStyle = COLORS.whiteKeyBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(0, y, pianoKeyWidth - 1, cellHeight);
        }
    }

    // Draw black keys on top (thinner height for visual distinction)
    const blackKeyHeight = Math.round(cellHeight * 0.6);
    const blackKeyYOffset = Math.round((cellHeight - blackKeyHeight) / 2);
    for (let i = startKeyIndex; i < endKeyIndex; i++) {
        const pitch = keys[i];
        const y = headerHeight + i * cellHeight - scrollY;
        const isBlack = isBlackKey(pitch);
        const isActive = activeNotes.has(pitch);

        if (isBlack) {
            const blackKeyWidth = pianoKeyWidth * 0.65;

            ctx.fillStyle = isActive ? '#8b5cf6' : COLORS.blackKey;
            ctx.fillRect(0, y + blackKeyYOffset, blackKeyWidth, blackKeyHeight);

            ctx.strokeStyle = COLORS.blackKeyBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(0, y + blackKeyYOffset, blackKeyWidth, blackKeyHeight);
        }
    }

    // Draw note labels
    ctx.font = `${Math.min(12, cellHeight * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = startKeyIndex; i < endKeyIndex; i++) {
        const pitch = keys[i];
        const y = headerHeight + i * cellHeight - scrollY + cellHeight / 2;
        const isBlack = isBlackKey(pitch);
        const noteName = getNoteName ? getNoteName(pitch) : `${pitch}`;

        if (isBlack) {
            ctx.fillStyle = COLORS.keyTextBlack;
            ctx.fillText(noteName, pianoKeyWidth * 0.6, y);
        } else {
            ctx.fillStyle = COLORS.keyText;
            ctx.fillText(noteName, pianoKeyWidth - 8, y);
        }
    }
};

/**
 * Draw measure numbers in the header
 */
export const drawMeasureNumbers = (ctx, {
    cellWidth,
    beatsPerMeasure,
    totalBeats,
    scrollX = 0,
    viewportWidth,
    pianoKeyWidth = 90,
    headerHeight = 32,
    phraseLayouts = null
}) => {
    const startBeat = Math.max(0, Math.floor(scrollX / cellWidth) - beatsPerMeasure);
    const endBeat = Math.min(totalBeats, Math.ceil((scrollX + viewportWidth) / cellWidth) + beatsPerMeasure);

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let beat = 0; beat <= endBeat; beat += beatsPerMeasure) {
        if (beat < startBeat - beatsPerMeasure) continue;

        const x = pianoKeyWidth + beat * cellWidth - scrollX + (beatsPerMeasure * cellWidth / 2);
        const measureNumber = Math.floor(beat / beatsPerMeasure) + 1;

        // Determine phrase name if multi-phrase
        let phraseName = null;
        if (phraseLayouts && phraseLayouts.layouts) {
            const layout = phraseLayouts.layouts.find(l =>
                beat >= l.startBeat && beat < l.endBeat
            );
            if (layout && beat === layout.startBeat) {
                phraseName = layout.phraseName;
            }
        }

        // Draw measure number
        ctx.fillStyle = COLORS.measureNumber;
        ctx.fillText(`${measureNumber}`, x, headerHeight / 2);

        // Draw phrase name if at phrase start
        if (phraseName) {
            ctx.font = 'bold 10px system-ui, sans-serif';
            ctx.fillStyle = COLORS.measureNumberHighlight;
            ctx.fillText(phraseName, x, headerHeight / 2 + 12);
            ctx.font = 'bold 12px system-ui, sans-serif';
        }
    }
};

/**
 * Draw notes on the canvas
 * OPTIMIZED: Uses solid colors instead of per-note gradients for 10x+ performance improvement
 */
export const drawNotes = (ctx, {
    notes,
    keys,
    cellWidth,
    cellHeight,
    selectedIds,
    scrollX = 0,
    scrollY = 0,
    viewportWidth,
    viewportHeight,
    pianoKeyWidth = 90,
    headerHeight = 32,
    dragState = null
}) => {
    const gridStartX = pianoKeyWidth;
    const gridStartY = headerHeight;

    // Calculate visible range with buffer
    const visibleStartBeat = scrollX / cellWidth - 1;
    const visibleEndBeat = (scrollX + viewportWidth) / cellWidth + 1;
    const visibleStartKeyIndex = Math.floor(scrollY / cellHeight) - 1;
    const visibleEndKeyIndex = Math.ceil((scrollY + viewportHeight) / cellHeight) + 1;

    // Build pitch lookup map once (O(1) lookup instead of O(n) indexOf)
    const pitchToIndex = new Map();
    for (let i = 0; i < keys.length; i++) {
        pitchToIndex.set(keys[i], i);
    }

    // Batch similar operations together for better performance
    // First pass: draw all unselected notes
    // Second pass: draw all selected notes (on top)
    const selectedNotes = [];

    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];

        // Get note position (use global coordinates if available)
        const startTime = note.globalStartTime !== undefined ? note.globalStartTime : note.startTime;
        const endTime = startTime + note.duration;

        // Skip if not visible horizontally
        if (endTime < visibleStartBeat || startTime > visibleEndBeat) continue;

        const keyIndex = pitchToIndex.get(note.pitch);
        if (keyIndex === undefined) continue;

        // Skip if not visible vertically
        if (keyIndex < visibleStartKeyIndex || keyIndex > visibleEndKeyIndex) continue;

        // Skip if dragging this note (will be drawn in overlay)
        if (dragState && dragState.hasMoved) {
            if (dragState.isMultiDrag && selectedIds.has(note.id)) continue;
            if (dragState.noteId === note.id) continue;
        }

        const isSelected = selectedIds.has(note.id);

        if (isSelected) {
            selectedNotes.push({ note, keyIndex, startTime });
        } else {
            // Draw unselected note immediately
            const x = gridStartX + startTime * cellWidth - scrollX;
            const y = gridStartY + keyIndex * cellHeight - scrollY + 1;
            const width = note.duration * cellWidth - 2;
            const height = cellHeight - 2;

            // Use dynamic colors from service
            const noteColors = getDynamicColors();
            ctx.fillStyle = note.trackName === 'melody' ? noteColors.melodyNote : noteColors.chordsNote;
            drawRoundedRect(ctx, x, y, width, height, 4);
            ctx.fill();
        }
    }

    // Draw selected notes on top (second pass)
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;

    // Get dynamic colors once for the selected notes loop
    const selectedNoteColors = getDynamicColors();

    for (let i = 0; i < selectedNotes.length; i++) {
        const { note, keyIndex, startTime } = selectedNotes[i];

        const x = gridStartX + startTime * cellWidth - scrollX;
        const y = gridStartY + keyIndex * cellHeight - scrollY + 1;
        const width = note.duration * cellWidth - 2;
        const height = cellHeight - 2;

        // Use brighter color for selected notes
        ctx.fillStyle = note.trackName === 'melody' ? selectedNoteColors.melodyNoteSelected : selectedNoteColors.chordsNoteSelected;
        drawRoundedRect(ctx, x, y, width, height, 4);
        ctx.fill();

        // Selection border (already set above)
        ctx.stroke();

        // Resize handle (right edge)
        if (width > 10) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(x + width - 6, y + 2, 4, height - 4);
        }
    }
};

/**
 * Draw the playhead indicator
 */
export const drawPlayhead = (ctx, {
    position,
    cellWidth,
    scrollX = 0,
    viewportWidth,
    viewportHeight,
    pianoKeyWidth = 90,
    headerHeight = 32,
    isPlaying = false
}) => {
    const x = pianoKeyWidth + position * cellWidth - scrollX;

    // Skip if not visible (use viewportWidth for horizontal check)
    if (x < pianoKeyWidth || x > viewportWidth) return;

    // Playhead line
    ctx.fillStyle = isPlaying ? COLORS.playheadPlaying : COLORS.playheadStopped;
    ctx.fillRect(x - 1, headerHeight, 3, viewportHeight);

    // Triangle marker at top
    ctx.beginPath();
    ctx.moveTo(x - 8, headerHeight);
    ctx.lineTo(x + 8, headerHeight);
    ctx.lineTo(x, headerHeight + 12);
    ctx.closePath();
    ctx.fill();
};

/**
 * Draw selection rectangle
 */
export const drawSelectionRect = (ctx, {
    rect,
    scrollX = 0,
    scrollY = 0,
    pianoKeyWidth = 90,
    headerHeight = 32,
    isDeselectMode = false
}) => {
    if (!rect) return;

    const x = pianoKeyWidth + rect.x - scrollX;
    const y = headerHeight + rect.y - scrollY;
    const width = rect.width;
    const height = rect.height;

    // Fill
    ctx.fillStyle = isDeselectMode ? COLORS.deselectFill : COLORS.selectionFill;
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = isDeselectMode ? COLORS.deselectBorder : COLORS.selectionBorder;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
};

/**
 * Draw note preview (hover state)
 */
export const drawNotePreview = (ctx, {
    beat,
    pitch,
    duration,
    keys,
    cellWidth,
    cellHeight,
    scrollX = 0,
    scrollY = 0,
    pianoKeyWidth = 90,
    headerHeight = 32
}) => {
    const keyIndex = keys.indexOf(pitch);
    if (keyIndex === -1) return;

    const x = pianoKeyWidth + beat * cellWidth - scrollX;
    const y = headerHeight + keyIndex * cellHeight - scrollY + 1;
    const width = duration * cellWidth - 2;
    const height = cellHeight - 2;

    ctx.fillStyle = COLORS.notePreview;
    drawRoundedRect(ctx, x, y, width, height, 4);
    ctx.fill();

    ctx.strokeStyle = COLORS.selectionBorder;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
};

/**
 * Draw loop region indicator
 */
export const drawLoopRegion = (ctx, {
    loopStart,
    loopEnd,
    cellWidth,
    scrollX = 0,
    viewportHeight,
    pianoKeyWidth = 90,
    headerHeight = 32
}) => {
    const startX = pianoKeyWidth + loopStart * cellWidth - scrollX;
    const endX = pianoKeyWidth + loopEnd * cellWidth - scrollX;
    const width = endX - startX;

    // Background fill in note area (subtle)
    ctx.fillStyle = COLORS.loopRegionFill;
    ctx.fillRect(startX, headerHeight, width, viewportHeight);

    // Vertical border lines
    ctx.strokeStyle = COLORS.loopRegionBorder;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(startX, headerHeight);
    ctx.lineTo(startX, headerHeight + viewportHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endX, headerHeight);
    ctx.lineTo(endX, headerHeight + viewportHeight);
    ctx.stroke();

    // Header bar highlight (colored strip on measure number bar)
    ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
    ctx.fillRect(startX, 0, width, headerHeight);

    // Loop handles drawn INSIDE the header bar (measure number area)
    const handleWidth = 12;
    const handleHeight = headerHeight - 4;
    const handleY = 2;

    // Start handle (left-aligned bracket)
    ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
    drawRoundedRect(ctx, startX, handleY, handleWidth, handleHeight, 2);
    ctx.fill();
    // Arrow indicator on start handle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(startX + 3, handleY + handleHeight / 2 - 4);
    ctx.lineTo(startX + 9, handleY + handleHeight / 2);
    ctx.lineTo(startX + 3, handleY + handleHeight / 2 + 4);
    ctx.closePath();
    ctx.fill();

    // End handle (right-aligned bracket)
    ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
    drawRoundedRect(ctx, endX - handleWidth, handleY, handleWidth, handleHeight, 2);
    ctx.fill();
    // Arrow indicator on end handle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(endX - 3, handleY + handleHeight / 2 - 4);
    ctx.lineTo(endX - 9, handleY + handleHeight / 2);
    ctx.lineTo(endX - 3, handleY + handleHeight / 2 + 4);
    ctx.closePath();
    ctx.fill();
};

/**
 * Draw dragging note preview
 */
export const drawDragPreview = (ctx, {
    dragState,
    keys,
    cellWidth,
    cellHeight,
    scrollX = 0,
    scrollY = 0,
    pianoKeyWidth = 90,
    headerHeight = 32
}) => {
    if (!dragState) return;

    // Helper function to draw a single note preview
    const drawNotePreviewAt = (startTime, pitch, duration, trackName) => {
        const keyIndex = keys.indexOf(pitch);
        if (keyIndex === -1) return;

        const x = pianoKeyWidth + startTime * cellWidth - scrollX;
        const y = headerHeight + keyIndex * cellHeight - scrollY + 1;
        const width = duration * cellWidth - 2;
        const height = cellHeight - 2;

        ctx.fillStyle = trackName === 'melody' ? COLORS.melodyNote : COLORS.chordsNote;
        drawRoundedRect(ctx, x, y, width, height, 4);
        ctx.fill();

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    ctx.globalAlpha = 0.6;

    // Multi-drag: draw all notes being dragged
    if (dragState.isMultiDrag && dragState.previewUpdates) {
        dragState.previewUpdates.forEach(update => {
            drawNotePreviewAt(
                update.globalStartTime,
                update.pitch,
                update.duration,
                update.trackName
            );
        });
    }
    // Single note drag or resize
    else if (dragState.previewPosition) {
        const { previewPosition } = dragState;
        const startTime = previewPosition.globalStartTime !== undefined
            ? previewPosition.globalStartTime
            : previewPosition.startTime;
        drawNotePreviewAt(
            startTime,
            previewPosition.pitch,
            previewPosition.duration,
            previewPosition.trackName
        );
    }

    ctx.globalAlpha = 1.0;
};

/**
 * Draw recording preview notes
 */
export const drawRecordingNotes = (ctx, {
    recordingNotes,
    activeRecordingNotes,
    keys,
    cellWidth,
    cellHeight,
    scrollX = 0,
    scrollY = 0,
    pianoKeyWidth = 90,
    headerHeight = 32
}) => {
    const gridStartX = pianoKeyWidth;
    const gridStartY = headerHeight;

    // Draw completed recording notes
    recordingNotes.forEach(note => {
        const keyIndex = keys.indexOf(note.pitch);
        if (keyIndex === -1) return;

        const x = gridStartX + note.startTime * cellWidth - scrollX;
        const y = gridStartY + keyIndex * cellHeight - scrollY + 1;
        const width = note.duration * cellWidth - 2;
        const height = cellHeight - 2;

        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#22c55e'; // Green for recording
        drawRoundedRect(ctx, x, y, width, height, 4);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Draw currently held notes (extending)
    activeRecordingNotes.forEach(note => {
        const keyIndex = keys.indexOf(note.pitch);
        if (keyIndex === -1) return;

        const x = gridStartX + note.startTime * cellWidth - scrollX;
        const y = gridStartY + keyIndex * cellHeight - scrollY + 1;
        const width = note.duration * cellWidth - 2;
        const height = cellHeight - 2;

        // Pulsing effect for active notes
        const pulse = Math.sin(Date.now() / 200) * 0.1 + 0.8;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#4ade80'; // Lighter green
        drawRoundedRect(ctx, x, y, width, height, 4);
        ctx.fill();

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    });
};
