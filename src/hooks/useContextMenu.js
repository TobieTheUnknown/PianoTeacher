import { useState, useCallback, useEffect } from 'react';

/**
 * Hook for managing context menu state
 */
export const useContextMenu = () => {
    const [contextMenu, setContextMenu] = useState(null);

    /**
     * Show context menu at position
     */
    const showContextMenu = useCallback((x, y, context = {}) => {
        setContextMenu({ x, y, context });
    }, []);

    /**
     * Hide context menu
     */
    const hideContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    /**
     * Handle right-click event
     */
    const handleContextMenu = useCallback((e, context = {}) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, context);
    }, [showContextMenu]);

    // Close on Escape key
    useEffect(() => {
        if (!contextMenu) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                hideContextMenu();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [contextMenu, hideContextMenu]);

    // Close on click outside
    useEffect(() => {
        if (!contextMenu) return;

        const handleClick = () => {
            hideContextMenu();
        };

        // Use setTimeout to avoid closing immediately on the same click
        const timeoutId = setTimeout(() => {
            window.addEventListener('click', handleClick);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('click', handleClick);
        };
    }, [contextMenu, hideContextMenu]);

    // Close on scroll
    useEffect(() => {
        if (!contextMenu) return;

        const handleScroll = () => {
            hideContextMenu();
        };

        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [contextMenu, hideContextMenu]);

    return {
        contextMenu,
        isOpen: contextMenu !== null,
        showContextMenu,
        hideContextMenu,
        handleContextMenu
    };
};

export default useContextMenu;
