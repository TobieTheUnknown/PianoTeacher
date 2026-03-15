import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for zoom/pan controls on the Synthesia canvas.
 *
 * - keyRange: [firstKey, lastKey] — which piano keys are visible
 * - lookAhead: seconds of notes visible ahead (2–10)
 * - scrollOffset: vertical time offset in seconds (look ahead/behind)
 *
 * Supports pinch-to-zoom (mobile) and scroll wheel (desktop).
 */
export function useCanvasControls({ songNoteRange, isMobile, defaultKeyRange }) {
  // Key range zoom
  const [keyRange, setKeyRange] = useState(defaultKeyRange || (isMobile ? [36, 96] : [21, 108]));

  // Time zoom (lookAhead in seconds)
  const [lookAhead, setLookAhead] = useState(4);

  // Vertical scroll offset (seconds)
  const [scrollOffset, setScrollOffset] = useState(0);

  // Pinch gesture tracking
  const gestureRef = useRef({
    active: false,
    initialDistance: 0,
    initialLookAhead: 4,
    initialKeyRange: null,
    startY: 0,
    lastY: 0,
  });

  // Snap key range to song note range with padding
  const snapToSong = useCallback(() => {
    if (songNoteRange && songNoteRange[0] < songNoteRange[1]) {
      const padding = 3; // 3 semitones padding on each side
      const first = Math.max(21, songNoteRange[0] - padding);
      const last = Math.min(108, songNoteRange[1] + padding);
      setKeyRange([first, last]);
    }
  }, [songNoteRange]);

  // Zoom keyboard range in/out
  const zoomKeys = useCallback((delta) => {
    setKeyRange(([first, last]) => {
      const center = (first + last) / 2;
      const halfSpan = (last - first) / 2;
      const newHalf = Math.max(6, Math.min(44, halfSpan + delta)); // min 12 keys, max 88
      return [
        Math.max(21, Math.round(center - newHalf)),
        Math.min(108, Math.round(center + newHalf)),
      ];
    });
  }, []);

  // Zoom time in/out
  const zoomTime = useCallback((delta) => {
    setLookAhead((prev) => Math.max(1.5, Math.min(10, prev + delta)));
  }, []);

  // Scroll through notes
  const scroll = useCallback((deltaSeconds) => {
    setScrollOffset((prev) => prev + deltaSeconds);
  }, []);

  // Reset scroll
  const resetScroll = useCallback(() => {
    setScrollOffset(0);
  }, []);

  // Desktop: wheel handler
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+scroll = keyboard zoom
      zoomKeys(e.deltaY > 0 ? 2 : -2);
    } else if (e.shiftKey) {
      // Shift+scroll = time zoom
      zoomTime(e.deltaY > 0 ? 0.5 : -0.5);
    } else {
      // Normal scroll = vertical scroll through notes
      scroll(e.deltaY > 0 ? 0.5 : -0.5);
    }
  }, [zoomKeys, zoomTime, scroll]);

  // Mobile: touch handlers for pinch & drag
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      gestureRef.current = {
        active: true,
        initialDistance: Math.hypot(dx, dy),
        initialLookAhead: lookAhead,
        initialKeyRange: [...keyRange],
        startY: 0,
        lastY: 0,
        isHorizontal: Math.abs(dx) > Math.abs(dy),
      };
    } else if (e.touches.length === 1) {
      gestureRef.current.startY = e.touches[0].clientY;
      gestureRef.current.lastY = e.touches[0].clientY;
    }
  }, [lookAhead, keyRange]);

  const handleTouchMove = useCallback((e) => {
    const g = gestureRef.current;

    if (e.touches.length === 2 && g.active) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.hypot(dx, dy);
      const scale = currentDistance / g.initialDistance;

      if (g.isHorizontal) {
        // Horizontal pinch = keyboard zoom
        const origHalf = (g.initialKeyRange[1] - g.initialKeyRange[0]) / 2;
        const newHalf = Math.max(6, Math.min(44, origHalf / scale));
        const center = (g.initialKeyRange[0] + g.initialKeyRange[1]) / 2;
        setKeyRange([
          Math.max(21, Math.round(center - newHalf)),
          Math.min(108, Math.round(center + newHalf)),
        ]);
      } else {
        // Vertical pinch = time zoom
        setLookAhead(Math.max(1.5, Math.min(10, g.initialLookAhead / scale)));
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    gestureRef.current.active = false;
  }, []);

  // Attach desktop wheel listener to a container ref
  const attachToRef = useCallback((ref) => {
    const el = ref?.current;
    if (!el) return;

    el.addEventListener('wheel', handleWheel, { passive: false });
    if (isMobile) {
      el.addEventListener('touchstart', handleTouchStart, { passive: true });
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
      el.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (isMobile) {
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchmove', handleTouchMove);
        el.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, isMobile]);

  return {
    keyRange,
    setKeyRange,
    lookAhead,
    setLookAhead,
    scrollOffset,
    scroll,
    resetScroll,
    zoomKeys,
    zoomTime,
    snapToSong,
    attachToRef,
  };
}
