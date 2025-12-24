import React, { useState, useEffect } from 'react';
import ThemeEngine from '../services/ThemeEngine';

export function ThemePicker() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState('default');
    const [showImport, setShowImport] = useState(false);

    const presets = {
        'default': {
            name: 'Piano Teacher',
            description: 'Thème violet par défaut',
            colors: ['#a78bfa', '#818cf8', '#6366f1']
        },
        'midnight-blue': {
            name: 'Midnight Blue',
            description: 'Bleu profond mystérieux',
            colors: ['#5b7fff', '#4169e1', '#1e90ff']
        },
        'forest-green': {
            name: 'Forest Green',
            description: 'Vert naturel apaisant',
            colors: ['#4ecb7f', '#3cb371', '#2e8b57']
        },
        'rose-gold': {
            name: 'Rose Gold',
            description: 'Rose doré chaleureux',
            colors: ['#e88ab0', '#d4739f', '#c2608e']
        }
    };

    useEffect(() => {
        // Détecter le thème actuel au chargement
        const accentPrimary = getComputedStyle(document.documentElement)
            .getPropertyValue('--accent-primary').trim();

        // Essayer de matcher avec les presets
        if (accentPrimary === '#5b7fff') setCurrentTheme('midnight-blue');
        else if (accentPrimary === '#4ecb7f') setCurrentTheme('forest-green');
        else if (accentPrimary === '#e88ab0') setCurrentTheme('rose-gold');
        else setCurrentTheme('default');
    }, []);

    const handleThemeChange = (presetName) => {
        if (presetName === 'default') {
            ThemeEngine.resetToDefault();
        } else {
            ThemeEngine.applyPreset(presetName);
        }
        setCurrentTheme(presetName);
    };

    const handleImportTheme = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        ThemeEngine.importTheme(file)
            .then((themeData) => {
                alert(`Thème "${themeData.name}" importé avec succès !`);
                setCurrentTheme('custom');
                setShowImport(false);
            })
            .catch((error) => {
                alert('Erreur lors de l\'import du thème');
                console.error(error);
            });
    };

    const handleExportTheme = () => {
        const themeName = prompt('Nom du thème à exporter:', 'Mon Thème');
        if (themeName) {
            ThemeEngine.exportTheme(themeName);
        }
    };

    const handleLoadFromURL = async (presetName) => {
        try {
            await ThemeEngine.loadThemeFromURL(`/themes/${presetName}.json`);
            setCurrentTheme(presetName);
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
        }
    };

    return (
        <>
            {/* Bouton Flottant */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'var(--gradient-primary)',
                    border: 'none',
                    boxShadow: 'var(--shadow-glow), var(--shadow-xl)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    transition: 'all var(--transition-normal)',
                    zIndex: 1000,
                    color: 'white'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-glow-lg)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-glow), var(--shadow-xl)';
                }}
                title="Changer de thème"
            >
                🎨
            </button>

            {/* Panneau des Thèmes */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '6rem',
                        right: '2rem',
                        width: '360px',
                        maxHeight: '600px',
                        background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
                        border: '1.5px solid var(--border-accent)',
                        borderRadius: 'var(--radius-2xl)',
                        padding: '1.5rem',
                        boxShadow: 'var(--shadow-2xl), var(--shadow-glow)',
                        backdropFilter: 'blur(20px)',
                        zIndex: 999,
                        animation: 'fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflowY: 'auto'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1.5rem',
                        paddingBottom: '1rem',
                        borderBottom: '1.5px solid var(--border-light)'
                    }}>
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            background: 'var(--gradient-primary)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            Thèmes
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '1.25rem',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                color: 'var(--text-secondary)',
                                transition: 'all var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text-primary)';
                                e.currentTarget.style.transform = 'rotate(90deg)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.transform = 'rotate(0deg)';
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Thèmes Prédéfinis */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {Object.entries(presets).map(([key, theme]) => (
                            <div
                                key={key}
                                onClick={() => handleThemeChange(key)}
                                style={{
                                    padding: '1rem',
                                    background: currentTheme === key
                                        ? 'var(--glass-bg-strong)'
                                        : 'var(--glass-bg)',
                                    border: currentTheme === key
                                        ? '2px solid var(--accent-primary)'
                                        : '1.5px solid var(--border-light)',
                                    borderRadius: 'var(--radius-lg)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-normal)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => {
                                    if (currentTheme !== key) {
                                        e.currentTarget.style.borderColor = 'var(--border-accent)';
                                        e.currentTarget.style.transform = 'translateX(4px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentTheme !== key) {
                                        e.currentTarget.style.borderColor = 'var(--border-light)';
                                        e.currentTarget.style.transform = 'translateX(0)';
                                    }
                                }}
                            >
                                {/* Badge "Actif" */}
                                {currentTheme === key && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.5rem',
                                        background: 'var(--gradient-primary)',
                                        color: 'white',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: '600'
                                    }}>
                                        ✓
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {/* Palette de couleurs */}
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        {theme.colors.map((color, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    background: color,
                                                    border: '2px solid var(--bg-card)',
                                                    boxShadow: `0 2px 8px ${color}40`
                                                }}
                                            />
                                        ))}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: '0.9375rem',
                                            fontWeight: '600',
                                            color: 'var(--text-primary)',
                                            marginBottom: '0.125rem'
                                        }}>
                                            {theme.name}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-tertiary)'
                                        }}>
                                            {theme.description}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        paddingTop: '1rem',
                        borderTop: '1.5px solid var(--border-light)'
                    }}>
                        {/* Bouton Import */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImportTheme}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0,
                                    cursor: 'pointer',
                                    zIndex: 10
                                }}
                            />
                            <button
                                style={{
                                    width: '100%',
                                    padding: '0.625rem 1rem',
                                    background: 'var(--bg-elevated)',
                                    border: '1.5px solid var(--border-light)',
                                    borderRadius: 'var(--radius-lg)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all var(--transition-normal)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-accent)';
                                    e.currentTarget.style.background = 'var(--glass-bg-strong)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-light)';
                                    e.currentTarget.style.background = 'var(--bg-elevated)';
                                }}
                            >
                                <span>📥</span>
                                <span>Importer un thème</span>
                            </button>
                        </div>

                        {/* Bouton Export */}
                        <button
                            onClick={handleExportTheme}
                            style={{
                                width: '100%',
                                padding: '0.625rem 1rem',
                                background: 'var(--bg-elevated)',
                                border: '1.5px solid var(--border-light)',
                                borderRadius: 'var(--radius-lg)',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'all var(--transition-normal)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-accent)';
                                e.currentTarget.style.background = 'var(--glass-bg-strong)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-light)';
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                            }}
                        >
                            <span>📤</span>
                            <span>Exporter le thème actuel</span>
                        </button>
                    </div>

                    {/* Note */}
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        background: 'var(--glass-bg)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        lineHeight: '1.4'
                    }}>
                        💡 <strong>Astuce :</strong> Utilisez F12 puis <code>ThemeEngine.help()</code> pour plus d'options
                    </div>
                </div>
            )}

            {/* Overlay pour fermer */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 998,
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                />
            )}
        </>
    );
}
