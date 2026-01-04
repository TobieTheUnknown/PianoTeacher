import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';

/**
 * Hook for tracking playback position in the piano roll
 *
 * Features:
 * - Real-time playback position tracking
 * - Converts Tone.Transport position to beats
 * - Updates smoothly using requestAnimationFrame
 * - Automatically detects playback start/stop
 * - Playhead always visible, can be moved even when not playing
 */
export function usePlaybackPosition() {
    const [playbackPosition, setPlaybackPosition] = useState(0); // Position in beats
    const [isPlaying, setIsPlaying] = useState(false);
    const animationFrameRef = useRef(null);
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        let mounted = true;

        const updatePosition = () => {
            if (!mounted) return;

            // Check if transport is actually playing
            const transportPlaying = Tone.Transport.state === 'started';
            setIsPlaying(transportPlaying);

            if (transportPlaying) {
                // Get current position in seconds
                const seconds = Tone.Transport.seconds;

                // Convert to beats based on current BPM
                const bpm = Tone.Transport.bpm.value;
                const beats = (seconds * bpm) / 60;

                setPlaybackPosition(beats);
                lastUpdateRef.current = performance.now();
            } else {
                // Keep position when stopped (don't reset to 0)
                // This allows the playhead to remain visible
                const seconds = Tone.Transport.seconds;
                const bpm = Tone.Transport.bpm.value || 120;
                const beats = (seconds * bpm) / 60;
                setPlaybackPosition(beats);
            }

            // Continue animation loop
            animationFrameRef.current = requestAnimationFrame(updatePosition);
        };

        // Start the animation loop
        animationFrameRef.current = requestAnimationFrame(updatePosition);

        return () => {
            mounted = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Seek to a specific position in beats
    const seek = useCallback((beats) => {
        const bpm = Tone.Transport.bpm.value || 120;
        const seconds = (beats * 60) / bpm;
        Tone.Transport.seconds = seconds;
        setPlaybackPosition(beats);
    }, []);

    return {
        playbackPosition,
        isPlaying,
        seek
    };
}
