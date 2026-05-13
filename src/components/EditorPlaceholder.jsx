import React from 'react';

/**
 * Editor tab placeholder for mobile.
 *
 * The real Piano Roll Editor (components/editor/PianoRollEditor) takes a
 * single Phrase, not a whole Song — so wiring it on mobile needs a phrase
 * navigator + adapted touch controls. That integration is Phase 3 of the
 * fusion plan; this placeholder ships Phase 1 (tab visibility) without it.
 */
export function EditorPlaceholder({ song, isMobile = false }) {
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
                    width: 140,
                    height: 80,
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 8,
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: 0.55,
                }}
            >
                <div style={{ position: 'absolute', top: 12, left: 8, right: 8, height: 4, background: 'var(--accent-primary)', borderRadius: 2, opacity: 0.7 }} />
                <div style={{ position: 'absolute', top: 28, left: 36, right: 8, height: 4, background: 'var(--accent-primary)', borderRadius: 2, opacity: 0.5 }} />
                <div style={{ position: 'absolute', top: 44, left: 14, width: 60, height: 4, background: 'var(--accent-primary)', borderRadius: 2, opacity: 0.6 }} />
                <div style={{ position: 'absolute', top: 60, left: 28, right: 30, height: 4, background: 'var(--accent-primary)', borderRadius: 2, opacity: 0.4 }} />
            </div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                Éditeur
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: 360, lineHeight: 1.5 }}>
                Piano Roll d'édition + enregistrement MIDI.
                <br />
                Version mobile en cours d'intégration.
            </p>
            {song?.phrases?.length > 0 && (
                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>
                    Morceau chargé&nbsp;: <strong>{song.title || 'Sans titre'}</strong>
                    {' '}·{' '}{song.phrases.length} phrase{song.phrases.length > 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}
