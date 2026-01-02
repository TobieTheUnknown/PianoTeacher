import { useState, useCallback, useRef } from 'react';
import { createNoteEvent } from '../models/song';

/**
 * Hook for managing note selection in the piano roll
 *
 * Features:
 * - Single click selection
 * - Multi-select (Ctrl/Cmd + click)
 * - Rectangle selection (drag on empty space)
 * - Select all
 * - Clear selection
 */
export function useNoteSelection() {
    const [selectedNoteIds, setSelectedNoteIds] = useState(new Set());
    const [selectionRect, setSelectionRect] = useState(null); // { x, y, width, height }
    const selectionStartRef = useRef(null);

    // Select a single note
    const selectNote = useCallback((noteId, additive = false) => {
        setSelectedNoteIds(prev => {
            const newSelection = new Set(additive ? prev : []);
            if (newSelection.has(noteId)) {
                newSelection.delete(noteId); // Toggle off if already selected
            } else {
                newSelection.add(noteId);
            }
            return newSelection;
        });
    }, []);

    // Select multiple notes
    const selectNotes = useCallback((noteIds, additive = false) => {
        setSelectedNoteIds(prev => {
            const newSelection = new Set(additive ? prev : []);
            noteIds.forEach(id => newSelection.add(id));
            return newSelection;
        });
    }, []);

    // Deselect note(s)
    const deselectNote = useCallback((noteId) => {
        setSelectedNoteIds(prev => {
            const newSelection = new Set(prev);
            newSelection.delete(noteId);
            return newSelection;
        });
    }, []);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedNoteIds(new Set());
    }, []);

    // Select all notes
    const selectAll = useCallback((allNoteIds) => {
        setSelectedNoteIds(new Set(allNoteIds));
    }, []);

    // Check if note is selected
    const isSelected = useCallback((noteId) => {
        return selectedNoteIds.has(noteId);
    }, [selectedNoteIds]);

    // Start rectangle selection
    const startRectSelection = useCallback((x, y) => {
        selectionStartRef.current = { x, y };
        setSelectionRect({ x, y, width: 0, height: 0 });
    }, []);

    // Update rectangle selection
    const updateRectSelection = useCallback((currentX, currentY) => {
        if (!selectionStartRef.current) return;

        const { x: startX, y: startY } = selectionStartRef.current;
        const width = currentX - startX;
        const height = currentY - startY;

        setSelectionRect({
            x: width >= 0 ? startX : currentX,
            y: height >= 0 ? startY : currentY,
            width: Math.abs(width),
            height: Math.abs(height)
        });
    }, []);

    // End rectangle selection and return selected notes
    const endRectSelection = useCallback((notes, cellWidth, cellHeight, keys, additive = false) => {
        if (!selectionRect) {
            selectionStartRef.current = null;
            return;
        }

        const { x, y, width, height } = selectionRect;

        // Find notes that intersect with the selection rectangle
        const selectedIds = notes.filter(note => {
            const noteX = note.startTime * cellWidth;
            const noteY = keys.indexOf(note.pitch) * cellHeight;
            const noteWidth = note.duration * cellWidth;
            const noteHeight = cellHeight;

            // Check rectangle intersection
            return !(
                noteX + noteWidth < x ||
                noteX > x + width ||
                noteY + noteHeight < y ||
                noteY > y + height
            );
        }).map(note => note.id);

        selectNotes(selectedIds, additive);

        // Clear rectangle
        setSelectionRect(null);
        selectionStartRef.current = null;
    }, [selectionRect, selectNotes]);

    // Cancel rectangle selection
    const cancelRectSelection = useCallback(() => {
        setSelectionRect(null);
        selectionStartRef.current = null;
    }, []);

    return {
        selectedNoteIds: Array.from(selectedNoteIds),
        selectedNoteIdsSet: selectedNoteIds,
        selectionRect,
        selectNote,
        selectNotes,
        deselectNote,
        clearSelection,
        selectAll,
        isSelected,
        startRectSelection,
        updateRectSelection,
        endRectSelection,
        cancelRectSelection
    };
}

/**
 * Hook for clipboard operations (copy, cut, paste, duplicate)
 */
export function useNoteClipboard() {
    const [clipboard, setClipboard] = useState(null);

    // Copy notes to clipboard
    const copy = useCallback((notes) => {
        if (notes.length === 0) return;

        // Find the earliest start time to use as reference point
        const minStartTime = Math.min(...notes.map(n => n.startTime));

        // Store notes with relative positions
        const clipboardData = notes.map(note => ({
            pitch: note.pitch,
            startTime: note.startTime - minStartTime, // Relative to earliest note
            duration: note.duration,
            trackName: note.trackName
        }));

        setClipboard(clipboardData);
        return clipboardData;
    }, []);

    // Cut notes (copy + mark for deletion)
    const cut = useCallback((notes) => {
        const clipboardData = copy(notes);
        return { clipboardData, noteIdsToDelete: notes.map(n => n.id) };
    }, [copy]);

    // Paste notes at a given position
    const paste = useCallback((startTime = 0, track = null) => {
        if (!clipboard) return [];

        return clipboard.map(note => ({
            ...createNoteEvent(note.pitch, startTime + note.startTime, note.duration),
            trackName: track || note.trackName
        }));
    }, [clipboard]);

    // Duplicate notes with offset
    const duplicate = useCallback((notes, offsetBeats = 0) => {
        if (notes.length === 0) return [];

        return notes.map(note => ({
            ...createNoteEvent(note.pitch, note.startTime + offsetBeats, note.duration),
            trackName: note.trackName
        }));
    }, []);

    // Check if clipboard has content
    const hasClipboard = useCallback(() => {
        return clipboard !== null && clipboard.length > 0;
    }, [clipboard]);

    return {
        copy,
        cut,
        paste,
        duplicate,
        hasClipboard,
        clipboardContent: clipboard
    };
}
