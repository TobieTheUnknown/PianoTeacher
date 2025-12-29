import React, { useState, useRef } from 'react';
import themeEngine from '../services/ThemeEngine';
import { StorageService } from '../services/StorageService';

export function Settings({ isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState('theme');
    const [accentPrimary, setAccentPrimary] = useState(themeEngine.getVariable('accent-primary'));
    const [accentSecondary, setAccentSecondary] = useState(themeEngine.getVariable('accent-secondary'));
    const [fontSize, setFontSize] = useState(localStorage.getItem('piano-teacher-font-size') || '16');
    const [fontFamily, setFontFamily] = useState(localStorage.getItem('piano-teacher-font-family') || 'Inter');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleThemeColorChange = (variable, value) => {
        themeEngine.setVariable(variable, value);
        if (variable === 'accent-primary') setAccentPrimary(value);
        if (variable === 'accent-secondary') setAccentSecondary(value);
    };

    const handleFontSizeChange = (size) => {
        setFontSize(size);
        document.documentElement.style.fontSize = `${size}px`;
        localStorage.setItem('piano-teacher-font-size', size);
    };

    const handleFontFamilyChange = (family) => {
        setFontFamily(family);
        // Mettre à jour la variable CSS --font-family
        document.documentElement.style.setProperty('--font-family', family);
        localStorage.setItem('piano-teacher-font-family', family);
    };

    const handleExportLibrary = () => {
        try {
            StorageService.exportLibrary();
            alert('✅ Bibliothèque exportée avec succès !');
        } catch (error) {
            alert('❌ Erreur lors de l\'export : ' + error.message);
        }
    };

    const handleImportLibrary = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const merge = window.confirm('Voulez-vous fusionner avec votre bibliothèque existante ?\n\nOK = Fusionner\nAnnuler = Remplacer complètement');
                StorageService.importLibrary(data, merge);
                alert('✅ Bibliothèque importée avec succès !');
                window.location.reload(); // Reload to refresh the library
            } catch (error) {
                alert('❌ Erreur lors de l\'import : ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    const handleResetTheme = () => {
        if (window.confirm('Voulez-vous vraiment réinitialiser le thème par défaut ?')) {
            themeEngine.resetToDefault();
            setAccentPrimary(themeEngine.getVariable('accent-primary'));
            setAccentSecondary(themeEngine.getVariable('accent-secondary'));
            alert('✅ Thème réinitialisé !');
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '2rem'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-2xl)',
                    maxWidth: '700px',
                    width: '100%',
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                    }}>
                        ⚙️ Paramètres
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-md)',
                            transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '1rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)'
                }}>
                    <TabButton
                        active={activeTab === 'theme'}
                        onClick={() => setActiveTab('theme')}
                        label="🎨 Thème"
                    />
                    <TabButton
                        active={activeTab === 'typography'}
                        onClick={() => setActiveTab('typography')}
                        label="📝 Typographie"
                    />
                    <TabButton
                        active={activeTab === 'library'}
                        onClick={() => setActiveTab('library')}
                        label="📚 Bibliothèque"
                    />
                </div>

                {/* Content */}
                <div style={{
                    padding: '2rem',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    {activeTab === 'theme' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: '1rem'
                                }}>
                                    Couleurs du thème
                                </h3>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '1rem'
                                }}>
                                    Personnalisez les couleurs d'accent de l'interface
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <ColorPicker
                                        label="Couleur primaire"
                                        value={accentPrimary}
                                        onChange={(value) => handleThemeColorChange('accent-primary', value)}
                                    />
                                    <ColorPicker
                                        label="Couleur secondaire"
                                        value={accentSecondary}
                                        onChange={(value) => handleThemeColorChange('accent-secondary', value)}
                                    />
                                </div>
                            </div>

                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)'
                            }}>
                                <h4 style={{
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: '0.5rem'
                                }}>
                                    💡 Thèmes prédéfinis
                                </h4>
                                <p style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '1rem'
                                }}>
                                    Essayez ces thèmes créés spécialement pour Piano Teacher
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <PresetButton
                                        label="Midnight Blue"
                                        onClick={() => {
                                            themeEngine.applyPreset('midnight-blue');
                                            setAccentPrimary(themeEngine.getVariable('accent-primary'));
                                            setAccentSecondary(themeEngine.getVariable('accent-secondary'));
                                        }}
                                    />
                                    <PresetButton
                                        label="Forest Green"
                                        onClick={() => {
                                            themeEngine.applyPreset('forest-green');
                                            setAccentPrimary(themeEngine.getVariable('accent-primary'));
                                            setAccentSecondary(themeEngine.getVariable('accent-secondary'));
                                        }}
                                    />
                                    <PresetButton
                                        label="Rose Gold"
                                        onClick={() => {
                                            themeEngine.applyPreset('rose-gold');
                                            setAccentPrimary(themeEngine.getVariable('accent-primary'));
                                            setAccentSecondary(themeEngine.getVariable('accent-secondary'));
                                        }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleResetTheme}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    transition: 'all var(--transition-fast)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                }}
                            >
                                🔄 Réinitialiser le thème par défaut
                            </button>
                        </div>
                    )}

                    {activeTab === 'typography' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: '1rem'
                                }}>
                                    Police et taille
                                </h3>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.9rem',
                                        fontWeight: '500',
                                        color: 'var(--text-primary)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Famille de police
                                    </label>
                                    <select
                                        value={fontFamily}
                                        onChange={(e) => handleFontFamilyChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="Inter">Inter (Par défaut)</option>
                                        <option value="system-ui">System UI</option>
                                        <option value="Arial">Arial</option>
                                        <option value="Helvetica">Helvetica</option>
                                        <option value="Georgia">Georgia</option>
                                        <option value="'Times New Roman'">Times New Roman</option>
                                        <option value="'Courier New'">Courier New</option>
                                        <option value="Verdana">Verdana</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.9rem',
                                        fontWeight: '500',
                                        color: 'var(--text-primary)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Taille de base : {fontSize}px
                                    </label>
                                    <input
                                        type="range"
                                        min="12"
                                        max="20"
                                        value={fontSize}
                                        onChange={(e) => handleFontSizeChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            cursor: 'pointer',
                                            accentColor: 'var(--accent-primary)'
                                        }}
                                    />
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        marginTop: '0.25rem'
                                    }}>
                                        <span>12px</span>
                                        <span>16px (défaut)</span>
                                        <span>20px</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                padding: '1rem',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)'
                            }}>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    margin: 0,
                                    fontFamily: fontFamily
                                }}>
                                    Aperçu : Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'library' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: '1rem'
                                }}>
                                    Gestion de la bibliothèque
                                </h3>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '1.5rem'
                                }}>
                                    Sauvegardez et restaurez votre collection de morceaux
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <button
                                        onClick={handleExportLibrary}
                                        style={{
                                            padding: '1rem 1.5rem',
                                            background: 'var(--gradient-primary)',
                                            color: 'var(--bg-primary)',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'all var(--transition-fast)',
                                            boxShadow: 'var(--shadow-md)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>📥</span>
                                        Exporter la bibliothèque
                                    </button>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        onChange={handleImportLibrary}
                                        style={{ display: 'none' }}
                                    />

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            padding: '1rem 1.5rem',
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--bg-secondary)';
                                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>📤</span>
                                        Importer une bibliothèque
                                    </button>
                                </div>
                            </div>

                            <div style={{
                                padding: '1rem',
                                background: 'rgba(59, 130, 246, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                                <p style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    margin: 0,
                                    lineHeight: '1.5'
                                }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>💡 Astuce :</strong> Exportez régulièrement votre bibliothèque pour sauvegarder vos morceaux. L'import vous permettra de restaurer ou fusionner vos données.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper Components
function TabButton({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '0.5rem 1rem',
                background: active ? 'var(--bg-elevated)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: active ? '1px solid var(--border-color)' : '1px solid transparent',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: active ? '600' : '400',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
                if (!active) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                }
            }}
            onMouseLeave={(e) => {
                if (!active) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                }
            }}
        >
            {label}
        </button>
    );
}

function ColorPicker({ label, value, onChange }) {
    return (
        <div>
            <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
            }}>
                {label}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        width: '60px',
                        height: '40px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: 'transparent'
                    }}
                />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace'
                    }}
                />
            </div>
        </div>
    );
}

function PresetButton({ label, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-primary)';
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
        >
            {label}
        </button>
    );
}
