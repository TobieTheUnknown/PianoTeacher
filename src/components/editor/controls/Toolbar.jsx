import React from 'react';
import { ZoomControls } from './ZoomControls';
import { GridControls } from './GridControls';
import { PlaybackControls } from './PlaybackControls';
import { MetronomeControls } from './MetronomeControls';
import { LoopControls } from './LoopControls';
import { SelectionActions } from './SelectionActions';
import styles from '../PianoRollEditor.module.css';

/**
 * Main toolbar component for PianoRollEditor
 * Combines all control groups into a unified toolbar
 */
export function Toolbar({
    // Zoom
    zoom,
    onZoomChange,

    // Grid
    gridSize,
    onGridSizeChange,
    snapToGrid,
    onSnapToGridChange,

    // Scale highlight
    showScaleHighlight,
    onShowScaleHighlightChange,

    // Metronome
    metronomeEnabled,
    onMetronomeEnabledChange,
    metronomeSubdivision,
    onMetronomeSubdivisionChange,

    // Loop
    loopEnabled,
    onLoopEnabledChange,

    // Playback
    isPlaying,
    playbackPosition,
    tempo,
    onPlay,
    onStop,
    onSeek,

    // Selection
    selectedNotesCount,
    totalNotesCount = 0,
    hasClipboard,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onDuplicate,
    onQuantize,

    // History
    canUndo,
    canRedo,
    onUndo,
    onRedo,

    // Recording
    isRecording,
    onRecordingChange,

    // Fullscreen
    isFullscreen,
    onClose
}) {
    return (
        <div className={styles.toolbar}>
            {/* Playback Controls */}
            <PlaybackControls
                isPlaying={isPlaying}
                playbackPosition={playbackPosition}
                tempo={tempo}
                onPlay={onPlay}
                onStop={onStop}
                onSeek={onSeek}
            />

            <div className={styles.toolbarDivider} />

            {/* Recording (fullscreen only) */}
            {isFullscreen && (
                <>
                    <div className={styles.toolbarSection}>
                        <button
                            className={`${styles.toolbarButton} ${isRecording ? styles.active : ''}`}
                            onClick={() => onRecordingChange(!isRecording)}
                            aria-pressed={isRecording}
                            aria-label={isRecording ? 'Arrêter enregistrement' : 'Démarrer enregistrement'}
                            title="Enregistrement MIDI (R)"
                        >
                            {isRecording ? '⏹ Stop' : '⏺ Rec'}
                        </button>
                    </div>
                    <div className={styles.toolbarDivider} />
                </>
            )}

            {/* Zoom Controls */}
            <ZoomControls
                zoom={zoom}
                onZoomChange={onZoomChange}
            />

            <div className={styles.toolbarDivider} />

            {/* Grid Controls */}
            <GridControls
                gridSize={gridSize}
                onGridSizeChange={onGridSizeChange}
                snapToGrid={snapToGrid}
                onSnapToGridChange={onSnapToGridChange}
            />

            <div className={styles.toolbarDivider} />

            {/* Metronome Controls */}
            <MetronomeControls
                enabled={metronomeEnabled}
                onEnabledChange={onMetronomeEnabledChange}
                subdivision={metronomeSubdivision}
                onSubdivisionChange={onMetronomeSubdivisionChange}
            />

            {/* Loop Controls */}
            <LoopControls
                enabled={loopEnabled}
                onEnabledChange={onLoopEnabledChange}
            />

            <div className={styles.toolbarDivider} />

            {/* Scale Highlight Toggle */}
            <div className={styles.toolbarSection}>
                <button
                    className={`${styles.toolbarButton} ${showScaleHighlight ? styles.active : ''}`}
                    onClick={() => onShowScaleHighlightChange(!showScaleHighlight)}
                    aria-pressed={showScaleHighlight}
                    title="Afficher les notes de la gamme"
                >
                    🎵 Gamme
                </button>
            </div>

            <div className={styles.toolbarDivider} />

            {/* Selection Actions */}
            <SelectionActions
                selectedCount={selectedNotesCount}
                totalNotesCount={totalNotesCount}
                hasClipboard={hasClipboard}
                onCopy={onCopy}
                onCut={onCut}
                onPaste={onPaste}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onQuantize={onQuantize}
            />

            <div className={styles.toolbarDivider} />

            {/* Undo/Redo */}
            <div className={styles.toolbarSection}>
                <button
                    className={styles.toolbarButton}
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="Annuler (Ctrl+Z)"
                    aria-label="Annuler"
                >
                    ↩
                </button>
                <button
                    className={styles.toolbarButton}
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="Rétablir (Ctrl+Y)"
                    aria-label="Rétablir"
                >
                    ↪
                </button>
            </div>

            {/* Close button (fullscreen only) */}
            {isFullscreen && onClose && (
                <button
                    className={styles.closeButton}
                    onClick={onClose}
                    title="Fermer (Échap)"
                    aria-label="Fermer l'éditeur"
                >
                    ✕ Fermer
                </button>
            )}
        </div>
    );
}

export default Toolbar;
