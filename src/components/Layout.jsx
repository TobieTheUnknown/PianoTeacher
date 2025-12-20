import React from 'react';

export function Layout({ children }) {
    return (
        <div className="container">
            <header style={{ padding: '2rem 0', textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{
                    fontSize: '3rem',
                    fontWeight: '800',
                    letterSpacing: '-0.05em',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: '0 0 0.5rem 0'
                }}>
                    Piano Teacher
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    Maîtrisez vos morceaux, phrase par phrase.
                </p>
            </header>

            <main>
                {children}
            </main>

            <footer style={{
                textAlign: 'center',
                padding: '4rem 0 2rem',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem'
            }}>
                <p>&copy; {new Date().getFullYear()} Piano Teacher. Fait avec passion.</p>
            </footer>
        </div>
    );
}
