import React, { useMemo } from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Playback controls (play/stop, position display)
 */
export function PlaybackControls({
    isPlaying,
    playbackPosition,
    tempo,
    onPlay,
    onStop,
    onSeek
}) {
    // Format position as bars:beats
    const formattedPosition = useMemo(() => {
        const beatsPerMeasure = 4;
        const measure = Math.floor(playbackPosition / beatsPerMeasure) + 1;
        const beat = Math.floor(playbackPosition % beatsPerMeasure) + 1;
        return `${measure}:${beat}`;
    }, [playbackPosition]);

    // Format time as mm:ss
    const formattedTime = useMemo(() => {
        const secondsPerBeat = 60 / tempo;
        const totalSeconds = playbackPosition * secondsPerBeat;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, [playbackPosition, tempo]);

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
                className={styles.positionDisplay}
                title={`Position: ${formattedPosition} (${formattedTime})`}
            >
                {formattedPosition}
            </div>
        </div>
    );
}

export default PlaybackControls;
