import React from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Grid size and snap controls
 */
export function GridControls({
    gridSize,
    onGridSizeChange,
    snapToGrid,
    onSnapToGridChange
}) {
    const gridOptions = [
        { value: 1, label: '1/1' },
        { value: 0.5, label: '1/2' },
        { value: 0.25, label: '1/4' },
        { value: 0.125, label: '1/8' },
        { value: 0.0625, label: '1/16' },
        { value: 0.03125, label: '1/32' }
    ];

    return (
        <div className={styles.gridControls}>
            <span className={styles.toolbarLabel}>Grille</span>

            <select
                className={styles.toolbarSelect}
                value={gridSize}
                onChange={(e) => onGridSizeChange(parseFloat(e.target.value))}
                aria-label="Taille de la grille"
            >
                {gridOptions.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            <button
                className={`${styles.toolbarButton} ${snapToGrid ? styles.active : ''}`}
                onClick={() => onSnapToGridChange(!snapToGrid)}
                aria-pressed={snapToGrid}
                title={snapToGrid ? 'Désactiver magnétisme' : 'Activer magnétisme'}
            >
                🧲 Snap
            </button>
        </div>
    );
}

export default GridControls;
