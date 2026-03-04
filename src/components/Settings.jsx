import React, { useState, useRef, useEffect } from 'react';
import themeEngine from '../services/ThemeEngine';
import { StorageService } from '../services/StorageService';
import { midiInputService } from '../services/MidiInputService';
import handColorsService, { COLOR_PRESETS, SCALE_HIGHLIGHT_PRESETS } from '../services/HandColorsService';
import { MidiVisualizer } from './MidiVisualizer';
import { MidiLatencyCalibration } from './MidiLatencyCalibration';
import { useDeviceContext } from '../hooks/useDeviceContext';

export function Settings({ isOpen, onClose }) {
    const { isMobile } = useDeviceContext();
    const [activeTab, setActiveTab] = useState('theme');
    const [accentPrimary, setAccentPrimary] = useState(themeEngine.getVariable('accent-primary'));
    const [accentSecondary, setAccentSecondary] = useState(themeEngine.getVariable('accent-secondary'));
    const [fontSize, setFontSize] = useState(localStorage.getItem('piano-teacher-font-size') || '16');
    const [fontFamily, setFontFamily] = useState(localStorage.getItem('piano-teacher-font-family') || 'Inter');
    const fileInputRef = useRef(null);

    // MIDI states - initialize with current values to avoid cascade on open
    const [midiDevices, setMidiDevices] = useState(() => midiInputService.getDevices());
    const [selectedMidiDevice, setSelectedMidiDevice] = useState(() => midiInputService.getActiveDevice());
    const [midiSettings, setMidiSettings] = useState(() => midiInputService.getSettings());
    const [midiSupported, setMidiSupported] = useState(() => midiInputService.isSupported);
    const [showLatencyCalibration, setShowLatencyCalibration] = useState(false);

    // Hand colors state with listener for external changes
    const [handColors, setHandColors] = useState(() => handColorsService.getColors());

    // Subscribe to hand colors changes (for synchronization with other components)
    useEffect(() => {
        const unsubscribe = handColorsService.addListener((colors) => {
            setHandColors(colors);
        });
        return unsubscribe;
    }, []);

    // MIDI effects - refresh data when modal opens
    // This intentionally syncs external service state on modal open - the setState is necessary
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!isOpen) return;

        // Batch refresh MIDI state - these values may have changed since component mount
        const devices = midiInputService.getDevices();
        const activeDevice = midiInputService.getActiveDevice();
        const supported = midiInputService.isSupported;

        // Only update if values have changed - intentional sync from external service
        setMidiDevices(prev => JSON.stringify(prev) !== JSON.stringify(devices) ? devices : prev);
        setSelectedMidiDevice(prev => prev !== activeDevice ? activeDevice : prev);
        setMidiSupported(prev => prev !== supported ? supported : prev);

        // Listen for device changes
        const handleDevicesChanged = (devices) => {
            setMidiDevices(devices);
        };

        const handleDeviceConnected = (device) => {
            setSelectedMidiDevice(device);
        };

        const handleDeviceDisconnected = () => {
            setSelectedMidiDevice(null);
        };

        midiInputService.addEventListener('devicesChanged', handleDevicesChanged);
        midiInputService.addEventListener('deviceConnected', handleDeviceConnected);
        midiInputService.addEventListener('deviceDisconnected', handleDeviceDisconnected);

        return () => {
            midiInputService.removeEventListener('devicesChanged', handleDevicesChanged);
            midiInputService.removeEventListener('deviceConnected', handleDeviceConnected);
            midiInputService.removeEventListener('deviceDisconnected', handleDeviceDisconnected);
        };
    }, [isOpen]);
    /* eslint-enable react-hooks/set-state-in-effect */

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

    const handleExportLibrary = async () => {
        try {
            const result = await StorageService.exportLibrary();
            if (result.success && !result.cancelled) {
                const message = result.path
                    ? `✅ Bibliothèque exportée avec succès !\n${result.path}`
                    : '✅ Bibliothèque exportée avec succès !';
                alert(message);
            }
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

    // MIDI handlers
    const handleMidiDeviceSelect = (deviceId) => {
        if (deviceId === '') {
            midiInputService.disconnect();
        } else {
            midiInputService.selectDevice(deviceId);
        }
    };

    const handleMidiSettingChange = (setting, value) => {
        const newSettings = { [setting]: value };
        midiInputService.updateSettings(newSettings);
        setMidiSettings(midiInputService.getSettings());
    };

    const handleRefreshMidiDevices = () => {
        midiInputService.refreshDevices();
        setMidiDevices(midiInputService.getDevices());
    };

    const handleLatencyCalibrationComplete = (compensation) => {
        // Apply the calibrated latency compensation
        handleMidiSettingChange('latencyCompensation', compensation);
        setShowLatencyCalibration(false);
    };

    return (
        <div
            className="settings-overlay"
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
                className="settings-modal"
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

                {/* Tabs - scrollable on mobile */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: isMobile ? '0.75rem 1rem' : '1rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    overflowX: isMobile ? 'auto' : 'visible',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none'
                }}>
                    <TabButton
                        active={activeTab === 'theme'}
                        onClick={() => setActiveTab('theme')}
                        label="Thème"
                    />
                    <TabButton
                        active={activeTab === 'typography'}
                        onClick={() => setActiveTab('typography')}
                        label="Typo"
                    />
                    <TabButton
                        active={activeTab === 'library'}
                        onClick={() => setActiveTab('library')}
                        label="Biblio"
                    />
                    <TabButton
                        active={activeTab === 'midi'}
                        onClick={() => setActiveTab('midi')}
                        label={selectedMidiDevice ? 'MIDI \u25CF' : 'MIDI'}
                    />
                    <TabButton
                        active={activeTab === 'colors'}
                        onClick={() => setActiveTab('colors')}
                        label="Couleurs"
                    />
                </div>

                {/* Content */}
                <div style={{
                    padding: isMobile ? '1rem' : '2rem',
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

                    {activeTab === 'midi' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: '1rem'
                                }}>
                                    Clavier MIDI
                                </h3>

                                {!midiSupported ? (
                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)'
                                    }}>
                                        <p style={{
                                            fontSize: '0.9rem',
                                            color: 'var(--text-primary)',
                                            margin: 0
                                        }}>
                                            ❌ <strong>Web MIDI API non supportée</strong><br />
                                            Votre navigateur ne supporte pas les claviers MIDI. Essayez Chrome, Edge ou Opera.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.9rem',
                                                fontWeight: '500',
                                                color: 'var(--text-primary)',
                                                marginBottom: '0.5rem'
                                            }}>
                                                Périphérique MIDI
                                            </label>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <select
                                                    value={selectedMidiDevice?.id || ''}
                                                    onChange={(e) => handleMidiDeviceSelect(e.target.value)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.75rem',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-primary)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-md)',
                                                        fontSize: '0.9rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="">Aucun périphérique sélectionné</option>
                                                    {midiDevices.map(device => (
                                                        <option key={device.id} value={device.id}>
                                                            {device.name} {device.manufacturer ? `(${device.manufacturer})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={handleRefreshMidiDevices}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-primary)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.9rem',
                                                        fontWeight: '500'
                                                    }}
                                                    title="Actualiser la liste des périphériques"
                                                >
                                                    🔄
                                                </button>
                                            </div>
                                            {selectedMidiDevice && (
                                                <div style={{
                                                    marginTop: '0.5rem',
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'rgba(34, 197, 94, 0.1)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        backgroundColor: '#22c55e',
                                                        marginRight: '0.5rem',
                                                        animation: 'pulse 2s ease-in-out infinite',
                                                        verticalAlign: 'middle'
                                                    }} />
                                                    Connecté : <strong>{selectedMidiDevice.name}</strong>
                                                </div>
                                            )}
                                            {midiDevices.length === 0 && (
                                                <div style={{
                                                    marginTop: '0.5rem',
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'rgba(251, 191, 36, 0.1)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid rgba(251, 191, 36, 0.3)',
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    {midiInputService.isAndroid()
                                                        ? '\u26A0\uFE0F ' + midiInputService.getNoDeviceHint()
                                                        : '\u26A0\uFE0F Aucun clavier MIDI détecté. Branchez votre clavier et cliquez sur \uD83D\uDD04'
                                                    }
                                                </div>
                                            )}
                                        </div>

                                        <div style={{
                                            padding: '1rem',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            <h4 style={{
                                                fontSize: '0.95rem',
                                                fontWeight: '600',
                                                color: 'var(--text-primary)',
                                                marginBottom: '1rem'
                                            }}>
                                                ⚙️ Paramètres avancés
                                            </h4>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {/* Velocity Sensitivity */}
                                                <div>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Sensibilité de vélocité : {midiSettings.velocitySensitivity.toFixed(2)}x
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0.5"
                                                        max="2.0"
                                                        step="0.1"
                                                        value={midiSettings.velocitySensitivity}
                                                        onChange={(e) => handleMidiSettingChange('velocitySensitivity', parseFloat(e.target.value))}
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
                                                        <span>0.5x (doux)</span>
                                                        <span>1.0x (normal)</span>
                                                        <span>2.0x (fort)</span>
                                                    </div>
                                                </div>

                                                {/* Latency Compensation */}
                                                <div>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Compensation de latence : {midiSettings.latencyCompensation}ms
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="-100"
                                                        max="100"
                                                        step="5"
                                                        value={midiSettings.latencyCompensation}
                                                        onChange={(e) => handleMidiSettingChange('latencyCompensation', parseInt(e.target.value))}
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
                                                        <span>-100ms (plus tôt)</span>
                                                        <span>0ms</span>
                                                        <span>+100ms (plus tard)</span>
                                                    </div>
                                                    {!showLatencyCalibration && (
                                                        <button
                                                            onClick={() => setShowLatencyCalibration(true)}
                                                            style={{
                                                                marginTop: '0.75rem',
                                                                width: '100%',
                                                                padding: '0.5rem',
                                                                background: 'var(--accent-primary)',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: 'var(--radius-md)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '500',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.opacity = '0.9';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.opacity = '1';
                                                            }}
                                                        >
                                                            🎯 Calibration automatique
                                                        </button>
                                                    )}
                                                    {showLatencyCalibration && (
                                                        <MidiLatencyCalibration
                                                            onCalibrationComplete={handleLatencyCalibrationComplete}
                                                            onCancel={() => setShowLatencyCalibration(false)}
                                                        />
                                                    )}
                                                </div>

                                                {/* Note On Threshold */}
                                                <div>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Seuil de note minimum : {midiSettings.noteOnThreshold}
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="50"
                                                        step="1"
                                                        value={midiSettings.noteOnThreshold}
                                                        onChange={(e) => handleMidiSettingChange('noteOnThreshold', parseInt(e.target.value))}
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
                                                        <span>1 (très sensible)</span>
                                                        <span>10 (normal)</span>
                                                        <span>50 (peu sensible)</span>
                                                    </div>
                                                </div>

                                                {/* MIDI Volume */}
                                                <div>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Volume MIDI : {midiSettings.midiVolume}%
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="5"
                                                        value={midiSettings.midiVolume}
                                                        onChange={(e) => handleMidiSettingChange('midiVolume', parseInt(e.target.value))}
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
                                                        <span>0% (muet)</span>
                                                        <span>70% (recommandé)</span>
                                                        <span>100% (max)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* MIDI Visualizer */}
                                        {selectedMidiDevice && (
                                            <div>
                                                <h4 style={{
                                                    fontSize: '0.95rem',
                                                    fontWeight: '600',
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '1rem'
                                                }}>
                                                    📊 Visualisation en temps réel
                                                </h4>
                                                <MidiVisualizer compact={false} />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'colors' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: '1rem'
                                }}>
                                    Couleurs des mains
                                </h3>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '1rem'
                                }}>
                                    Personnalisez les couleurs pour chaque main (utilisées dans l'éditeur et Synthesia)
                                </p>

                                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                    {/* Main Gauche */}
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <h4 style={{
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            color: 'var(--text-primary)',
                                            marginBottom: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            <span style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: handColors.leftHand.primary
                                            }}></span>
                                            Main Gauche (MG)
                                        </h4>
                                        <ColorPicker
                                            label="Couleur principale"
                                            value={handColors.leftHand.primary}
                                            onChange={(value) => {
                                                handColorsService.setHandColors('left', { primary: value, light: value, dark: value });
                                                setHandColors(handColorsService.getColors());
                                            }}
                                        />
                                    </div>

                                    {/* Main Droite */}
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <h4 style={{
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            color: 'var(--text-primary)',
                                            marginBottom: '0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            <span style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                background: handColors.rightHand.primary
                                            }}></span>
                                            Main Droite (MD)
                                        </h4>
                                        <ColorPicker
                                            label="Couleur principale"
                                            value={handColors.rightHand.primary}
                                            onChange={(value) => {
                                                handColorsService.setHandColors('right', { primary: value, light: value, dark: value });
                                                setHandColors(handColorsService.getColors());
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Swap button */}
                                <button
                                    onClick={() => {
                                        handColorsService.swapHands();
                                        setHandColors(handColorsService.getColors());
                                    }}
                                    style={{
                                        marginTop: '1rem',
                                        padding: '0.5rem 1rem',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: '500'
                                    }}
                                >
                                    🔄 Échanger les couleurs
                                </button>
                            </div>

                            {/* Presets */}
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
                                    💡 Presets de couleurs
                                </h4>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                handColorsService.applyPreset(key);
                                                setHandColors(handColorsService.getColors());
                                            }}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-primary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <span style={{
                                                display: 'flex',
                                                gap: '2px'
                                            }}>
                                                <span style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '2px',
                                                    background: preset.leftHand.primary
                                                }}></span>
                                                <span style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '2px',
                                                    background: preset.rightHand.primary
                                                }}></span>
                                            </span>
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scale Highlighting */}
                            <div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: '1rem'
                                }}>
                                    Surbrillance de la gamme
                                </h3>
                                <p style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '1rem'
                                }}>
                                    Couleur de surbrillance des notes dans la gamme (Piano Roll)
                                </p>

                                {/* Advanced color picker for scale highlight */}
                                <ScaleHighlightColorPicker
                                    value={handColors.scaleHighlight.inScale}
                                    onChange={(newColor) => {
                                        handColorsService.setScaleHighlightColors({ inScale: newColor });
                                        setHandColors(handColorsService.getColors());
                                    }}
                                />

                                {/* Presets */}
                                <div style={{ marginTop: '1rem' }}>
                                    <p style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Presets rapides :
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {Object.entries(SCALE_HIGHLIGHT_PRESETS).map(([key, preset]) => (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    handColorsService.applyScaleHighlightPreset(key);
                                                    setHandColors(handColorsService.getColors());
                                                }}
                                                style={{
                                                    padding: '0.4rem 0.75rem',
                                                    background: 'var(--bg-secondary)',
                                                    color: 'var(--text-primary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '500',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem'
                                                }}
                                            >
                                                <span style={{
                                                    width: '14px',
                                                    height: '14px',
                                                    borderRadius: '2px',
                                                    background: preset.inScale,
                                                    border: '1px solid var(--border-color)'
                                                }}></span>
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Reset button */}
                            <button
                                onClick={() => {
                                    if (window.confirm('Voulez-vous vraiment réinitialiser les couleurs par défaut ?')) {
                                        handColorsService.resetToDefault();
                                        setHandColors(handColorsService.getColors());
                                    }
                                }}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: '500'
                                }}
                            >
                                🔄 Réinitialiser les couleurs par défaut
                            </button>
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

/**
 * Compact color picker for scale highlighting with color input and opacity slider
 */
function ScaleHighlightColorPicker({ value, onChange }) {
    // Parse current rgba value
    const parseRgba = (rgbaStr) => {
        const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] !== undefined ? parseFloat(match[4]) : 1
            };
        }
        return { r: 251, g: 191, b: 36, a: 0.15 }; // Default amber
    };

    // Convert RGB to hex
    const rgbToHex = (r, g, b) => {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    };

    // Convert hex to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 251, g: 191, b: 36 };
    };

    const rgba = parseRgba(value);
    const hex = rgbToHex(rgba.r, rgba.g, rgba.b);

    const handleColorChange = (newHex) => {
        const rgb = hexToRgb(newHex);
        const newColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgba.a})`;
        onChange(newColor);
    };

    const handleOpacityChange = (newOpacity) => {
        const newColor = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${newOpacity})`;
        onChange(newColor);
    };

    const previewColor = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Color picker row - same style as ColorPicker */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{
                    position: 'relative',
                    width: '60px',
                    height: '40px'
                }}>
                    {/* Checkerboard background for transparency preview */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 'var(--radius-md)',
                        background: 'repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%) 50% / 10px 10px',
                        border: '1px solid var(--border-color)'
                    }} />
                    {/* Color overlay */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 'var(--radius-md)',
                        background: previewColor,
                        border: '1px solid var(--border-color)'
                    }} />
                    <input
                        type="color"
                        value={hex}
                        onChange={(e) => handleColorChange(e.target.value)}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                        }}
                    />
                </div>
                <input
                    type="text"
                    value={hex}
                    onChange={(e) => handleColorChange(e.target.value)}
                    style={{
                        width: '90px',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace'
                    }}
                />
                <span style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace'
                }}>
                    {Math.round(rgba.a * 100)}%
                </span>
            </div>

            {/* Opacity slider */}
            <div>
                <label style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem'
                }}>
                    <span>Opacité</span>
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(rgba.a * 100)}
                    onChange={(e) => handleOpacityChange(parseInt(e.target.value) / 100)}
                    style={{
                        width: '100%',
                        cursor: 'pointer',
                        accentColor: 'var(--accent-primary)'
                    }}
                />
            </div>
        </div>
    );
}
