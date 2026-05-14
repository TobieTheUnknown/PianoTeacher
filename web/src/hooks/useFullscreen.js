import { useEffect, useCallback } from 'react';

/**
 * Hook to manage fullscreen mode.
 * Enters fullscreen on mount (when active=true), exits on unmount.
 * Hides Android status bar and navigation bar.
 *
 * @param {boolean} active - Whether fullscreen should be active
 */
export function useFullscreen(active) {
  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch (err) {
      // Fullscreen not available or user gesture required
      console.debug('Fullscreen request failed:', err.message);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.debug('Exit fullscreen failed:', err.message);
    }
  }, []);

  useEffect(() => {
    if (active) {
      enterFullscreen();
      return () => {
        exitFullscreen();
      };
    }
  }, [active, enterFullscreen, exitFullscreen]);

  return { enterFullscreen, exitFullscreen };
}
