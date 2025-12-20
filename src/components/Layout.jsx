import React from 'react';

export function Layout({ children }) {
    return (
        <div className="container">
            <header style={{
                padding: '3rem 0 2rem',
                textAlign: 'center',
                marginBottom: '3rem',
                position: 'relative'
            }}>
                {/* Decorative glow effect */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '600px',
                    height: '200px',
                    background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    pointerEvents: 'none',
                    zIndex: 0
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginBottom: '1rem'
                    }}>
                        <span style={{ fontSize: '3.5rem' }}>🎹</span>
                    </div>

                    <h1 className="text-gradient" style={{
                        fontSize: '4rem',
                        fontWeight: '800',
                        letterSpacing: '-0.03em',
                        margin: '0 0 1rem 0',
                        textShadow: '0 0 40px rgba(139, 92, 246, 0.3)'
                    }}>
                        Piano Teacher
                    </h1>

                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '1.25rem',
                        fontWeight: '500',
                        maxWidth: '600px',
                        margin: '0 auto',
                        lineHeight: '1.8'
                    }}>
                        Maîtrisez vos morceaux, phrase par phrase
                    </p>

                    {/* Decorative line */}
                    <div style={{
                        width: '100px',
                        height: '3px',
                        background: 'var(--gradient-primary)',
                        margin: '1.5rem auto 0',
                        borderRadius: 'var(--radius-full)',
                        boxShadow: 'var(--shadow-glow)'
                    }} />
                </div>
            </header>

            <main style={{ minHeight: '60vh' }}>
                {children}
            </main>

            <footer style={{
                textAlign: 'center',
                padding: '4rem 0 2rem',
                marginTop: '4rem',
                borderTop: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem'
            }}>
                <p style={{ margin: 0 }}>
                    &copy; {new Date().getFullYear()} Piano Teacher · Fait avec{' '}
                    <span style={{ color: 'var(--accent-primary)' }}>♪</span> passion
                </p>
            </footer>
        </div>
    );
}
