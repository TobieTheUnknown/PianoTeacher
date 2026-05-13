import React, { useState, useEffect } from 'react';

/**
 * Theme + accent + hand-color presets picker.
 *
 * Persists to localStorage and reflects choices on the <html> element via
 * data-theme / data-accent / data-hands. tokens.css then resolves the right
 * CSS variables for every component using them.
 */

const THEMES = [
    { id: 'dark',  label: 'Sombre',  preview: '#0a0c10' },
    { id: 'light', label: 'Clair',   preview: '#f7f8fa' },
];

const ACCENTS = [
    { id: 'blue',    label: 'Bleu',     swatch: '#3b82f6' },
    { id: 'violet',  label: 'Violet',   swatch: '#8b5cf6' },
    { id: 'emerald', label: 'Émeraude', swatch: '#10b981' },
    { id: 'amber',   label: 'Ambre',    swatch: '#f59e0b' },
];

const HANDS = [
    { id: 'classic', label: 'Classique', right: '#22d3ee', left: '#ec4899' },
    { id: 'ocean',   label: 'Océan',     right: '#38bdf8', left: '#f97316' },
    { id: 'forest',  label: 'Forêt',     right: '#34d399', left: '#c084fc' },
    { id: 'sunset',  label: 'Coucher',   right: '#fbbf24', left: '#f43f5e' },
    { id: 'mono',    label: 'Mono',      right: '#cbd5e1', left: '#64748b' },
];

const LS_KEY_THEME  = 'piano-teacher-design-theme';
const LS_KEY_ACCENT = 'piano-teacher-design-accent';
const LS_KEY_HANDS  = 'piano-teacher-design-hands';

function readPref(key, fallback) {
    try { return localStorage.getItem(key) || fallback; }
    catch (_) { return fallback; }
}

function writePref(key, value) {
    try { localStorage.setItem(key, value); }
    catch (_) {}
}

function applyAttr(name, value) {
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute(`data-${name}`, value);
    }
}

export function DesignAppearance() {
    const [theme, setTheme] = useState(() => readPref(LS_KEY_THEME, 'dark'));
    const [accent, setAccent] = useState(() => readPref(LS_KEY_ACCENT, 'blue'));
    const [hands, setHands] = useState(() => readPref(LS_KEY_HANDS, 'classic'));

    useEffect(() => { applyAttr('theme', theme); writePref(LS_KEY_THEME, theme); }, [theme]);
    useEffect(() => { applyAttr('accent', accent); writePref(LS_KEY_ACCENT, accent); }, [accent]);
    useEffect(() => { applyAttr('hands', hands); writePref(LS_KEY_HANDS, hands); }, [hands]);

    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionTitle>Apparence</SectionTitle>

            <PickerRow label="Thème">
                {THEMES.map((t) => (
                    <SquareSwatch
                        key={t.id}
                        label={t.label}
                        selected={theme === t.id}
                        onClick={() => setTheme(t.id)}
                        background={t.preview}
                        border={t.id === 'light' ? '1px solid rgba(0,0,0,0.1)' : 'none'}
                    />
                ))}
            </PickerRow>

            <PickerRow label="Couleur d'accent">
                {ACCENTS.map((a) => (
                    <CircleSwatch
                        key={a.id}
                        title={a.label}
                        selected={accent === a.id}
                        onClick={() => setAccent(a.id)}
                        color={a.swatch}
                    />
                ))}
            </PickerRow>

            <PickerRow label="Couleurs des mains">
                {HANDS.map((h) => (
                    <HandSwatch
                        key={h.id}
                        label={h.label}
                        selected={hands === h.id}
                        onClick={() => setHands(h.id)}
                        right={h.right}
                        left={h.left}
                    />
                ))}
            </PickerRow>
        </section>
    );
}

function SectionTitle({ children }) {
    return (
        <h3 style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
        }}>{children}</h3>
    );
}

function PickerRow({ label, children }) {
    return (
        <div>
            <div style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginBottom: 8,
                fontWeight: 500,
            }}>{label}</div>
            <div style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
            }}>{children}</div>
        </div>
    );
}

function SquareSwatch({ label, selected, onClick, background, border }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: 6,
            borderRadius: 'var(--r-md)',
            background: selected ? 'var(--accent-dim)' : 'transparent',
            border: selected ? '1px solid var(--accent)' : '1px solid transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'inherit',
        }}>
            <span style={{
                width: 40,
                height: 28,
                borderRadius: 'var(--r-sm)',
                background,
                border: border || 'none',
                display: 'block',
            }} />
            <span style={{
                fontSize: 11,
                color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: 600,
            }}>{label}</span>
        </button>
    );
}

function CircleSwatch({ title, selected, onClick, color }) {
    return (
        <button onClick={onClick} title={title} aria-label={title} style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: color,
            border: selected ? `3px solid var(--text-primary)` : '3px solid transparent',
            boxShadow: selected ? `0 0 0 1px ${color}` : 'none',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 120ms ease',
            padding: 0,
        }} />
    );
}

function HandSwatch({ label, selected, onClick, right, left }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: 6,
            borderRadius: 'var(--r-md)',
            background: selected ? 'var(--accent-dim)' : 'transparent',
            border: selected ? '1px solid var(--accent)' : '1px solid transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'inherit',
        }}>
            <span style={{
                display: 'flex',
                width: 40,
                height: 22,
                borderRadius: 'var(--r-sm)',
                overflow: 'hidden',
            }}>
                <span style={{ flex: 1, background: left }} />
                <span style={{ flex: 1, background: right }} />
            </span>
            <span style={{
                fontSize: 10,
                color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: 600,
            }}>{label}</span>
        </button>
    );
}
