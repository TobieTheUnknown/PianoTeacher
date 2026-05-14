import { useEffect, useState } from 'react';
import { audioEngine } from '../services/AudioEngine';

const PULSE_KEYFRAMES = `
@keyframes audio-loading-pulse {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.35); }
}
`;

export function AudioLoadingIndicator() {
    const [loaded, setLoaded] = useState(() => audioEngine.samplerLoaded);

    useEffect(() => {
        if (audioEngine.samplerLoaded) return;
        audioEngine.onReady(() => setLoaded(true));
    }, []);

    if (loaded) return null;

    return (
        <>
            <style>{PULSE_KEYFRAMES}</style>
            <div
                role="status"
                aria-live="polite"
                style={{
                    position: 'fixed',
                    top: 12,
                    right: 12,
                    zIndex: 9999,
                    padding: '6px 12px 6px 10px',
                    borderRadius: 999,
                    background: 'rgba(20, 20, 25, 0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: '#fff',
                    fontSize: 12,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    pointerEvents: 'none',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#7c9eff',
                        animation: 'audio-loading-pulse 1.2s ease-in-out infinite',
                    }}
                />
                <span>Chargement piano…</span>
            </div>
        </>
    );
}
