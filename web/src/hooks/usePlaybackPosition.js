import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from '../services/AudioEngine';

/**
 * Hook for tracking playback position in the piano roll
 *
 * Returns:
 * - playbackPosition: state value (updates only on play/stop for React renders)
 * - positionRef: ref that updates every frame (use in animation loops)
 * - isPlaying: whether audio is currently playing
 * - seek: function to jump to a beat position
 */
export function usePlaybackPosition() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const positionRef = useRef(0);
    const animationFrameRef = useRef(null);
    const wasPlayingRef = useRef(false);
    const lastStateUpdateRef = useRef(0);

    // How often to sync state for UI display (ms) - infrequent to avoid re-renders
    const STATE_SYNC_INTERVAL = 500;

    // Poll for play/stop changes at low frequency (4Hz) when idle
    // Switch to RAF (60fps) only while playing for smooth playhead
    useEffect(() => {
        let mounted = true;

        const updatePosition = () => {
            if (!mounted) return;

            const Tone = audioEngine.getTone();
            if (Tone) {
                const baseL = Tone.context.baseLatency || 0;
                const outputL = Tone.context.outputLatency || 0;
                const audioLatency = baseL + outputL + (outputL === 0 ? 0.06 : 0);
                const seconds = Math.max(0, Tone.Transport.seconds - audioLatency);
                const bpm = Tone.Transport.bpm.value || 120;
                const beats = (seconds * bpm) / 60;

                positionRef.current = beats;

                const actuallyPlaying = audioEngine.getIsActuallyPlaying();
                if (actuallyPlaying !== wasPlayingRef.current) {
                    wasPlayingRef.current = actuallyPlaying;
                    setIsPlaying(actuallyPlaying);
                    setPlaybackPosition(beats);
                }
            }

            if (wasPlayingRef.current) {
                animationFrameRef.current = requestAnimationFrame(updatePosition);
            }
        };

        // Low-frequency poll when idle, RAF when playing
        const pollInterval = setInterval(() => {
            if (!wasPlayingRef.current) {
                const actuallyPlaying = audioEngine.getIsActuallyPlaying();
                if (actuallyPlaying) {
                    // Transition to RAF loop
                    wasPlayingRef.current = true;
                    setIsPlaying(true);
                    animationFrameRef.current = requestAnimationFrame(updatePosition);
                }
            }
        }, 250);

        return () => {
            mounted = false;
            clearInterval(pollInterval);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Seek to a specific position in beats
    const seek = useCallback((beats) => {
        const Tone = audioEngine.getTone();
        if (!Tone) return;
        const bpm = Tone.Transport.bpm.value || 120;
        const seconds = (beats * 60) / bpm;
        Tone.Transport.seconds = seconds;
        positionRef.current = beats;
        setPlaybackPosition(beats);
    }, []);

    return {
        playbackPosition,
        positionRef,
        isPlaying,
        seek
    };
}
