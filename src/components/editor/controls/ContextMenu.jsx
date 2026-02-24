import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '../PianoRollEditor.module.css';

/**
 * Context menu for right-click actions
 */
export function ContextMenu({
    x,
    y,
    context,
    hasClipboard,
    onAction,
    onClose
}) {
    const menuRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position to stay within viewport
    useEffect(() => {
        if (!menuRef.current) return;

        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = x;
        let adjustedY = y;

        if (x + rect.width > viewportWidth) {
            adjustedX = viewportWidth - rect.width - 10;
        }
        if (y + rect.height > viewportHeight) {
            adjustedY = viewportHeight - rect.height - 10;
        }

        menuRef.current.style.left = `${adjustedX}px`;
        menuRef.current.style.top = `${adjustedY}px`;
    }, [x, y]);

    const isNoteContext = context?.note != null;

    const noteActions = [
        { id: 'delete', label: 'Supprimer', shortcut: 'Suppr' },
        { id: 'duplicate', label: 'Dupliquer', shortcut: 'Ctrl+D' },
        { id: 'copy', label: 'Copier', shortcut: 'Ctrl+C' },
        { id: 'cut', label: 'Couper', shortcut: 'Ctrl+X' },
        { type: 'separator' },
        { id: 'assignRight', label: 'Main droite (MD)' },
        { id: 'assignLeft', label: 'Main gauche (MG)' }
    ];

    const gridActions = [
        { id: 'paste', label: 'Coller', shortcut: 'Ctrl+V', disabled: !hasClipboard },
        { type: 'separator' },
        { id: 'selectAll', label: 'Tout sélectionner', shortcut: 'Ctrl+A' }
    ];

    const actions = isNoteContext ? noteActions : gridActions;

    return createPortal(
        <div
            ref={menuRef}
            className={styles.contextMenu}
            style={{ left: x, top: y }}
            role="menu"
            aria-label="Menu contextuel"
        >
            {actions.map((action, index) => {
                if (action.type === 'separator') {
                    return <div key={`sep-${index}`} className={styles.contextMenuSeparator} />;
                }

                return (
                    <button
                        key={action.id}
                        className={styles.contextMenuItem}
                        onClick={() => onAction(action.id)}
                        disabled={action.disabled}
                        role="menuitem"
                    >
                        <span>{action.label}</span>
                        {action.shortcut && (
                            <span className={styles.contextMenuShortcut}>{action.shortcut}</span>
                        )}
                    </button>
                );
            })}
        </div>,
        document.body
    );
}

export default ContextMenu;
