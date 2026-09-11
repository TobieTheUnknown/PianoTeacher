import React, { useState, useEffect } from 'react';
import { midiInputService } from '../services/MidiInputService';
import { audioEngine } from '../services/AudioEngine';
import { MidiVisualizer } from './MidiVisualizer';
import { MidiLatencyCalibration } from './MidiLatencyCalibration';
import { LatencyWizard } from './LatencyWizard';
import { DesignAppearance } from './DesignAppearance';
import { OnboardingService } from '../services/OnboardingService';
import { useDeviceContext } from '../hooks/useDeviceContext';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { LibrarySettingsPanel } from './settings/LibrarySettingsPanel';
import styles from './Settings.module.css';

export function Settings({ isOpen, onClose, onRestartOnboarding }) {
    const { isMobile } = useDeviceContext();
    const [activeTab, setActiveTab] = useState('general');
    const [fontSize, setFontSize] = useState(localStorage.getItem('piano-teacher-font-size') || '16');
    const [fontFamily, setFontFamily] = useState(localStorage.getItem('piano-teacher-font-family') || 'Inter');
    const modalRef = useDialogFocus({ active: isOpen, onEscape: onClose });
    const learnerProfile = OnboardingService.getPreferences();
    const learnerGoal = { read: 'Lire avec fluidité', technique: 'Renforcer ma technique', create: 'Créer et arranger' }[learnerProfile.goal] || 'Lire avec fluidité';
    const learnerLevel = { beginner: 'Je débute', intermediate: 'Je progresse', advanced: 'Je me perfectionne' }[learnerProfile.level] || 'Je débute';
    const learnerInstrument = { midi: 'Piano MIDI', acoustic: 'Piano acoustique', none: 'Sans instrument' }[learnerProfile.instrument] || 'Piano MIDI';

    // Volume
    const [volume, setVolume] = useState(() => audioEngine.getVolumePercent());

    // MIDI states - initialize with current values to avoid cascade on open
    const [midiDevices, setMidiDevices] = useState(() => midiInputService.getDevices());
    const [selectedMidiDevice, setSelectedMidiDevice] = useState(() => midiInputService.getActiveDevice());
    const [midiSettings, setMidiSettings] = useState(() => midiInputService.getSettings());
    const [midiSupported, setMidiSupported] = useState(() => midiInputService.isSupported);
    const [showLatencyCalibration, setShowLatencyCalibration] = useState(false);
    const [showAvWizard, setShowAvWizard] = useState(false);

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

    const handleFontSizeChange = (size) => {
        setFontSize(size);
        document.documentElement.style.fontSize = `${size}px`;
        localStorage.setItem('piano-teacher-font-size', size);
    };

    const handleFontFamilyChange = (family) => {
        setFontFamily(family);
        document.documentElement.style.setProperty('--font-family', family);
        localStorage.setItem('piano-teacher-font-family', family);
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
        handleMidiSettingChange('latencyCompensation', compensation);
        setShowLatencyCalibration(false);
    };

    return (
        <div
            className={`settings-overlay ${styles.overlay}`}
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
            role="presentation"
        >
            <div
                ref={modalRef}
                className={`settings-modal ${styles.modal}`}
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
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                tabIndex="-1"
            >
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 id="settings-title" style={{
                        margin: 0,
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                    }}>
                        Réglages
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Fermer les réglages"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-md)',
                            transition: 'background-color var(--transition-fast), color var(--transition-fast)'
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
                    padding: isMobile ? '0.75rem 1rem' : '1rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    overflowX: isMobile ? 'auto' : 'visible',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none'
                }}>
                    <TabButton
                        active={activeTab === 'general'}
                        onClick={() => setActiveTab('general')}
                        label="Général"
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
                </div>

                {/* Content */}
                <div style={{
                    padding: isMobile ? '1rem' : '2rem',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    {activeTab === 'general' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg, 1.5rem)' }}>
                            <DesignAppearance />

                            {/* Volume */}
                            <div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: '600',
                                    color: 'var(--text-primary)',
                                    marginBottom: 'var(--spacing-sm, 0.5rem)'
                                }}>
                                    Volume
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>{volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={volume}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value);
                                            setVolume(v);
                                            audioEngine.setVolumePercent(v);
                                        }}
                                        style={{
                                            flex: 1,
                                            cursor: 'pointer',
                                            accentColor: 'var(--accent-primary)',
                                        }}
                                    />
                                    <span style={{
                                        minWidth: '3rem',
                                        textAlign: 'right',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        color: 'var(--text-primary)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        {volume}%
                                    </span>
                                </div>
                            </div>

                            {/* Typography */}
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
                                    <label htmlFor="settings-font-family" style={{
                                        display: 'block',
                                        fontSize: '0.9rem',
                                        fontWeight: '500',
                                        color: 'var(--text-primary)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Famille de police
                                    </label>
                                    <select
                                        id="settings-font-family"
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
                                    <label htmlFor="settings-font-size" style={{
                                        display: 'block',
                                        fontSize: '0.9rem',
                                        fontWeight: '500',
                                        color: 'var(--text-primary)',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Taille de base : {fontSize}px
                                    </label>
                                    <input
                                        id="settings-font-size"
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

                                <div style={{
                                    marginTop: '1rem',
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

                            {onRestartOnboarding && (
                                <section className={styles.onboardingCard}>
                                    <span className={styles.onboardingIcon} aria-hidden="true">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z" />
                                            <path d="M4 4.5v15M9 7h7M9 11h5" />
                                        </svg>
                                    </span>
                                    <div>
                                        <h3>{learnerGoal}</h3>
                                        <p>{learnerLevel} · {learnerInstrument}. Modifiez ces repères en reparcourant l’introduction.</p>
                                    </div>
                                    <button onClick={onRestartOnboarding}>Revoir l’introduction</button>
                                </section>
                            )}
                        </div>
                    )}

                    {activeTab === 'library' && (
                        <LibrarySettingsPanel />
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
                                            <strong>Web MIDI API non supportée</strong><br />
                                            Votre navigateur ne supporte pas les claviers MIDI. Essayez Chrome, Edge ou Opera.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label htmlFor="settings-midi-device" style={{
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
                                                    id="settings-midi-device"
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
                                                    aria-label="Actualiser la liste des périphériques MIDI"
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
                                                Paramètres avancés
                                            </h4>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {/* Velocity Sensitivity */}
                                                <div>
                                                    <label htmlFor="settings-velocity" style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Sensibilité de vélocité : {midiSettings.velocitySensitivity.toFixed(2)}x
                                                    </label>
                                                    <input
                                                        id="settings-velocity"
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
                                                    <label htmlFor="settings-midi-latency" style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Compensation de latence : {midiSettings.latencyCompensation}ms
                                                    </label>
                                                    <input
                                                        id="settings-midi-latency"
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
                                                                transition: 'opacity 0.2s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.opacity = '0.9';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.opacity = '1';
                                                            }}
                                                        >
                                                            Calibration automatique
                                                        </button>
                                                    )}
                                                    {showLatencyCalibration && (
                                                        <MidiLatencyCalibration
                                                            onCalibrationComplete={handleLatencyCalibrationComplete}
                                                            onCancel={() => setShowLatencyCalibration(false)}
                                                        />
                                                    )}
                                                </div>

                                                {/* A/V latency calibration (sound vs picture) */}
                                                <div>
                                                    <div style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Synchronisation son / image (LivePlay)
                                                    </div>
                                                    <p style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-secondary)',
                                                        margin: '0 0 0.5rem',
                                                        lineHeight: 1.5
                                                    }}>
                                                        Si le son semble en retard sur les notes qui tombent
                                                        (fréquent sur Mac), calibre le décalage ici.
                                                    </p>
                                                    {!showAvWizard ? (
                                                        <button
                                                            onClick={() => setShowAvWizard(true)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem',
                                                                background: 'var(--accent-primary)',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: 'var(--radius-md)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '500'
                                                            }}
                                                        >
                                                            Calibrer le décalage son / image
                                                        </button>
                                                    ) : (
                                                        <LatencyWizard onClose={() => setShowAvWizard(false)} />
                                                    )}
                                                </div>

                                                {/* Note On Threshold */}
                                                <div>
                                                    <label htmlFor="settings-note-threshold" style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Seuil de note minimum : {midiSettings.noteOnThreshold}
                                                    </label>
                                                    <input
                                                        id="settings-note-threshold"
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
                                                    <label htmlFor="settings-midi-volume" style={{
                                                        display: 'block',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        color: 'var(--text-primary)',
                                                        marginBottom: '0.5rem'
                                                    }}>
                                                        Volume MIDI : {midiSettings.midiVolume}%
                                                    </label>
                                                    <input
                                                        id="settings-midi-volume"
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
                                                    Visualisation en temps réel
                                                </h4>
                                                <MidiVisualizer compact={false} />
                                            </div>
                                        )}
                                    </>
                                )}
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
                transition: 'background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
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
