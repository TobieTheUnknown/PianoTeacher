import React from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Metronome controls
 */
export function MetronomeControls({
    enabled,
    onEnabledChange,
    subdivision,
    onSubdivisionChange
}) {
    return (
        <div className={styles.toolbarSection}>
            <button
                className={`${styles.toolbarButton} ${enabled ? styles.active : ''}`}
                onClick={() => onEnabledChange(!enabled)}
                aria-pressed={enabled}
                aria-label={enabled ? 'Désactiver métronome' : 'Activer métronome'}
                title="Métronome"
            >
                🎚 Metro
            </button>

            {enabled && (
                <select
                    className={styles.toolbarSelect}
                    value={subdivision}
                    onChange={(e) => onSubdivisionChange(e.target.value)}
                    aria-label="Subdivision du métronome"
                >
                    <option value="quarter">Noires</option>
                    <option value="eighth">Croches</option>
                </select>
            )}
        </div>
    );
}

export default MetronomeControls;
