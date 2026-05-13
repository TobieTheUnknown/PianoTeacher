import { useEffect, useRef } from 'react';

/**
 * Hook to keep the screen awake during LivePlay playback.
 * Uses the Screen Wake Lock API (works in Android WebView and Chrome).
 * Automatically releases on pause/unmount.
 *
 * @param {boolean} active - Whether to keep the screen awake
 */
export function useWakeLock(active) {
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!active) {
      // Release wake lock when not active
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    // Request wake lock
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        // Wake lock request failed (e.g., low battery, tab not visible)
        console.debug('Wake lock request failed:', err.message);
      }
    };

    requestWakeLock();

    // Re-acquire wake lock when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [active]);
}
