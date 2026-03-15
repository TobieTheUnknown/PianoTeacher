import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * High-performance timing hook for Synthesia mode.
 * Decouples RAF timing from React state to eliminate 60fps re-renders.
 *
 * - timeRef.current: updated every frame (NO React re-render)
 * - displayTime: React state updated at ~10Hz for UI labels only
 * - Canvas reads timeRef.current directly for smooth 60fps animation
 */
export function useSynthesiaTimer({
  playbackSpeed = 1,
  isLoopEnabled = false,
  loopConfig = null,
  beatsPerMeasure = 4,
  beatsPerSecond = 2,
  onFrame,
  onLoopReset,
}) {
  const timeRef = useRef(0);
  const startTimeRef = useRef(null);
  const pausedAtTimeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const lastDisplayUpdateRef = useRef(0);
  const lastOnFrameRef = useRef(0);

  // Store callbacks in refs so the RAF loop never restarts
  const onFrameRef = useRef(onFrame);
  const onLoopResetRef = useRef(onLoopReset);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);
  useEffect(() => { onLoopResetRef.current = onLoopReset; }, [onLoopReset]);

  // Store config in ref so RAF loop reads latest values without restarting
  const configRef = useRef({ playbackSpeed, isLoopEnabled, loopConfig, beatsPerMeasure, beatsPerSecond });
  useEffect(() => {
    configRef.current = { playbackSpeed, isLoopEnabled, loopConfig, beatsPerMeasure, beatsPerSecond };
  }, [playbackSpeed, isLoopEnabled, loopConfig, beatsPerMeasure, beatsPerSecond]);

  // Single stable RAF loop - only depends on isPlaying
  useEffect(() => {
    if (!isPlaying) return;

    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const { playbackSpeed: speed, isLoopEnabled: loop, loopConfig: lc, beatsPerMeasure: bpm, beatsPerSecond: bps } = configRef.current;
      const elapsed = ((timestamp - startTimeRef.current) / 1000) * speed;

      // Handle loop wrapping
      if (loop && lc) {
        const loopStartTime = ((lc.startMeasure - 1) * bpm) / bps;
        const loopEndTime = (lc.endMeasure * bpm) / bps;

        if (elapsed >= loopEndTime || elapsed < loopStartTime) {
          startTimeRef.current = timestamp - (loopStartTime / speed) * 1000;
          timeRef.current = loopStartTime;
          onLoopResetRef.current?.();
          setDisplayTime(loopStartTime);
          lastDisplayUpdateRef.current = timestamp;
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }
      }

      timeRef.current = elapsed;

      // Frame callback for game logic - returns true to pause (wait mode)
      const shouldPause = onFrameRef.current?.(elapsed);
      if (shouldPause) {
        pausedAtTimeRef.current = elapsed;
        setIsPlayingState(false);
        return;
      }

      // Update displayTime at ~10Hz (every 100ms) for UI labels
      if (timestamp - lastDisplayUpdateRef.current >= 100) {
        setDisplayTime(elapsed);
        lastDisplayUpdateRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const play = useCallback(() => {
    const speed = configRef.current.playbackSpeed;
    startTimeRef.current = performance.now() - (timeRef.current / speed) * 1000;
    setIsPlayingState(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlayingState(false);
    startTimeRef.current = null;
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time) => {
    const speed = configRef.current.playbackSpeed;
    timeRef.current = time;
    setDisplayTime(time);
    startTimeRef.current = performance.now() - (time / speed) * 1000;
  }, []);

  const reset = useCallback(() => {
    setIsPlayingState(false);
    timeRef.current = 0;
    setDisplayTime(0);
    startTimeRef.current = null;
    pausedAtTimeRef.current = null;
  }, []);

  const resumeAfterWait = useCallback(() => {
    if (pausedAtTimeRef.current !== null) {
      const speed = configRef.current.playbackSpeed;
      startTimeRef.current = performance.now() - (pausedAtTimeRef.current / speed) * 1000;
      pausedAtTimeRef.current = null;
      setIsPlayingState(true);
    }
  }, []);

  // Call when playback speed changes while playing to maintain position
  const syncSpeed = useCallback((newSpeed) => {
    if (startTimeRef.current) {
      startTimeRef.current = performance.now() - (timeRef.current / newSpeed) * 1000;
    }
  }, []);

  return {
    timeRef,
    displayTime,
    isPlaying,
    play,
    pause,
    togglePlay,
    seek,
    reset,
    resumeAfterWait,
    syncSpeed,
    pausedAtTimeRef,
  };
}
