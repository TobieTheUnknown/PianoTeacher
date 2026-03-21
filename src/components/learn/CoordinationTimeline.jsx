import React, { useMemo, useRef, useEffect } from 'react';
import themeService from '../../services/ThemeService';

const MEASURE_WIDTH_MOBILE = 90;
const MEASURE_WIDTH_DESKTOP = 100;
const ROW_HEIGHT_MOBILE = 26;
const ROW_HEIGHT_DESKTOP = 24;
const NOTE_FONT_MOBILE = '0.55rem';
const NOTE_FONT_DESKTOP = '0.5rem';

export const CoordinationTimeline = React.memo(function CoordinationTimeline({
    measures, currentMeasureIndex, isMobile, onMeasureClick, displayNoteName, keySignature,
    playingMeasureIndex,
}) {
    const scrollRef = useRef(null);
    const measureWidth = isMobile ? MEASURE_WIDTH_MOBILE : MEASURE_WIDTH_DESKTOP;
    const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;
    const noteFontSize = isMobile ? NOTE_FONT_MOBILE : NOTE_FONT_DESKTOP;

    const colors = useMemo(() => ({
        left: themeService.getHandColors('left').primary,
        right: themeService.getHandColors('right').primary,
    }), []);

    // Scroll to follow the selected/playing measure
    useEffect(() => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const containerWidth = container.clientWidth;
        const targetIndex = playingMeasureIndex >= 0 ? playingMeasureIndex : currentMeasureIndex;
        const scrollTarget = targetIndex * (measureWidth + 3) - (containerWidth / 2) + (measureWidth / 2);
        container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
    }, [currentMeasureIndex, playingMeasureIndex, measureWidth]);

    if (!measures || measures.length === 0) return null;

    const getBeatActivity = (notes) => {
        const beats = [
            { active: false, names: [] },
            { active: false, names: [] },
            { active: false, names: [] },
            { active: false, names: [] },
        ];
        notes.forEach(n => {
            const beat = Math.floor(n.startTime % 4);
            if (beat >= 0 && beat < 4) {
                beats[beat].active = true;
                const name = displayNoteName ? displayNoteName(n.pitch, keySignature) : '';
                if (name && !beats[beat].names.includes(name)) {
                    beats[beat].names.push(name);
                }
            }
        });
        return beats;
    };

    const activeIndex = playingMeasureIndex >= 0 ? playingMeasureIndex : currentMeasureIndex;

    return (
        <div className="card" style={{
            padding: '0.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'var(--bg-card)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.3rem',
                padding: '0 0.25rem',
            }}>
                <span style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-tertiary)',
                    fontWeight: 400,
                }}>
                    Timeline
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '1px', background: colors.left }} />
                        <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>MG</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '1px', background: colors.right }} />
                        <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>MD</span>
                    </div>
                </div>
            </div>

            <div
                ref={scrollRef}
                style={{
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    display: 'flex',
                    gap: '3px',
                    paddingBottom: '2px',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
            >
                {measures.map((m, i) => {
                    const rightActivity = getBeatActivity(m.melody);
                    const leftActivity = getBeatActivity(m.chords);
                    const isCurrent = i === activeIndex;
                    const isBeingPlayed = playingMeasureIndex >= 0 && i === playingMeasureIndex;

                    return (
                        <div
                            key={i}
                            onClick={() => onMeasureClick && onMeasureClick(m.number)}
                            style={{
                                minWidth: `${measureWidth}px`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                padding: '3px',
                                borderRadius: 'var(--radius-sm)',
                                background: isCurrent ? 'var(--bg-hover)' : 'transparent',
                                border: isBeingPlayed
                                    ? '1px solid var(--accent-primary)'
                                    : isCurrent
                                        ? '1px solid var(--border-medium)'
                                        : '1px solid transparent',
                                boxShadow: isBeingPlayed ? '0 0 8px rgba(245,245,245,0.1)' : 'none',
                                cursor: 'pointer',
                                flexShrink: 0,
                            }}
                        >
                            <div style={{
                                fontSize: '0.5rem',
                                textAlign: 'center',
                                color: isBeingPlayed ? 'var(--accent-primary)' : isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontWeight: isCurrent ? 600 : 400,
                                marginBottom: '1px',
                            }}>
                                {m.number}
                            </div>
                            <div style={{ display: 'flex', gap: '1px', height: `${rowHeight}px` }}>
                                {rightActivity.map((beat, idx) => (
                                    <div key={idx} style={{
                                        flex: 1,
                                        borderRadius: '2px',
                                        background: beat.active ? colors.right : 'var(--bg-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: noteFontSize,
                                        color: beat.active ? 'white' : 'transparent',
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {beat.active && beat.names.length > 0 ? beat.names[0] : ''}
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '1px', height: `${rowHeight}px` }}>
                                {leftActivity.map((beat, idx) => (
                                    <div key={idx} style={{
                                        flex: 1,
                                        borderRadius: '2px',
                                        background: beat.active ? colors.left : 'var(--bg-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: noteFontSize,
                                        color: beat.active ? 'white' : 'transparent',
                                        fontWeight: 600,
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {beat.active && beat.names.length > 0 ? beat.names[0] : ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
