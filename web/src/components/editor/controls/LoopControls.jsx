import React from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Loop playback controls
 */
export function LoopControls({
    enabled,
    onEnabledChange,
    // eslint-disable-next-line no-unused-vars
    region, // Reserved for loop region display
    // eslint-disable-next-line no-unused-vars
    onRegionChange // Reserved for loop region editing
}) {
    return (
        <div className={styles.toolbarSection}>
            <button
                className={`${styles.toolbarButton} ${enabled ? styles.active : ''}`}
                onClick={() => onEnabledChange(!enabled)}
                aria-pressed={enabled}
                aria-label={enabled ? 'Désactiver boucle' : 'Activer boucle'}
                title="Lecture en boucle"
            >
                🔁 Loop
            </button>
        </div>
    );
}

export default LoopControls;
