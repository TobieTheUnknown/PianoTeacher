import React from 'react';
import styles from '../PianoRollEditor.module.css';

/**
 * Zoom controls for the piano roll
 */
export function ZoomControls({ zoom, onZoomChange }) {
    const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    const zoomPercent = Math.round(zoom * 100);

    const handleZoomIn = () => {
        const currentIndex = zoomLevels.findIndex(z => z >= zoom);
        if (currentIndex < zoomLevels.length - 1) {
            onZoomChange(zoomLevels[currentIndex + 1]);
        }
    };

    const handleZoomOut = () => {
        const currentIndex = zoomLevels.findIndex(z => z >= zoom);
        if (currentIndex > 0) {
            onZoomChange(zoomLevels[currentIndex - 1]);
        } else if (currentIndex === -1) {
            onZoomChange(zoomLevels[zoomLevels.length - 1]);
        }
    };

    return (
        <div className={styles.zoomControls}>
            <button
                className={styles.toolbarButton}
                onClick={handleZoomOut}
                disabled={zoom <= zoomLevels[0]}
                title="Zoom arrière"
                aria-label="Zoom arrière"
            >
                −
            </button>

            <span className={styles.zoomValue} title={`Zoom: ${zoomPercent}%`}>
                {zoomPercent}%
            </span>

            <button
                className={styles.toolbarButton}
                onClick={handleZoomIn}
                disabled={zoom >= zoomLevels[zoomLevels.length - 1]}
                title="Zoom avant"
                aria-label="Zoom avant"
            >
                +
            </button>
        </div>
    );
}

export default ZoomControls;
