import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './LivePlayMobileOverlay.module.css';

const HAND_LABELS = { both: 'LR', left: 'MG', right: 'MD', watch: 'Auto' };
const HAND_CYCLE = ['both', 'right', 'left', 'watch'];

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
  sessionStats,
  phraseMeasureRanges,
  selectedPhraseIndex,
  onPhraseSelect,
  isMetronomeOn,
  setIsMetronomeOn,
  visualEffects,
  setVisualEffects,
  waitMode,
  setWaitMode,
}) {
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef(null);
  const [showSheet, setShowSheet] = useState(false);

  // Swipe-to-dismiss state
  const [swipeY, setSwipeY] = useState(0);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);

  const handleSheetTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleSheetTouchMove = useCallback((e) => {
    if (!isDragging.current || touchStartY.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    // Only allow downward swipe
    setSwipeY(Math.max(0, deltaY));
  }, []);

  const handleSheetTouchEnd = useCallback(() => {
    if (swipeY > 80) {
      setShowSheet(false);
    }
    setSwipeY(0);
    touchStartY.current = null;
    isDragging.current = false;
  }, [swipeY]);

  // Reset swipe offset when sheet closes
  useEffect(() => {
    if (!showSheet) setSwipeY(0);
  }, [showSheet]);

  // Tempo +/- handlers
  const minBPM = Math.round(defaultBPM * 0.25);
  const maxBPM = Math.round(defaultBPM * 2);

  const decreaseTempo = useCallback(() => {
    onTempoChange(Math.max(minBPM, currentBPM - 5));
  }, [currentBPM, minBPM, onTempoChange]);

  const increaseTempo = useCallback(() => {
    onTempoChange(Math.min(maxBPM, currentBPM + 5));
  }, [currentBPM, maxBPM, onTempoChange]);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setVisible(true);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, resetHideTimer]);

  const handleTap = () => {
    if (showSheet) {
      setShowSheet(false);
      return;
    }
    if (visible) {
      setVisible(false);
    } else {
      resetHideTimer();
    }
  };

  const cycleHand = () => {
    const idx = HAND_CYCLE.indexOf(handMode);
    setHandMode(HAND_CYCLE[(idx + 1) % HAND_CYCLE.length]);
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

      {/* Center bottom - play/pause */}
      <div className={styles.centerBottom}>
        <button
          className={`${styles.playPauseButton} ${isPlaying ? styles.playing : ''}`}
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Bottom left - tempo */}
      <div className={styles.bottomLeft}>
        <button className={styles.tempoButton} onClick={decreaseTempo}>
          −
        </button>
        <span className={styles.tempoLabel}>{currentBPM} BPM</span>
        <button className={styles.tempoButton} onClick={increaseTempo}>
          +
        </button>
      </div>

      {/* Bottom right - toggles */}
      <div className={styles.bottomRight}>
        <button
          className={`${styles.toggleButton} ${isLoopEnabled ? styles.toggleButtonActive : ''}`}
          onClick={onLoopToggle}
          title="Boucle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
        <button
          className={styles.toggleButton}
          onClick={cycleHand}
          title={`Main: ${HAND_LABELS[handMode]}`}
        >
          {HAND_LABELS[handMode]}
        </button>
        {setWaitMode && (
          <button
            className={`${styles.toggleButton} ${waitMode ? styles.toggleButtonActive : ''}`}
            onClick={() => setWaitMode(!waitMode)}
            title="Mode d'attente"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        )}
        <button
          className={styles.toggleButton}
          onClick={() => setShowSheet(!showSheet)}
          title="Plus"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>

      {/* Bottom sheet */}
      <div
        className={`${styles.bottomSheet} ${showSheet ? styles.bottomSheetOpen : ''}`}
        style={showSheet && swipeY > 0 ? { transform: `translateY(${swipeY}px)` } : undefined}
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
      >
        <div className={styles.sheetHandle} />

        {/* Phrase selection */}
        {phraseMeasureRanges && phraseMeasureRanges.length > 0 && (
          <div className={styles.sheetSection}>
            <div className={styles.sheetLabel}>Phrases</div>
            <div className={styles.phraseChipsRow}>
              {phraseMeasureRanges.map((phrase, idx) => (
                <button
                  key={idx}
                  className={`${styles.phraseChip} ${selectedPhraseIndex === String(idx) ? styles.sheetButtonActive : ''}`}
                  onClick={() => {
                    onPhraseSelect({ target: { value: String(idx) } });
                    setShowSheet(false);
                  }}
                >
                  {phrase.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metronome */}
        <div className={styles.sheetSection}>
          <div className={styles.sheetLabel}>Metronome</div>
          <div className={styles.sheetRow}>
            <button
              className={`${styles.sheetButton} ${isMetronomeOn ? styles.sheetButtonActive : ''}`}
              onClick={() => setIsMetronomeOn(!isMetronomeOn)}
            >
              {isMetronomeOn ? 'Metronome ON' : 'Metronome OFF'}
            </button>
          </div>
        </div>

        {/* Visual Effects */}
        {setVisualEffects && (
          <div className={styles.sheetSection}>
            <div className={styles.sheetLabel}>Effets visuels</div>
            <div className={styles.sheetRow}>
              <button
                className={`${styles.sheetButton} ${visualEffects ? styles.sheetButtonActive : ''}`}
                onClick={() => setVisualEffects(!visualEffects)}
              >
                {visualEffects ? 'Effets ON' : 'Effets OFF (perf)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
