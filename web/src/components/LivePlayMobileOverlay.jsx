import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './LivePlayMobileOverlay.module.css';
import { PlaybackDock } from './PlaybackDock';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function LiveStat({ label, value, color, divider }) {
  return (
    <div className={`${styles.liveStat} ${divider ? styles.liveStatDivider : ''}`}>
      <div className={styles.liveStatValue} style={color ? { color } : undefined}>{value}</div>
      <div className={styles.liveStatLabel}>{label}</div>
    </div>
  );
}

export function LivePlayMobileOverlay({
  song,
  allNotes,
  isPlaying,
  onPlayPause,
  onBack,
  currentTime,
  currentBPM,
  defaultBPM,
  onTempoChange,
  handMode,
  setHandMode,
  isLoopEnabled,
  onLoopToggle,
  loopRange,
  onLoopRangeChange,
  totalMeasuresHint,
  sessionStats,
  phraseMeasureRanges,
  selectedPhraseIndex,
  onPhraseSelect,
  isMetronomeOn,
  setIsMetronomeOn,
  metronomeSubdivision = 'quarter',
  setMetronomeSubdivision,
  hideDock = false,
}) {
  const [visible, setVisible] = useState(true);
  const [loopEditorOpen, setLoopEditorOpen] = useState(false);
  const hideTimerRef = useRef(null);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setVisible(true);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    resetHideTimer(); // intentionally resets visible state on play/pause
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, resetHideTimer]);

  const handleTap = () => {
    if (visible) {
      setVisible(false);
    } else {
      resetHideTimer();
    }
  };

  // Stats: progress + accuracy (computed from sessionStats)
  const totalNotes = sessionStats.totalNotes || (allNotes?.length ?? 0);
  const completedNotes = (sessionStats.correctNotes || 0)
    + (sessionStats.wrongNotes || 0)
    + (sessionStats.missedNotes || 0);
  const accuracy = completedNotes > 0
    ? Math.round((sessionStats.correctNotes / completedNotes) * 100)
    : 100;
  const score = (sessionStats.perfectNotes || 0) * 100
    + (sessionStats.goodNotes || 0) * 60
    + ((sessionStats.correctNotes || 0) - (sessionStats.perfectNotes || 0) - (sessionStats.goodNotes || 0)) * 40;

  // Last note end-time for progress bar (in seconds)
  let songDurSec = 1;
  if (allNotes && allNotes.length > 0) {
    const last = allNotes[allNotes.length - 1];
    songDurSec = ((last.startTime || 0) + (last.duration || 0)) / 4; // beat→sec rough; canvas uses beatsPerSecond
  }
  const progressPct = Math.min(100, Math.max(0, (currentTime / Math.max(songDurSec, 0.001)) * 100));

  return (
    <div className={`${styles.overlay} ${visible ? styles.overlayVisible : styles.overlayHidden}`}>
      {/* Tap area to toggle overlay */}
      <div className={styles.tapCatcher} onClick={handleTap} />

      {/* Top HUD: back · centered title+composer · fullscreen */}
      <div className={styles.topHud}>
        <button className={styles.iconCircle} onClick={onBack} title="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className={styles.songMeta}>
          <div className={styles.songTitle}>{song?.title || 'Morceau'}</div>
          <div className={styles.songComposer}>{song?.composer || song?.artist || 'Artiste inconnu'}</div>
        </div>
        <span className={styles.timeDisplay}>{formatTime(currentTime)}</span>
      </div>

      {/* Stats strip */}
      <div className={styles.statsStrip}>
        <LiveStat label="Score" value={score.toLocaleString('fr-FR')} />
        <LiveStat label="Combo" value={`×${sessionStats.currentCombo || 0}`} color="var(--accent)" divider />
        <LiveStat label="Précision" value={`${accuracy}%`} color="var(--success)" divider />
        <LiveStat label="Notes" value={`${completedNotes}/${totalNotes}`} divider />
      </div>

      {/* Gradient progress bar */}
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      {/* Shared PlaybackDock at bottom (hidden in landscape per user spec) */}
      {!hideDock && (
      <div className={styles.dockHost}>
        <PlaybackDock
          playing={isPlaying}
          onPlayPause={onPlayPause}
          speed={Math.round(((currentBPM ?? defaultBPM) / Math.max(defaultBPM, 1)) * 100)}
          onSpeed={(pct) => onTempoChange?.(Math.round((pct / 100) * defaultBPM))}
          handMode={handMode === 'watch' ? 'listen' : handMode}
          onHandMode={(m) => setHandMode?.(m === 'listen' ? 'watch' : m)}
          metronome={!!isMetronomeOn}
          onMetronome={() => setIsMetronomeOn?.(!isMetronomeOn)}
          metronomeSubdivision={metronomeSubdivision}
          onMetronomeSubdivisionChange={setMetronomeSubdivision}
          loop={!!isLoopEnabled}
          onLoop={onLoopToggle}
          loopRange={loopRange ?? [1, totalMeasuresHint || 1]}
          onLoopRange={onLoopRangeChange}
          loopEditorOpen={loopEditorOpen}
          onToggleLoopEditor={() => setLoopEditorOpen((o) => !o)}
          totalMeasures={totalMeasuresHint || phraseMeasureRanges?.length || 1}
          phrases={phraseMeasureRanges || []}
          onPrev={() => {
            if (phraseMeasureRanges?.length && selectedPhraseIndex != null) {
              const i = parseInt(selectedPhraseIndex, 10);
              if (i > 0) onPhraseSelect?.({ target: { value: String(i - 1) } });
            }
          }}
          onNext={() => {
            if (phraseMeasureRanges?.length && selectedPhraseIndex != null) {
              const i = parseInt(selectedPhraseIndex, 10);
              if (i < phraseMeasureRanges.length - 1) onPhraseSelect?.({ target: { value: String(i + 1) } });
            }
          }}
        />
      </div>
      )}

    </div>
  );
}
