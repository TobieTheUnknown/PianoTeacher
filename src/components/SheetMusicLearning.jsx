import React from 'react';

/**
 * Sheet Music Learning — placeholder.
 *
 * The real implementation is a pixel-fidelity port of LearningScreen.kt
 * (Android Canvas Compose grand staff). Phase 2 of the merge will add the
 * HTML5 canvas renderer here.
 */
export function SheetMusicLearning({ song, isMobile = false }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: isMobile ? 'calc(100vh - 120px)' : '60vh',
                padding: '2rem 1.5rem',
                gap: '1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
            }}
        >
            <div
                aria-hidden="true"
                style={{
                    width: 120,
                    height: 80,
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 6,
                    background:
                        'linear-gradient(to bottom, transparent 0 18%, var(--border-color) 18% 22%, transparent 22% 38%, var(--border-color) 38% 42%, transparent 42% 58%, var(--border-color) 58% 62%, transparent 62% 78%, var(--border-color) 78% 82%, transparent 82%)',
                    opacity: 0.5,
                }}
            />
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                Partition
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: 360, lineHeight: 1.5 }}>
                Apprentissage en lecture sur portée musicale.
                <br />
                Vue en cours de portage depuis l'app Android.
            </p>
            {song && (
                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>
                    Morceau chargé&nbsp;: <strong>{song.title || 'Sans titre'}</strong>
                </p>
            )}
        </div>
    );
}
