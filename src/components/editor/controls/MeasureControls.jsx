import React from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * MeasureControls - Controls for adjusting phrase length (number of measures)
 */
export function MeasureControls({
    totalMeasures,
    phraseLength,
    onAddMeasures,
    disabled = false
}) {
    return (
        <div className={styles.toolbarSection}>
            <button
                className={styles.toolbarButton}
                onClick={() => onAddMeasures(-1)}
                disabled={disabled || phraseLength <= 1}
                title="Réduire d'une mesure"
                aria-label="Réduire d'une mesure"
            >
                −
            </button>
            <span className={styles.measureDisplay} title="Nombre total de mesures">
                {totalMeasures} mes.
            </span>
            <button
                className={styles.toolbarButton}
                onClick={() => onAddMeasures(1)}
                disabled={disabled}
                title="Ajouter une mesure"
                aria-label="Ajouter une mesure"
            >
                +
            </button>
            <button
                className={styles.toolbarButton}
                onClick={() => onAddMeasures(4)}
                disabled={disabled}
                title="Ajouter 4 mesures"
                aria-label="Ajouter 4 mesures"
            >
                +4
            </button>
        </div>
    );
}

export default MeasureControls;
