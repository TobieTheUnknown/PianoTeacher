import React from 'react';
import { ThemePicker } from './ThemePicker';

export function Layout({ children }) {
    return (
        <div className="container">
            <ThemePicker />
            <header style={{
                padding: '2rem 0 1.5rem',
                textAlign: 'center',
                marginBottom: '1.5rem',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '200',
                    letterSpacing: '-0.03em',
                    margin: '0 0 0.75rem 0',
                    color: 'var(--text-primary)'
                }}>
                    Piano Teacher
                </h1>

                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '1rem',
                    fontWeight: '300',
                    maxWidth: '600px',
                    margin: '0 auto',
                    lineHeight: '1.6',
                    letterSpacing: '0.02em'
                }}>
                    Maîtrisez vos morceaux, phrase par phrase
                </p>
            </header>

            <main style={{
                minHeight: '60vh'
            }}>
                {children}
            </main>

            <footer style={{
                textAlign: 'center',
                padding: '3rem 0 2rem',
                marginTop: '4rem',
                borderTop: '1px solid var(--border-color)',
                color: 'var(--text-tertiary)',
                fontSize: '0.875rem',
                fontWeight: '300'
            }}>
                <p style={{ margin: 0 }}>
                    © {new Date().getFullYear()} Piano Teacher
                </p>
            </footer>
        </div>
    );
}
