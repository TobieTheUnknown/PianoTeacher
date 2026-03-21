import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import themeService from '../../../services/ThemeService';
import styles from '../PianoRollEditor.module.css';

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 40;

/**
 * Minimap for quick navigation overview
 */
export function Minimap({
    notes,
    totalBeats,
    viewportStart,
    viewportEnd,
    onNavigate
}) {
    const canvasRef = useRef(null);

    const scale = MINIMAP_WIDTH / totalBeats;

    // Get dynamic colors from ThemeService
    const handColors = useMemo(() => themeService.getColors(), []);

    // Draw minimap
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

        // Draw notes as small rectangles
        notes.forEach(note => {
            const x = (note.globalStartTime !== undefined ? note.globalStartTime : note.startTime) * scale;
            const width = Math.max(1, note.duration * scale);

            // Color based on track - melody = right hand, chords = left hand
            ctx.fillStyle = note.trackName === 'melody' ? handColors.rightHand.primary : handColors.leftHand.primary;
            ctx.fillRect(x, 0, width, MINIMAP_HEIGHT);
        });

        // Viewport indicator
        const vpStartX = viewportStart * scale;
        const vpWidth = (viewportEnd - viewportStart) * scale;

        // Viewport fill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(vpStartX, 0, vpWidth, MINIMAP_HEIGHT);

        // Viewport border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(vpStartX, 0, vpWidth, MINIMAP_HEIGHT);
    }, [notes, totalBeats, viewportStart, viewportEnd, scale, handColors]);

    // Handle click to navigate
    const handleClick = useCallback((e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const beat = x / scale;
        onNavigate(Math.max(0, Math.min(totalBeats, beat)));
    }, [scale, totalBeats, onNavigate]);

    // Handle drag to navigate
    const handleMouseDown = useCallback((e) => {
        handleClick(e);

        const handleMouseMove = (moveEvent) => {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = moveEvent.clientX - rect.left;
            const beat = x / scale;
            onNavigate(Math.max(0, Math.min(totalBeats, beat)));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [handleClick, scale, totalBeats, onNavigate]);

    return (
        <div className={styles.minimap}>
            <canvas
                ref={canvasRef}
                className={styles.minimapCanvas}
                width={MINIMAP_WIDTH}
                height={MINIMAP_HEIGHT}
                onMouseDown={handleMouseDown}
                title="Cliquez pour naviguer"
                aria-label="Minimap de navigation"
                role="slider"
                aria-valuemin={0}
                aria-valuemax={totalBeats}
                aria-valuenow={viewportStart}
            />
        </div>
    );
}

export default Minimap;
