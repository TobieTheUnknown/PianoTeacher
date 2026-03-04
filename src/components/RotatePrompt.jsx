import React, { useState } from 'react';
import { useDeviceContext } from '../hooks/useDeviceContext';
import styles from './RotatePrompt.module.css';

export function RotatePrompt() {
  const { isMobile, isLandscape } = useDeviceContext();
  const [dismissed, setDismissed] = useState(false);

  // Only show on mobile portrait when not dismissed
  if (!isMobile || isLandscape || dismissed) return null;

  return (
    <div className={styles.overlay}>
      <svg className={styles.phoneIcon} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="16" y="4" width="32" height="56" rx="4" />
        <circle cx="32" cy="52" r="2" />
        <path d="M52 20l8 8-8 8" strokeWidth="2.5" />
      </svg>
      <p className={styles.message}>
        Tourne ton appareil pour une meilleure exp&#233;rience
      </p>
      <button className={styles.dismissButton} onClick={() => setDismissed(true)}>
        Continuer en portrait
      </button>
    </div>
  );
}
