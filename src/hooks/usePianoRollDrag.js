import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing drag operations in the piano roll
 * Handles both note moving and resizing with throttled updates
 */
export const usePianoRollDrag = ({
    notes,
    keys,
    cellWidth,
    cellHeight,
    gridSize,
    snapToGrid,
    selectedNoteIds,
    phraseLayouts = null,
    // eslint-disable-next-line no-unused-vars
    onUpdateNote // Reserved for direct updates (currently handled externally)
}) => {
    const [dragState, setDragState] = useState(null);
    const dragThrottleRef = useRef(null);
    const originalPositionsRef = useRef(new Map());

    /**
     * Snap a value to the nearest grid position
     */
    const snapValue = useCallback((value) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    }, [snapToGrid, gridSize]);

    /**
     * Get phrase info at a given global beat
     */
    const getPhraseAtBeat = useCallback((globalBeat) => {
        if (!phraseLayouts?.layouts) return null;

        const layout = phraseLayouts.layouts.find(
            l => globalBeat >= l.startBeat && globalBeat < l.endBeat
        );

        return layout || null;
    }, [phraseLayouts]);

    /**
     * Start a drag operation
     */
    // eslint-disable-next-line no-unused-vars
    const startDrag = useCallback((note, type, startX, startY, _event) => {
        const isMultiDrag = selectedNoteIds.has(note.id) && selectedNoteIds.size > 1;

        // Store original positions for all selected notes
        if (isMultiDrag) {
            const originalPositions = new Map();
            notes
                .filter(n => selectedNoteIds.has(n.id))
                .forEach(n => {
                    originalPositions.set(n.id, {
                        localStartTime: n.localStartTime || n.startTime,
                        globalStartTime: n.globalStartTime || n.startTime,
                        pitch: n.pitch,
                        duration: n.duration,
                        phraseId: n.phraseId,
                        trackName: n.trackName
                    });
                });
            originalPositionsRef.current = originalPositions;
        } else {
            originalPositionsRef.current = new Map([
                [note.id, {
                    localStartTime: note.localStartTime || note.startTime,
                    globalStartTime: note.globalStartTime || note.startTime,
                    pitch: note.pitch,
                    duration: note.duration,
                    phraseId: note.phraseId,
                    trackName: note.trackName
                }]
            ]);
        }

        setDragState({
            type,
            noteId: note.id,
            note,
            startX,
            startY,
            isMultiDrag,
            hasMoved: false,
            lastDeltaX: 0,
            lastDeltaY: 0
        });
    }, [notes, selectedNoteIds]);

    /**
     * Update during drag with throttling
     */
    const updateDrag = useCallback((currentX, currentY) => {
        if (!dragState) return;

        const deltaX = currentX - dragState.startX;
        const deltaY = currentY - dragState.startY;

        // Check if moved significantly
        const hasMoved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;

        if (!hasMoved && !dragState.hasMoved) return;

        // Throttle to 60fps
        const now = Date.now();
        if (dragThrottleRef.current && now - dragThrottleRef.current < 16) {
            return;
        }
        dragThrottleRef.current = now;

        const deltaBeats = deltaX / cellWidth;
        const deltaPitch = Math.round(deltaY / cellHeight);

        if (dragState.type === 'resize') {
            // Resize operation - only change duration
            const originalNote = originalPositionsRef.current.get(dragState.noteId);
            if (!originalNote) return;

            const newDuration = Math.max(gridSize, snapValue(originalNote.duration + deltaBeats));

            setDragState(prev => ({
                ...prev,
                hasMoved: true,
                previewDuration: newDuration
            }));
        } else {
            // Move operation
            const updates = [];

            originalPositionsRef.current.forEach((original, noteId) => {
                let newStartTime = original.globalStartTime + deltaBeats;
                if (snapToGrid) {
                    newStartTime = snapValue(newStartTime);
                }
                newStartTime = Math.max(0, newStartTime);

                // Calculate new pitch
                const originalKeyIndex = keys.indexOf(original.pitch);
                const newKeyIndex = Math.max(0, Math.min(keys.length - 1, originalKeyIndex + deltaPitch));
                const newPitch = keys[newKeyIndex];

                // Determine phrase for new position
                let localStartTime = newStartTime;
                let phraseId = original.phraseId;

                const layout = getPhraseAtBeat(newStartTime);
                if (layout) {
                    phraseId = layout.phraseId;
                    localStartTime = newStartTime - layout.startBeat;
                }

                updates.push({
                    noteId,
                    globalStartTime: newStartTime,
                    localStartTime,
                    pitch: newPitch,
                    phraseId
                });
            });

            setDragState(prev => ({
                ...prev,
                hasMoved: true,
                previewUpdates: updates
            }));
        }
    }, [dragState, cellWidth, cellHeight, keys, gridSize, snapValue, snapToGrid, getPhraseAtBeat]);

    /**
     * End drag operation
     */
    const endDrag = useCallback(() => {
        if (!dragState) return { cancelled: true };

        const result = {
            type: dragState.type,
            noteId: dragState.noteId,
            hasMoved: dragState.hasMoved,
            isMultiDrag: dragState.isMultiDrag,
            cancelled: false
        };

        if (dragState.hasMoved) {
            if (dragState.type === 'resize') {
                result.updates = [{
                    noteId: dragState.noteId,
                    duration: dragState.previewDuration
                }];
            } else {
                result.updates = dragState.previewUpdates || [];
            }
        }

        setDragState(null);
        originalPositionsRef.current.clear();
        dragThrottleRef.current = null;

        return result;
    }, [dragState]);

    /**
     * Cancel drag operation
     */
    const cancelDrag = useCallback(() => {
        setDragState(null);
        originalPositionsRef.current.clear();
        dragThrottleRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            dragThrottleRef.current = null;
        };
    }, []);

    return {
        dragState,
        isDragging: dragState !== null,
        startDrag,
        updateDrag,
        endDrag,
        cancelDrag
    };
};

export default usePianoRollDrag;
