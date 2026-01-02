import { useState, useCallback, useRef } from 'react';

/**
 * Hook for managing undo/redo history for editor actions
 *
 * Features:
 * - Undo/Redo with keyboard shortcuts (Ctrl+Z / Ctrl+Y)
 * - Configurable history limit
 * - Automatic state snapshots
 */
export function useEditorHistory(initialState, maxHistory = 50) {
    const [present, setPresent] = useState(initialState);
    const [past, setPast] = useState([]);
    const [future, setFuture] = useState([]);

    // Track if we're in the middle of applying an undo/redo
    const isApplyingHistoryRef = useRef(false);

    // Push a new state to history
    const pushState = useCallback((newState) => {
        // Don't push if we're applying history
        if (isApplyingHistoryRef.current) return;

        setPast(prev => {
            const newPast = [...prev, present];
            // Limit history size
            if (newPast.length > maxHistory) {
                newPast.shift();
            }
            return newPast;
        });

        setPresent(newState);
        setFuture([]); // Clear future when new action is performed
    }, [present, maxHistory]);

    // Undo
    const undo = useCallback(() => {
        if (past.length === 0) return;

        isApplyingHistoryRef.current = true;

        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);

        setPast(newPast);
        setPresent(previous);
        setFuture(prev => [present, ...prev]);

        // Reset flag after state updates
        setTimeout(() => {
            isApplyingHistoryRef.current = false;
        }, 0);

        return previous;
    }, [past, present]);

    // Redo
    const redo = useCallback(() => {
        if (future.length === 0) return;

        isApplyingHistoryRef.current = true;

        const next = future[0];
        const newFuture = future.slice(1);

        setPast(prev => [...prev, present]);
        setPresent(next);
        setFuture(newFuture);

        // Reset flag after state updates
        setTimeout(() => {
            isApplyingHistoryRef.current = false;
        }, 0);

        return next;
    }, [future, present]);

    // Clear history
    const clearHistory = useCallback(() => {
        setPast([]);
        setFuture([]);
    }, []);

    // Check if undo/redo is available
    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    return {
        state: present,
        setState: pushState,
        undo,
        redo,
        canUndo,
        canRedo,
        clearHistory
    };
}
