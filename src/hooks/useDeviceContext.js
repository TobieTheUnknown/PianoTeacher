import { useState, useEffect, useMemo } from 'react';

/**
 * Hook to detect device context (mobile, Android, landscape, tablet)
 * Used across the app to adapt UI for mobile/desktop
 */
export function useDeviceContext() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [isLandscape, setIsLandscape] = useState(() => {
    try {
      return typeof window !== 'undefined'
        ? window.matchMedia('(orientation: landscape)').matches
        : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    let landscapeQuery = null;
    const handleOrientation = (e) => {
      setIsLandscape(e.matches);
    };

    try {
      landscapeQuery = window.matchMedia('(orientation: landscape)');
      landscapeQuery.addEventListener('change', handleOrientation);
    } catch {
      // matchMedia not available (Android WebView edge case)
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (landscapeQuery) {
        try {
          landscapeQuery.removeEventListener('change', handleOrientation);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const isAndroid = useMemo(() => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.TAURI_PLATFORM === 'android') {
      return true;
    }
    if (typeof navigator !== 'undefined') {
      return /android/i.test(navigator.userAgent);
    }
    return false;
  }, []);

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;

  return { isMobile, isAndroid, isLandscape, isTablet };
}
