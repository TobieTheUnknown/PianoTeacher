import React from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Selection action buttons (copy, cut, paste, delete, duplicate, quantize)
 */
export function SelectionActions({
    selectedCount,
    totalNotesCount = 0,
    hasClipboard,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onDuplicate,
    onQuantize
}) {
    const hasSelection = selectedCount > 0;
    const hasNotes = totalNotesCount > 0;

    return (
        <div className={styles.selectionActions}>
            {hasSelection && (
                <span className={styles.selectionCount}>
                    {selectedCount} note{selectedCount > 1 ? 's' : ''}
                </span>
            )}

            <button
                className={styles.toolbarButton}
                onClick={onCopy}
                disabled={!hasSelection}
                title="Copier (Ctrl+C)"
                aria-label="Copier"
            >
                📋
            </button>

            <button
                className={styles.toolbarButton}
                onClick={onCut}
                disabled={!hasSelection}
                title="Couper (Ctrl+X)"
                aria-label="Couper"
            >
                ✂️
            </button>

            <button
                className={styles.toolbarButton}
                onClick={onPaste}
                disabled={!hasClipboard}
                title="Coller (Ctrl+V)"
                aria-label="Coller"
            >
                📥
            </button>

            <button
                className={styles.toolbarButton}
                onClick={onDuplicate}
                disabled={!hasSelection}
                title="Dupliquer (Ctrl+D)"
                aria-label="Dupliquer"
            >
                ⧉
            </button>

            <button
                className={styles.toolbarButton}
                onClick={onDelete}
                disabled={!hasSelection}
                title="Supprimer (Suppr)"
                aria-label="Supprimer"
            >
                🗑
            </button>

            <button
                className={styles.toolbarButton}
                onClick={onQuantize}
                disabled={!hasNotes}
                title={`Quantifier ${hasSelection ? selectedCount + ' note' + (selectedCount > 1 ? 's' : '') : 'toutes les notes'} (Q)`}
                aria-label="Quantifier les notes"
            >
                🎯 {hasSelection && `(${selectedCount})`}
            </button>
        </div>
    );
}

export default SelectionActions;
