import { useState, useEffect, useMemo } from 'react';

/**
 * Hook to detect device context (mobile, Android, landscape, tablet)
 * Used across the app to adapt UI for mobile/desktop
 */
export function useDeviceContext() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: landscape)').matches
      : false
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    const landscapeQuery = window.matchMedia('(orientation: landscape)');
    const handleOrientation = (e) => {
      setIsLandscape(e.matches);
    };

    window.addEventListener('resize', handleResize);
    landscapeQuery.addEventListener('change', handleOrientation);

    return () => {
      window.removeEventListener('resize', handleResize);
      landscapeQuery.removeEventListener('change', handleOrientation);
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
