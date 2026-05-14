import React, { useRef, useEffect } from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Playback controls (play/stop, position display)
 * Position display updates via DOM manipulation to avoid React re-renders
 */
export function PlaybackControls({
    isPlaying,
    positionRef,
    tempo,
    onPlay,
    onStop,
    onSeek
}) {
    const displayRef = useRef(null);

    // Update position display directly via DOM (no React re-renders)
    useEffect(() => {
        if (!isPlaying || !positionRef) return;
        let rafId;
        const update = () => {
            if (displayRef.current) {
                const pos = positionRef.current;
                const measure = Math.floor(pos / 4) + 1;
                const beat = Math.floor(pos % 4) + 1;
                displayRef.current.textContent = `${measure}:${beat}`;
            }
            rafId = requestAnimationFrame(update);
        };
        rafId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(rafId);
    }, [isPlaying, positionRef]);

    return (
        <div className={styles.playbackControls}>
            <button
                className={`${styles.playButton} ${isPlaying ? styles.playing : ''}`}
                onClick={isPlaying ? onStop : onPlay}
                title={isPlaying ? 'Arrêter (Espace)' : 'Lecture (Espace)'}
                aria-label={isPlaying ? 'Arrêter' : 'Lecture'}
            >
                {isPlaying ? '⏹' : '▶'}
            </button>

            <button
                className={styles.toolbarButton}
                onClick={() => onSeek(0)}
                title="Retour au début"
                aria-label="Retour au début"
            >
                ⏮
            </button>

            <div
                ref={displayRef}
                className={styles.positionDisplay}
                title="Position"
            >
                1:1
            </div>
        </div>
    );
}

export default PlaybackControls;
