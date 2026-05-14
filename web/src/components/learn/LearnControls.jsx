import React, { memo, useState, useEffect } from 'react';
import themeService from '../../services/ThemeService';

const SEGMENT_COLORS = [
    'rgba(255,255,255,0.06)',
    'rgba(255,255,255,0.03)',
    'rgba(255,255,255,0.08)',
    'rgba(255,255,255,0.04)',
];

const LearnControls = memo(function LearnControls({
    isPlaying,
    onPlayPause,
    onStop,
    playbackHand,
    setPlaybackHand,
    currentBPM,
    defaultBPM,
    onTempoChange,
    isLooping,
    onToggleLoop,
    focusedMeasure,
    totalMeasures,
    phrases,
    highlightedMeasures,
    loopConfig,
    phraseMeasureRanges,
    onPhraseSelect,
    selectedPhraseIndex,
    customRangeStart,
    setCustomRangeStart,
    customRangeEnd,
    setCustomRangeEnd,
    onCustomRangeLoop,
    onClearLoop,
    isMobile,
    isMetronomeOn,
    onToggleMetronome,
}) {
    const [colors, setColors] = useState(() => ({
        left: themeService.getHandColors('left').primary,
        right: themeService.getHandColors('right').primary,
    }));

    useEffect(() => {
        const update = () => setColors({
            left: themeService.getHandColors('left').primary,
            right: themeService.getHandColors('right').primary,
        });
        return themeService.addListener(update);
    }, []);

    const percentage = Math.round((currentBPM / defaultBPM) * 100);

    const changeSpeed = (delta) => {
        const newPct = Math.max(30, Math.min(150, percentage + delta));
        onTempoChange(Math.round(defaultBPM * newPct / 100));
    };

    const btnSm = {
        padding: '0.3rem 0.45rem',
        fontSize: '0.65rem',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        border: '1px solid var(--border-color)',
        fontWeight: 500,
        minHeight: 'auto',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
    };

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-color)',
            padding: '0.4rem 0.75rem',
            paddingBottom: isMobile ? 'calc(0.4rem + 64px)' : '0.4rem',
            position: 'sticky',
            bottom: 0,
            zIndex: 50,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.4)',
        }}>
            {/* Row 1: Structure Bar */}
            {phrases && phrases.length > 0 && totalMeasures > 0 && (
                <div style={{
                    height: '12px',
                    width: '100%',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    display: 'flex',
                    position: 'relative',
                    border: '1px solid var(--border-color)',
                    marginBottom: '0.35rem',
                }}>
                    {phrases.map((phrase, i) => {
                        const width = (phrase.length / totalMeasures) * 100;
                        return (
                            <div key={i} style={{
                                width: `${width}%`,
                                background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                                borderRight: i < phrases.length - 1 ? '1px solid var(--border-color)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.4rem', color: 'var(--text-muted)',
                                overflow: 'hidden', whiteSpace: 'nowrap',
                            }}>
                                {width > 14 ? phrase.name : ''}
                            </div>
                        );
                    })}
                    {highlightedMeasures && highlightedMeasures.map(m => (
                        <div key={`h-${m}`} style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${((m - 1) / totalMeasures) * 100}%`,
                            width: `${(1 / totalMeasures) * 100}%`,
                            background: 'rgba(245,245,245,0.1)', pointerEvents: 'none',
                        }} />
                    ))}
                    {focusedMeasure > 0 && (
                        <div style={{
                            position: 'absolute', top: 0, bottom: 0, width: '2px',
                            background: 'var(--accent-primary)',
                            boxShadow: '0 0 4px rgba(245,245,245,0.3)',
                            transition: 'left 0.15s ease',
                            left: `${((focusedMeasure - 0.5) / totalMeasures) * 100}%`,
                        }} />
                    )}
                </div>
            )}

            {/* Row 2: Controls — play centré */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                justifyContent: 'center',
            }}>
                {/* Left group: hands */}
                {[
                    { key: 'left', label: 'MG', color: colors.left },
                    { key: 'both', label: '2', color: 'var(--accent-primary)' },
                    { key: 'right', label: 'MD', color: colors.right },
                ].map(({ key, label, color }) => (
                    <button key={key} onClick={() => setPlaybackHand(key)} style={{
                        ...btnSm, padding: '0.3rem 0.4rem', fontSize: '0.6rem',
                        background: playbackHand === key ? color : 'var(--bg-secondary)',
                        color: playbackHand === key ? 'white' : 'var(--text-secondary)',
                        borderColor: playbackHand === key ? color : 'var(--border-color)',
                        borderRadius: key === 'left' ? 'var(--radius-md) 0 0 var(--radius-md)'
                            : key === 'right' ? '0 var(--radius-md) var(--radius-md) 0' : '0',
                    }}>
                        {label}
                    </button>
                ))}

                <div style={{ width: '1px', height: '14px', background: 'var(--border-color)', flexShrink: 0 }} />

                {/* Speed */}
                <button onClick={() => changeSpeed(-10)} style={{ ...btnSm, padding: '0.25rem 0.35rem', fontSize: '0.65rem' }}>−</button>
                <span style={{
                    fontSize: '0.55rem', color: percentage === 100 ? 'var(--text-secondary)' : 'var(--accent-primary)',
                    fontFamily: 'var(--font-mono)', fontWeight: percentage === 100 ? 400 : 600,
                    minWidth: '24px', textAlign: 'center',
                }}>{percentage}%</span>
                <button onClick={() => changeSpeed(10)} style={{ ...btnSm, padding: '0.25rem 0.35rem', fontSize: '0.65rem' }}>+</button>

                <div style={{ width: '1px', height: '14px', background: 'var(--border-color)', flexShrink: 0 }} />

                {/* PLAY — gros, centré */}
                <button onClick={onPlayPause} style={{
                    ...btnSm,
                    padding: '0.5rem 1rem',
                    fontSize: '1rem',
                    background: isPlaying ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: isPlaying ? 'var(--bg-primary)' : 'var(--text-primary)',
                    borderColor: isPlaying ? 'var(--accent-primary)' : 'var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                }}>
                    {isPlaying ? '⏸' : '▶'}
                </button>

                <div style={{ width: '1px', height: '14px', background: 'var(--border-color)', flexShrink: 0 }} />

                {/* Loop */}
                <button onClick={onToggleLoop} style={{
                    ...btnSm, fontSize: '0.6rem',
                    background: isLooping ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: isLooping ? 'var(--bg-primary)' : 'var(--text-primary)',
                    borderColor: isLooping ? 'var(--accent-primary)' : 'var(--border-color)',
                }}>🔁</button>

                {/* Metronome */}
                <button onClick={onToggleMetronome} style={{
                    ...btnSm, fontSize: '0.6rem',
                    background: isMetronomeOn ? 'var(--accent-success, #22c55e)' : 'var(--bg-secondary)',
                    color: isMetronomeOn ? 'white' : 'var(--text-secondary)',
                    borderColor: isMetronomeOn ? 'var(--accent-success, #22c55e)' : 'var(--border-color)',
                }}>⏰</button>

                {/* Stop */}
                <button onClick={onStop} style={btnSm}>⏹</button>
            </div>

            {/* Row 3: Loop selector (when active) */}
            {isLooping && phraseMeasureRanges && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    marginTop: '0.3rem', paddingTop: '0.3rem',
                    borderTop: '1px solid var(--border-color)', flexWrap: 'wrap',
                }}>
                    <select value={selectedPhraseIndex} onChange={onPhraseSelect} style={{
                        fontSize: '0.55rem', padding: '0.2rem 0.3rem',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        flex: 1, minWidth: '70px',
                    }}>
                        <option value="">Phrase...</option>
                        {phraseMeasureRanges.map((phrase, index) => (
                            <option key={index} value={index}>
                                {phrase.name} (m.{phrase.startMeasure}-{phrase.endMeasure})
                            </option>
                        ))}
                        <option value="custom">Personnalisé</option>
                    </select>
                    {selectedPhraseIndex === 'custom' && (
                        <>
                            <input type="number" min="1" max={totalMeasures} value={customRangeStart}
                                onChange={(e) => setCustomRangeStart(e.target.value)} placeholder="De"
                                style={{ width: '34px', fontSize: '0.55rem', padding: '0.15rem', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>→</span>
                            <input type="number" min={customRangeStart || "1"} max={totalMeasures} value={customRangeEnd}
                                onChange={(e) => setCustomRangeEnd(e.target.value)} placeholder="À"
                                style={{ width: '34px', fontSize: '0.55rem', padding: '0.15rem', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                            <button onClick={onCustomRangeLoop} disabled={!customRangeStart || !customRangeEnd}
                                style={{ ...btnSm, fontSize: '0.5rem', padding: '0.1rem 0.3rem' }}>OK</button>
                        </>
                    )}
                    {loopConfig && (
                        <>
                            <span style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>
                                🔁 {loopConfig.name || `m.${loopConfig.startMeasure}-${loopConfig.endMeasure}`}
                            </span>
                            <button onClick={onClearLoop} style={{
                                ...btnSm, fontSize: '0.45rem', padding: '0.1rem 0.25rem',
                                color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)', background: 'transparent',
                            }}>✕</button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
});

export { LearnControls };
