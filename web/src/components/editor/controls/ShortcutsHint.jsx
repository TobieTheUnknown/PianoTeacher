import React, { useState } from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Keyboard shortcuts hint display
 */
export function ShortcutsHint({ className }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const shortcuts = [
        { key: 'Espace', action: 'Lecture/Pause' },
        { key: 'Ctrl+A', action: 'Tout sélectionner' },
        { key: 'Ctrl+C', action: 'Copier' },
        { key: 'Ctrl+X', action: 'Couper' },
        { key: 'Ctrl+V', action: 'Coller' },
        { key: 'Ctrl+D', action: 'Dupliquer' },
        { key: 'Ctrl+Z', action: 'Annuler' },
        { key: 'Ctrl+Y', action: 'Rétablir' },
        { key: 'Suppr', action: 'Supprimer' },
        { key: 'Échap', action: 'Fermer' }
    ];

    const visibleShortcuts = isExpanded ? shortcuts : shortcuts.slice(0, 3);

    return (
        <div
            className={`${styles.shortcutsHintContainer} ${className || ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label="Raccourcis clavier"
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    setIsExpanded(!isExpanded);
                }
            }}
        >
            {visibleShortcuts.map((shortcut, index) => (
                <div key={index} className={styles.shortcutItem}>
                    <span className={styles.shortcutKey}>{shortcut.key}</span>
                    <span>{shortcut.action}</span>
                </div>
            ))}

            {!isExpanded && shortcuts.length > 3 && (
                <div className={styles.shortcutItem}>
                    <span>+{shortcuts.length - 3}</span>
                </div>
            )}
        </div>
    );
}

export default ShortcutsHint;
