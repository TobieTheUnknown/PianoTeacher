import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook pour gérer les interactions avec la timeline
 * - Click pour se positionner
 * - Drag pour scrubbing
 * - Drag des poignées de loop
 */
export function useTimelineInteraction({
    totalDuration,
    currentTime,
    loopStart,
    loopEnd,
    onSeek,
    onLoopChange,
    isPlaying
}) {
    const timelineRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggingLoopHandle, setIsDraggingLoopHandle] = useState(null); // 'start' | 'end' | null
    const dragStartXRef = useRef(null);

    // Convertir position X en temps
    const xToTime = useCallback((x, width) => {
        const ratio = Math.max(0, Math.min(1, x / width));
        return ratio * totalDuration;
    }, [totalDuration]);

    // Convertir temps en position X
    const timeToX = useCallback((time, width) => {
        const ratio = time / totalDuration;
        return ratio * width;
    }, [totalDuration]);

    // Gérer le click sur la timeline
    const handleTimelineClick = useCallback((e) => {
        if (!timelineRef.current || isDraggingLoopHandle) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = xToTime(x, rect.width);

        onSeek(time);
    }, [xToTime, onSeek, isDraggingLoopHandle]);

    // Gérer le début du drag
    const handleMouseDown = useCallback((e, type = 'timeline') => {
        e.preventDefault();
        e.stopPropagation();

        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        dragStartXRef.current = e.clientX - rect.left;

        if (type === 'loopStart' || type === 'loopEnd') {
            setIsDraggingLoopHandle(type);
        } else {
            setIsDragging(true);
            // Seek immédiatement au point cliqué
            const time = xToTime(dragStartXRef.current, rect.width);
            onSeek(time);
        }
    }, [xToTime, onSeek]);

    // Gérer le drag
    const handleMouseMove = useCallback((e) => {
        if (!isDragging && !isDraggingLoopHandle) return;
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = xToTime(x, rect.width);

        if (isDraggingLoopHandle) {
            // Drag d'une poignée de loop
            if (isDraggingLoopHandle === 'loopStart') {
                // S'assurer que le start ne dépasse pas le end
                const newStart = Math.min(time, loopEnd || time);
                if (onLoopChange) {
                    onLoopChange({ start: newStart, end: loopEnd });
                }
            } else if (isDraggingLoopHandle === 'loopEnd') {
                // S'assurer que le end ne soit pas avant le start
                const newEnd = Math.max(time, loopStart || 0);
                if (onLoopChange) {
                    onLoopChange({ start: loopStart, end: newEnd });
                }
            }
        } else if (isDragging) {
            // Scrubbing normal
            onSeek(time);
        }
    }, [isDragging, isDraggingLoopHandle, xToTime, loopStart, loopEnd, onSeek, onLoopChange]);

    // Gérer la fin du drag
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsDraggingLoopHandle(null);
        dragStartXRef.current = null;
    }, []);

    // Ajouter les event listeners globaux pour le drag
    useEffect(() => {
        if (isDragging || isDraggingLoopHandle) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);

            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isDraggingLoopHandle, handleMouseMove, handleMouseUp]);

    // Gérer le scroll wheel
    const handleWheel = useCallback((e, beatsPerSecond) => {
        e.preventDefault();

        // ±1 mesure
        const measureDuration = 4 / beatsPerSecond;
        const delta = e.deltaY > 0 ? measureDuration : -measureDuration;
        const newTime = Math.max(0, Math.min(totalDuration, currentTime + delta));

        onSeek(newTime);
    }, [currentTime, totalDuration, onSeek]);

    return {
        timelineRef,
        isDragging,
        isDraggingLoopHandle,
        handleTimelineClick,
        handleMouseDown,
        handleWheel,
        xToTime,
        timeToX
    };
}
