import React from 'react';

export function Layout({ children }) {
    return (
        <div className="container">
            <header style={{
                padding: '4rem 0 3rem',
                textAlign: 'center',
                marginBottom: '3rem',
                position: 'relative'
            }}>
                {/* Animated background glow effects */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '800px',
                    height: '300px',
                    background: 'radial-gradient(ellipse, rgba(167, 139, 250, 0.25) 0%, rgba(99, 102, 241, 0.1) 40%, transparent 70%)',
                    filter: 'blur(80px)',
                    pointerEvents: 'none',
                    zIndex: 0,
                    animation: 'glow 4s ease-in-out infinite'
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* Logo/Icon with floating animation */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.5rem',
                        animation: 'float 6s ease-in-out infinite'
                    }}>
                        <div style={{
                            fontSize: '4.5rem',
                            background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            filter: 'drop-shadow(0 0 30px rgba(167, 139, 250, 0.5))'
                        }}>
                            🎹
                        </div>
                    </div>

                    {/* Main title with enhanced gradient */}
                    <h1 style={{
                        fontSize: '5rem',
                        fontWeight: '900',
                        letterSpacing: '-0.04em',
                        margin: '0 0 1.5rem 0',
                        background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 30%, #6366f1 60%, #ec4899 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textShadow: 'none',
                        position: 'relative',
                        display: 'inline-block',
                        backgroundSize: '200% auto',
                        animation: 'fadeInScale 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        Piano Teacher
                    </h1>

                    {/* Subtitle with improved styling */}
                    <p style={{
                        color: 'var(--text-secondary)',
                        fontSize: '1.375rem',
                        fontWeight: '500',
                        maxWidth: '700px',
                        margin: '0 auto 2rem',
                        lineHeight: '1.8',
                        letterSpacing: '0.01em',
                        animation: 'fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s backwards'
                    }}>
                        Maîtrisez vos morceaux, phrase par phrase
                    </p>

                    {/* Premium decorative line */}
                    <div style={{
                        position: 'relative',
                        height: '4px',
                        width: '150px',
                        margin: '0 auto',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--gradient-primary)',
                        boxShadow: 'var(--shadow-glow-sm)',
                        animation: 'fadeInScale 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.4s backwards'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '200px',
                            height: '40px',
                            background: 'radial-gradient(ellipse, rgba(167, 139, 250, 0.3) 0%, transparent 70%)',
                            filter: 'blur(20px)',
                            pointerEvents: 'none'
                        }} />
                    </div>
                </div>
            </header>

            <main style={{
                minHeight: '60vh',
                animation: 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s backwards'
            }}>
                {children}
            </main>

            <footer style={{
                textAlign: 'center',
                padding: '5rem 0 3rem',
                marginTop: '6rem',
                borderTop: '1.5px solid var(--border-light)',
                color: 'var(--text-tertiary)',
                fontSize: '0.9375rem',
                background: 'linear-gradient(180deg, transparent 0%, rgba(167, 139, 250, 0.02) 100%)',
                position: 'relative'
            }}>
                {/* Footer glow */}
                <div style={{
                    position: 'absolute',
                    top: '-100px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '600px',
                    height: '150px',
                    background: 'radial-gradient(ellipse, rgba(167, 139, 250, 0.08) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    pointerEvents: 'none'
                }} />

                <div style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <p style={{
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: '500'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>©</span>
                        {new Date().getFullYear()} Piano Teacher
                        <span style={{
                            color: 'var(--accent-primary)',
                            fontSize: '1.2rem',
                            animation: 'float 3s ease-in-out infinite'
                        }}>♪</span>
                    </p>
                    <p style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        color: 'var(--text-muted)'
                    }}>
                        Fait avec passion et dévouement
                    </p>
                </div>
            </footer>
        </div>
    );
}
