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
export function PageLoadingFallback({ message = 'Chargement...' }) {
  return (
    <div style={{
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

/**
 * Fallback pour composant (plus petit)
 */
export function ComponentLoadingFallback({ message = 'Chargement...' }) {
  return (
    <div style={{
      padding: '3rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem'
    }}>
      <LoadingSpinner size={32} />
      <p style={{
        fontSize: '0.875rem',
        color: 'var(--text-secondary)'
      }}>
        {message}
      </p>
    </div>
  );
}

/**
 * Skeleton loader pour contenu
 */
export function SkeletonLoader({ width = '100%', height = '20px', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-elevated) 50%, var(--bg-tertiary) 75%)',
        backgroundSize: '200% 100%',
        borderRadius: 'var(--radius-sm)',
        animation: 'shimmer 1.5s infinite',
        ...style
      }}
    />
  );
}

/**
 * Skeleton pour une carte
 */
export function CardSkeleton() {
  return (
    <div style={{
      padding: '1.5rem',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)'
    }}>
      <SkeletonLoader height="24px" width="60%" style={{ marginBottom: '1rem' }} />
      <SkeletonLoader height="16px" width="40%" style={{ marginBottom: '0.75rem' }} />
      <SkeletonLoader height="16px" width="80%" style={{ marginBottom: '0.5rem' }} />
      <SkeletonLoader height="16px" width="70%" />
    </div>
  );
}

/**
 * Skeleton pour une liste
 */
export function ListSkeleton({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Fallback avec progression (optionnel)
 */
export function ProgressLoadingFallback({ progress = 0, message = 'Chargement...' }) {
  return (
    <div style={{
      padding: '3rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem'
    }}>
      <LoadingSpinner size={40} />

      <div style={{ width: '100%', maxWidth: '300px' }}>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          {message}
        </p>

        {progress > 0 && (
          <div style={{
            width: '100%',
            height: '4px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'var(--gradient-primary)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* Animations CSS - Ajouter au style global ou dans index.css */
const animationStyles = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

// Injecter les styles si pas déjà présents
if (typeof document !== 'undefined' && !document.getElementById('loading-animations')) {
  const style = document.createElement('style');
  style.id = 'loading-animations';
  style.textContent = animationStyles;
  document.head.appendChild(style);
}
