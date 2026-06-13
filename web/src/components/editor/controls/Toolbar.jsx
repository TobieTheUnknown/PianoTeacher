import React, { memo } from 'react';
import { ZoomControls } from './ZoomControls';
import { GridControls } from './GridControls';
import { PlaybackControls } from './PlaybackControls';
import { MetronomeControls } from './MetronomeControls';
import { LoopControls } from './LoopControls';
import { MeasureControls } from './MeasureControls';
import { SelectionActions } from './SelectionActions';
import styles from '../PianoRollEditor.module.css';

/**
 * Main toolbar component for PianoRollEditor
 * Combines all control groups into a unified toolbar
 * OPTIMIZED: Wrapped in React.memo with custom comparison to prevent unnecessary re-renders
 */
const ToolbarComponent = ({
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
    keySignature,

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
    positionRef,
    tempo,
    onPlay,
    onStop,
    onSeek,

    // Measures
    totalMeasures,
    phraseLength,
    onAddMeasures,

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

    // Tool mode
    activeTool,
    onToolChange,

    // Fullscreen
    isFullscreen,
    onClose
}) => {
    return (
        <div className={styles.toolbar}>
            {/* Tool toggles */}
            <div className={styles.toolbarSection}>
                <button
                    className={`${styles.toolbarButton} ${activeTool === 'draw' ? styles.active : ''}`}
                    onClick={() => onToolChange('draw')}
                    aria-pressed={activeTool === 'draw'}
                    title="Outil Dessiner (ajouter/supprimer des notes)"
                >
                    ✏️
                </button>
                <button
                    className={`${styles.toolbarButton} ${activeTool === 'select' ? styles.active : ''}`}
                    onClick={() => onToolChange('select')}
                    aria-pressed={activeTool === 'select'}
                    title="Outil Sélection (rectangle de sélection)"
                >
                    ↖
                </button>
            </div>

            <div className={styles.toolbarDivider} />

            {/* Playback Controls */}
            <PlaybackControls
                isPlaying={isPlaying}
                positionRef={positionRef}
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

            {/* Measure Controls */}
            {onAddMeasures && (
                <>
                    <MeasureControls
                        totalMeasures={totalMeasures}
                        phraseLength={phraseLength}
                        onAddMeasures={onAddMeasures}
                    />
                    <div className={styles.toolbarDivider} />
                </>
            )}

            {/* Scale Highlight Toggle */}
            <div className={styles.toolbarSection}>
                <button
                    className={`${styles.toolbarButton} ${showScaleHighlight ? styles.active : ''}`}
                    onClick={() => onShowScaleHighlightChange(!showScaleHighlight)}
                    aria-pressed={showScaleHighlight}
                    title="Afficher les notes de la gamme"
                >
                    🎵 {keySignature || 'Do'}
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
};

/**
 * Custom comparison function for React.memo
 * Only re-render when state values change, not when callback references change
 */
const arePropsEqual = (prevProps, nextProps) => {
    // Compare state values that should trigger re-render
    return (
        prevProps.zoom === nextProps.zoom &&
        prevProps.gridSize === nextProps.gridSize &&
        prevProps.snapToGrid === nextProps.snapToGrid &&
        prevProps.showScaleHighlight === nextProps.showScaleHighlight &&
        prevProps.keySignature === nextProps.keySignature &&
        prevProps.metronomeEnabled === nextProps.metronomeEnabled &&
        prevProps.metronomeSubdivision === nextProps.metronomeSubdivision &&
        prevProps.loopEnabled === nextProps.loopEnabled &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.tempo === nextProps.tempo &&
        prevProps.totalMeasures === nextProps.totalMeasures &&
        prevProps.phraseLength === nextProps.phraseLength &&
        prevProps.selectedNotesCount === nextProps.selectedNotesCount &&
        prevProps.totalNotesCount === nextProps.totalNotesCount &&
        prevProps.hasClipboard === nextProps.hasClipboard &&
        prevProps.canUndo === nextProps.canUndo &&
        prevProps.canRedo === nextProps.canRedo &&
        prevProps.isRecording === nextProps.isRecording &&
        prevProps.isFullscreen === nextProps.isFullscreen &&
        prevProps.activeTool === nextProps.activeTool
    );
};

export const Toolbar = memo(ToolbarComponent, arePropsEqual);

export default Toolbar;
