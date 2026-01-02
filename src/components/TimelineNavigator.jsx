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
    tempo
}) {
    // Helper functions pour conversion (définis avant le hook)
    const measureToTime = useCallback((measure, bps) => {
        return ((measure - 1) * 4) / bps;
    }, []);

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
    const loopEnd = loopConfig ? measureToTime(loopConfig.endMeasure, beatsPerSecond) : null;

    const {
        timelineRef,
        isDragging,
        isDraggingLoopHandle,
        handleTimelineClick,
        handleMouseDown,
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
                const startMeasure = timeToMeasure(start, beatsPerSecond);
                // Pour le handle de fin, utiliser la conversion exacte (sans epsilon)
                // Le handle de droite est EXCLUSIF: si positionné au début de la mesure 5,
                // on loope les mesures 1-4 (la mesure 5 n'est pas jouée)
                const endMeasure = timeToMeasureExact(end, beatsPerSecond);
                onLoopChange(startMeasure, endMeasure);
            }
        }, [onLoopChange, timeToMeasure, timeToMeasureExact, beatsPerSecond]),
        isPlaying
    });

    // Calculer le nombre total de mesures
    const totalMeasures = useMemo(() => {
        return Math.ceil(totalDuration * beatsPerSecond / 4);
    }, [totalDuration, beatsPerSecond]);

    // Calculer les plages de mesures pour chaque phrase
    const phraseMeasureRanges = useMemo(() => {
        let currentMeasure = 1;
        return phrases.map((phrase, index) => {
            const range = {
                phraseIndex: index,
                name: phrase.name,
                startMeasure: currentMeasure,
                endMeasure: currentMeasure + phrase.length - 1,
                length: phrase.length
            };
            currentMeasure += phrase.length;
            return range;
        });
    }, [phrases]);

    // Gérer le click sur un raccourci phrase
    const handlePhraseClick = useCallback((phraseRange) => {
        if (onPhraseLoopSelect) {
            onPhraseLoopSelect(phraseRange.startMeasure, phraseRange.endMeasure, phraseRange.name);
        }
    }, [onPhraseLoopSelect]);

    // Calculer les positions pour le rendu
    const timelineWidth = 800; // Largeur fixe de la timeline
    const currentPosition = timeToX(currentTime, timelineWidth);

    const loopStartPosition = loopConfig ? timeToX(measureToTime(loopConfig.startMeasure, beatsPerSecond), timelineWidth) : null;
    const loopEndPosition = loopConfig ? timeToX(measureToTime(loopConfig.endMeasure, beatsPerSecond), timelineWidth) : null;

    return (
        <div className="timeline-navigator" style={{ padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
            {/* Timeline principale */}
            <div
                ref={timelineRef}
                className="timeline-track"
                onClick={handleTimelineClick}
                style={{
                    position: 'relative',
                    width: `${timelineWidth}px`,
                    height: '60px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '4px',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    margin: '0 auto',
                    border: '1px solid #444'
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
                                    backgroundColor: i % 4 === 0 ? '#666' : '#444',
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
                                backgroundColor: '#3b82f6',
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
                                backgroundColor: '#3b82f6',
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
                        backgroundColor: '#fbbf24',
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

            {/* Contrôles de loop */}
            <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <button
                    onClick={onLoopToggle}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: isLoopEnabled ? '#3b82f6' : '#444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: isLoopEnabled ? 'bold' : 'normal'
                    }}
                >
                    {isLoopEnabled ? '● Loop actif' : 'Loop'}
                </button>

                {isLoopEnabled && loopConfig && (
                    <>
                        <span style={{ color: '#888', fontSize: '14px' }}>
                            Mesure {loopConfig.startMeasure} → {loopConfig.endMeasure}
                        </span>
                        <button
                            onClick={() => onLoopToggle()}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            × Arrêter
                        </button>
                    </>
                )}
            </div>

            {/* Raccourcis phrases */}
            {phraseMeasureRanges.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', textAlign: 'center' }}>
                        Raccourcis phrases:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                        {phraseMeasureRanges.map((range) => (
                            <button
                                key={range.phraseIndex}
                                onClick={() => handlePhraseClick(range)}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor:
                                        isLoopEnabled &&
                                        loopConfig?.startMeasure === range.startMeasure &&
                                        loopConfig?.endMeasure === range.endMeasure
                                            ? '#3b82f6'
                                            : '#555',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (!(isLoopEnabled && loopConfig?.startMeasure === range.startMeasure && loopConfig?.endMeasure === range.endMeasure)) {
                                        e.target.style.backgroundColor = '#666';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!(isLoopEnabled && loopConfig?.startMeasure === range.startMeasure && loopConfig?.endMeasure === range.endMeasure)) {
                                        e.target.style.backgroundColor = '#555';
                                    }
                                }}
                            >
                                {range.name} ({range.startMeasure}-{range.endMeasure})
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tooltip d'aide */}
            <div style={{ marginTop: '15px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
                💡 Cliquez pour naviguer • Glissez les poignées pour ajuster la loop
            </div>
        </div>
    );
}
