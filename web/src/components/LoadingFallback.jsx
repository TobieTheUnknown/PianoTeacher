import React from 'react';

/**
 * Composants de chargement pour React.lazy Suspense
 */

/**
 * Spinner de chargement simple
 */
export function LoadingSpinner({ size = 40, color = 'var(--accent-primary)' }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `3px solid var(--bg-tertiary)`,
        borderTop: `3px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}
    />
  );
}

/**
 * Fallback complet pour page
 */
export function PageLoadingFallback({ message = 'Chargement…' }) {
  return (
    <div role="status" aria-live="polite" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      <LoadingSpinner size={48} />
      <p style={{
        fontSize: '1.125rem',
        color: 'var(--text-secondary)',
        fontWeight: '500'
      }}>
        {message}
      </p>
    </div>
  );
}

/* Animations CSS - Ajouter au style global ou dans index.css */
const animationStyles = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

`;

// Injecter les styles si pas déjà présents
if (typeof document !== 'undefined' && !document.getElementById('loading-animations')) {
  const style = document.createElement('style');
  style.id = 'loading-animations';
  style.textContent = animationStyles;
  document.head.appendChild(style);
}
