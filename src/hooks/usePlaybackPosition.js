import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../services/AudioEngine';

/**
 * Hook for tracking playback position in the piano roll
 *
 * Features:
 * - Real-time playback position tracking
 * - Converts Tone.Transport position to beats
 * - Updates at reduced framerate (20fps) for better performance
 * - Automatically detects playback start/stop
 * - Playhead always visible, can be moved even when not playing
 * - Distinguishes between actual playback and metronome-only
 */
export function usePlaybackPosition() {
    const [playbackPosition, setPlaybackPosition] = useState(0); // Position in beats
    const [isPlaying, setIsPlaying] = useState(false);
    const animationFrameRef = useRef(null);
    const lastUpdateRef = useRef(0);

    // Throttle to 20fps instead of 60fps for better performance
    const UPDATE_INTERVAL = 1000 / 20; // 50ms between updates

    useEffect(() => {
        let mounted = true;

        const updatePosition = () => {
            if (!mounted) return;

            const now = performance.now();
            const timeSinceLastUpdate = now - lastUpdateRef.current;

            // Only update if enough time has passed (throttle to 20fps)
            if (timeSinceLastUpdate >= UPDATE_INTERVAL) {
                // Check if we're actually playing music (not just metronome)
                const actuallyPlaying = audioEngine.getIsActuallyPlaying();
                setIsPlaying(actuallyPlaying);

                // Update position from Transport
                const seconds = Tone.Transport.seconds;
                const bpm = Tone.Transport.bpm.value || 120;
                const beats = (seconds * bpm) / 60;
                setPlaybackPosition(beats);

                lastUpdateRef.current = now;
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
    }, [UPDATE_INTERVAL]);

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
