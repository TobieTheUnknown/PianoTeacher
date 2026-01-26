import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for trapping focus within a container (for modal accessibility)
 * Returns focus to the previously focused element when deactivated
 */
export const useFocusTrap = (isActive, containerRef) => {
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!isActive || !containerRef?.current) {
            // Restore focus when deactivating
            if (!isActive && previousFocusRef.current) {
                previousFocusRef.current.focus();
                previousFocusRef.current = null;
            }
            return;
        }

        const container = containerRef.current;

        // Store the currently focused element
        previousFocusRef.current = document.activeElement;

        // Get all focusable elements within the container
        const getFocusableElements = () => {
            return container.querySelectorAll(
                'button:not([disabled]), ' +
                '[href], ' +
                'input:not([disabled]), ' +
                'select:not([disabled]), ' +
                'textarea:not([disabled]), ' +
                '[tabindex]:not([tabindex="-1"]):not([disabled])'
            );
        };

        const focusableElements = getFocusableElements();
        const firstElement = focusableElements[0];

        // Focus the first element
        if (firstElement) {
            firstElement.focus();
        }

        // Handle tab key to trap focus
        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;

            const focusableElements = getFocusableElements();
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                // Shift+Tab: if on first element, go to last
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                // Tab: if on last element, go to first
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }, [isActive, containerRef]);

    /**
     * Focus the first focusable element in the container
     */
    const focusFirst = useCallback(() => {
        if (!containerRef?.current) return;

        const focusable = containerRef.current.querySelector(
            'button:not([disabled]), [href], input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"]):not([disabled])'
        );

        focusable?.focus();
    }, [containerRef]);

    /**
     * Focus the last focusable element in the container
     */
    const focusLast = useCallback(() => {
        if (!containerRef?.current) return;

        const focusableElements = containerRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"]):not([disabled])'
        );

        const lastElement = focusableElements[focusableElements.length - 1];
        lastElement?.focus();
    }, [containerRef]);

    return {
        focusFirst,
        focusLast
    };
};

export default useFocusTrap;
