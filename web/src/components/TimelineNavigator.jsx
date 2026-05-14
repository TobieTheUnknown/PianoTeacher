import React, { useMemo, useCallback } from 'react';
import { useTimelineInteraction } from '../hooks/useTimelineInteraction';

/**
 * TimelineNavigator - Composant interactif pour naviguer dans la timeline et gérer les loops
 *
 * Fonctionnalités :
 * - Click pour se positionner dans le morceau
 * - Drag pour scrubbing
 * - Scroll wheel pour avancer/reculer par mesure
 * - Gestion visuelle de la zone de loop
 * - Poignées draggables pour ajuster le loop
 * - Raccourcis phrases pour loop rapide
 */
export function TimelineNavigator({
    totalDuration,
    currentTime,
    loopConfig,
    isLoopEnabled,
    phrases = [],
    beatsPerSecond,
    onSeek,
    onLoopChange,
    onLoopToggle,
    onPhraseLoopSelect,
    isPlaying,
    // eslint-disable-next-line no-unused-vars
    tempo
}) {
    // Helper functions pour conversion (définis avant le hook)
    const measureToTime = useCallback((measure, bps) => {
        return ((measure - 1) * 4) / bps;
    }, []);

    // eslint-disable-next-line no-unused-vars
    const timeToMeasure = useCallback((time, bps) => {
        const beats = time * bps;
        // Soustraire un petit epsilon pour éviter que la fin d'une mesure
        // soit comptée comme le début de la suivante
        const adjustedBeats = beats > 0 ? beats - 0.001 : beats;
        return Math.floor(adjustedBeats / 4) + 1;
    }, []);

    // Version sans epsilon pour la conversion exacte des handles de loop
    const timeToMeasureExact = useCallback((time, bps) => {
        const beats = time * bps;
        return Math.floor(beats / 4) + 1;
    }, []);

    // Calculer loopStart et loopEnd
    const loopStart = loopConfig ? measureToTime(loopConfig.startMeasure, beatsPerSecond) : null;
    // loopEnd doit être à la FIN de endMeasure (qui correspond au début de la mesure endMeasure)
    // endMeasure is inclusive, so loopEnd should be at the END of that measure
    const loopEnd = loopConfig ? measureToTime(loopConfig.endMeasure + 1, beatsPerSecond) : null;

    const {
        timelineRef,
        isDragging,
        isDraggingLoopHandle,
        handleTimelineClick,
        handleMouseDown,
        // eslint-disable-next-line no-unused-vars
        handleWheel,
        timeToX
    } = useTimelineInteraction({
        totalDuration,
        currentTime,
        loopStart,
        loopEnd,
        onSeek,
        onLoopChange: useCallback(({ start, end }) => {
            if (onLoopChange) {
                // Utiliser la conversion exacte (sans epsilon) pour les deux handles
                // pour éviter que le drag d'un handle affecte l'autre handle
                const startMeasure = timeToMeasureExact(start, beatsPerSecond);
                // End handle position represents end of last measure (exclusive)
                // Convert back to inclusive endMeasure by subtracting 1
                const endMeasure = Math.max(startMeasure, timeToMeasureExact(end, beatsPerSecond) - 1);
                onLoopChange(startMeasure, endMeasure);
            }
        }, [onLoopChange, timeToMeasureExact, beatsPerSecond]),
        isPlaying
    });

    // Calculer le nombre total de mesures
    const totalMeasures = useMemo(() => {
        return Math.ceil(totalDuration * beatsPerSecond / 4);
    }, [totalDuration, beatsPerSecond]);

    // Calculer les plages de mesures pour chaque phrase
    const phraseMeasureRanges = useMemo(() => {
        return phrases.reduce((acc, phrase, index) => {
            const startMeasure = index === 0 ? 1 : acc[index - 1].endMeasure + 1;
            acc.push({
                phraseIndex: index,
                name: phrase.name,
                startMeasure: startMeasure,
                endMeasure: startMeasure + phrase.length - 1,
                length: phrase.length
            });
            return acc;
        }, []);
    }, [phrases]);

    // Gérer le click sur un raccourci phrase
    const handlePhraseClick = useCallback((phraseRange) => {
        if (onPhraseLoopSelect) {
            onPhraseLoopSelect(phraseRange.startMeasure, phraseRange.endMeasure, phraseRange.name);
        }
    }, [onPhraseLoopSelect]);

    // Calculer les positions pour le rendu
    const timelineWidth = 1100; // Largeur de la timeline
    const currentPosition = timeToX(currentTime, timelineWidth);

    const loopStartPosition = loopConfig ? timeToX(measureToTime(loopConfig.startMeasure, beatsPerSecond), timelineWidth) : null;
    // endMeasure is inclusive, so the end handle should be at the END of that measure (= start of endMeasure+1)
    const loopEndPosition = loopConfig ? timeToX(measureToTime(loopConfig.endMeasure + 1, beatsPerSecond), timelineWidth) : null;

    return (
        <div className="timeline-navigator" style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
            {/* Timeline principale */}
            <div
                ref={timelineRef}
                className="timeline-track"
                onClick={handleTimelineClick}
                style={{
                    position: 'relative',
                    width: `${timelineWidth}px`,
                    height: '60px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '4px',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    margin: '0 auto',
                    border: '1px solid var(--border-color)'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'timeline')}
            >
                {/* Grille des mesures */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    {Array.from({ length: totalMeasures }, (_, i) => {
                        const measureTime = measureToTime(i + 1, beatsPerSecond);
                        const x = timeToX(measureTime, timelineWidth);
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: `${x}px`,
                                    top: 0,
                                    width: '1px',
                                    height: '100%',
                                    backgroundColor: i % 4 === 0 ? 'var(--border-dark)' : 'var(--border-medium)',
                                    pointerEvents: 'none'
                                }}
                            />
                        );
                    })}
                </div>

                {/* Labels des mesures */}
                <div style={{ position: 'absolute', top: '5px', left: 0, width: '100%', height: '20px' }}>
                    {Array.from({ length: Math.min(totalMeasures, 20) }, (_, i) => {
                        const measureNum = i * Math.ceil(totalMeasures / 20) + 1;
                        if (measureNum > totalMeasures) return null;
                        const measureTime = measureToTime(measureNum, beatsPerSecond);
                        const x = timeToX(measureTime, timelineWidth);
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: `${x}px`,
                                    top: 0,
                                    fontSize: '10px',
                                    color: '#888',
                                    transform: 'translateX(-50%)',
                                    pointerEvents: 'none'
                                }}
                            >
                                {measureNum}
                            </div>
                        );
                    })}
                </div>

                {/* Zone de loop */}
                {isLoopEnabled && loopConfig && loopStartPosition !== null && loopEndPosition !== null && (
                    <>
                        {/* Rectangle de la zone loop */}
                        <div
                            style={{
                                position: 'absolute',
                                left: `${loopStartPosition}px`,
                                top: 0,
                                width: `${loopEndPosition - loopStartPosition}px`,
                                height: '100%',
                                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                border: '2px solid rgba(59, 130, 246, 0.6)',
                                pointerEvents: 'none',
                                borderRadius: '4px'
                            }}
                        />

                        {/* Poignée de début de loop */}
                        <div
                            onMouseDown={(e) => handleMouseDown(e, 'loopStart')}
                            style={{
                                position: 'absolute',
                                left: `${loopStartPosition - 6}px`,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '12px',
                                height: '30px',
                                backgroundColor: 'var(--hand-left)',
                                borderRadius: '4px',
                                cursor: 'ew-resize',
                                border: '2px solid #1d4ed8',
                                opacity: isDraggingLoopHandle === 'loopStart' ? 1 : 0.8,
                                transition: 'opacity 0.2s'
                            }}
                        />

                        {/* Poignée de fin de loop */}
                        <div
                            onMouseDown={(e) => handleMouseDown(e, 'loopEnd')}
                            style={{
                                position: 'absolute',
                                left: `${loopEndPosition - 6}px`,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '12px',
                                height: '30px',
                                backgroundColor: 'var(--hand-left)',
                                borderRadius: '4px',
                                cursor: 'ew-resize',
                                border: '2px solid #1d4ed8',
                                opacity: isDraggingLoopHandle === 'loopEnd' ? 1 : 0.8,
                                transition: 'opacity 0.2s'
                            }}
                        />

                        {/* Label de la loop */}
                        <div
                            style={{
                                position: 'absolute',
                                left: `${(loopStartPosition + loopEndPosition) / 2}px`,
                                top: '30px',
                                transform: 'translateX(-50%)',
                                fontSize: '11px',
                                color: '#60a5fa',
                                fontWeight: 'bold',
                                pointerEvents: 'none',
                                backgroundColor: 'rgba(26, 26, 26, 0.8)',
                                padding: '2px 6px',
                                borderRadius: '3px'
                            }}
                        >
                            {loopConfig.name || `${loopConfig.startMeasure}-${loopConfig.endMeasure}`}
                        </div>
                    </>
                )}

                {/* Curseur de playback */}
                <div
                    style={{
                        position: 'absolute',
                        left: `${currentPosition}px`,
                        top: 0,
                        width: '2px',
                        height: '100%',
                        backgroundColor: 'var(--accent-warning)',
                        pointerEvents: 'none',
                        boxShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
                        zIndex: 10
                    }}
                >
                    {/* Triangle au-dessus */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '8px solid #fbbf24'
                        }}
                    />
                </div>
            </div>

        </div>
    );
}
