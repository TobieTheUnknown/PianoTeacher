import React, { memo } from 'react';

const SynthesiaControls = memo(({
  isPlaying, onPlayPause, onReset, currentTime,
  handMode, setHandMode, waitMode, setWaitMode,
  freePlayMode, setFreePlayMode,
  isMetronomeOn, setIsMetronomeOn, metronomeDivision, setMetronomeDivision,
  currentBPM, defaultBPM, onTempoChange,
  visualEffects, setVisualEffects,
}) => {
  const percentage = Math.round((currentBPM / defaultBPM) * 100);
  const changeSpeed = (delta) => {
    const newPct = Math.max(30, Math.min(150, percentage + delta));
    onTempoChange(Math.round(defaultBPM * newPct / 100));
  };

  const btn = {
    padding: '0.3rem 0.5rem',
    fontSize: '0.75rem',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    minHeight: 'auto',
    fontWeight: 500,
  };
  const btnActive = {
    ...btn,
    background: 'var(--accent-primary)',
    color: 'var(--bg-primary)',
    borderColor: 'var(--accent-primary)',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.3rem',
      flexWrap: 'wrap',
      padding: '0.4rem 0.75rem',
    }}>
      {/* Metronome */}
      <button onClick={() => setIsMetronomeOn(!isMetronomeOn)}
        style={isMetronomeOn ? { ...btn, background: 'var(--accent-success, #22c55e)', color: 'white', borderColor: 'var(--accent-success, #22c55e)' } : btn}
        title="Métronome">⏰</button>

      {isMetronomeOn && ['measure', 'half-measure', 'beat'].map((div, i) => {
        const labels = ['1', '½', '¼'];
        return (
          <button key={div} onClick={() => setMetronomeDivision(div)}
            style={metronomeDivision === div ? btnActive : btn}>{labels[i]}</button>
        );
      })}

      <span style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />

      {/* Speed [-] 100% [+] */}
      <button onClick={() => changeSpeed(-10)} style={btn}>−</button>
      <span style={{
        fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
        color: percentage === 100 ? 'var(--text-secondary)' : 'var(--accent-primary)',
        fontWeight: percentage === 100 ? 400 : 600,
        minWidth: '28px', textAlign: 'center',
      }}>{percentage}%</span>
      <button onClick={() => changeSpeed(10)} style={btn}>+</button>

      <span style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />

      {/* Play / Reset */}
      <button onClick={onPlayPause} style={isPlaying ? { ...btn, padding: '0.4rem 0.8rem', fontSize: '0.9rem', background: 'var(--accent-primary)', color: 'var(--bg-primary)', borderColor: 'var(--accent-primary)' } : { ...btn, padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button onClick={onReset} style={btn} title="Recommencer">🔄</button>

      <span style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />

      {/* Modes */}
      <button onClick={() => setHandMode(handMode === 'watch' ? 'both' : 'watch')}
        style={handMode === 'watch' ? btnActive : btn} title="Écoute/Pratique">
        {handMode === 'watch' ? '👀' : '🎹'}
      </button>
      <button onClick={() => setWaitMode(!waitMode)} style={waitMode ? btnActive : btn} title="Attente/Continue">
        {waitMode ? '⏸️' : '▶️'}
      </button>
      <button onClick={() => setFreePlayMode(!freePlayMode)} style={freePlayMode ? btnActive : btn} title="Libre/Guidé">
        {freePlayMode ? '🎵' : '🎯'}
      </button>
      <button onClick={() => setVisualEffects(!visualEffects)} style={visualEffects ? btnActive : btn} title="Effets">
        {visualEffects ? '✨' : '⚡'}
      </button>

      {/* Hand selection (only in practice mode) */}
      {handMode !== 'watch' && (
        <>
          <span style={{ width: '1px', height: '18px', background: 'var(--border-color)' }} />
          {['left', 'both', 'right'].map((hand) => {
            const labels = { left: 'MG', both: '2', right: 'MD' };
            return (
              <button key={hand} onClick={() => setHandMode(hand)}
                style={handMode === hand ? btnActive : btn}>{labels[hand]}</button>
            );
          })}
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
          </span>
        </>
      )}
    </div>
  );
});

SynthesiaControls.displayName = 'SynthesiaControls';

export default SynthesiaControls;
