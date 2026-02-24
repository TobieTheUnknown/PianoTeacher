import React, { memo } from 'react';
import styles from './SynthesiaView.module.css';

/**
 * Composant mémorisé pour les contrôles de SynthesiaView
 * Évite les re-renders inutiles quand seul le canvas change
 */
const SynthesiaControls = memo(({
  // Playback controls
  isPlaying,
  onPlayPause,
  onReset,
  currentTime,

  // Mode controls
  handMode,
  setHandMode,
  waitMode,
  setWaitMode,
  freePlayMode,
  setFreePlayMode,

  // Metronome
  isMetronomeOn,
  setIsMetronomeOn,
  metronomeDivision,
  setMetronomeDivision,

  // Tempo
  currentBPM,
  defaultBPM,
  onTempoChange,

  // Loop controls
  selectedPhraseIndex,
  // eslint-disable-next-line no-unused-vars
  setSelectedPhraseIndex,
  customRangeStart,
  setCustomRangeStart,
  customRangeEnd,
  setCustomRangeEnd,
  isLoopEnabled,
  loopConfig,
  phraseMeasureRanges,
  totalMeasures,
  onPhraseSelect,
  onCustomRangeLoop,
  onClearLoop
}) => {
  const snapTempo = (value) => {
    const snapPoints = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const bpmSnapPoints = snapPoints.map(p => Math.round(defaultBPM * p));

    let closest = bpmSnapPoints[0];
    let minDiff = Math.abs(value - closest);

    for (let snapBPM of bpmSnapPoints) {
      const diff = Math.abs(value - snapBPM);
      if (diff < minDiff) {
        minDiff = diff;
        closest = snapBPM;
      }
    }

    return closest;
  };

  const handleTempoSliderChange = (e) => {
    const value = parseInt(e.target.value);
    const snapped = snapTempo(value);
    onTempoChange(snapped);
  };

  return (
    <>
      {/* Metronome and Tempo Controls */}
      <div className={styles.controlsPanel}>
        {/* Metronome Section */}
        <div className={styles.metronomeSection}>
          <button
            onClick={() => setIsMetronomeOn(!isMetronomeOn)}
            className={`${styles.metronomeButton} ${isMetronomeOn ? styles.active : ''}`}
            title="Métronome"
          >
            ⏰
          </button>

          {isMetronomeOn && (
            <div className={styles.metronomeDivisions}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
                Division:
              </span>
              {['measure', 'half-measure', 'beat'].map((division, idx) => {
                const labels = ['1', '1/2', '1/4'];
                return (
                  <button
                    key={division}
                    onClick={() => setMetronomeDivision(division)}
                    className={`${styles.divisionButton} ${metronomeDivision === division ? styles.active : ''}`}
                  >
                    {labels[idx]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tempo Section */}
        <div className={styles.tempoSection}>
          <span className={styles.tempoLabel}>
            Tempo:
          </span>
          <input
            type="range"
            min={Math.round(defaultBPM * 0.25)}
            max={Math.round(defaultBPM * 2)}
            value={currentBPM}
            onChange={handleTempoSliderChange}
            className={styles.tempoSlider}
          />
          <span className={styles.tempoDisplay}>
            {currentBPM} BPM ({Math.round((currentBPM / defaultBPM) * 100)}%)
          </span>
        </div>
      </div>

      {/* Main Controls */}
      <div className={styles.mainControls}>
        <div className={styles.leftControls}>
          <button
            onClick={onPlayPause}
            className={styles.playButton}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Jouer'}
          </button>

          <button
            onClick={onReset}
            className={styles.resetButton}
          >
            🔄 Recommencer
          </button>

          <button
            onClick={() => setHandMode(handMode === 'watch' ? 'both' : 'watch')}
            className={`${styles.modeButton} ${handMode === 'watch' ? styles.active : ''}`}
            title="Basculer entre mode écoute et mode pratique"
          >
            {handMode === 'watch' ? '👀 Écoute' : '🎹 Pratique'}
          </button>

          <button
            onClick={() => setWaitMode(!waitMode)}
            className={`${styles.modeButton} ${waitMode ? styles.active : ''}`}
          >
            {waitMode ? '⏸️ Attente' : '⏸️ Continue'}
          </button>

          <button
            onClick={() => setFreePlayMode(!freePlayMode)}
            className={`${styles.modeButton} ${freePlayMode ? styles.active : ''}`}
            title="Mode libre : jouez sans contrainte, pas de notes manquées"
          >
            {freePlayMode ? '🎵 Libre' : '🎯 Guidé'}
          </button>
        </div>

        {/* Hand Selection */}
        {handMode !== 'watch' && (
          <div className={styles.handSelection}>
            <span className={styles.handLabel}>
              Main:
            </span>
            <div className={styles.handButtons}>
              {['left', 'both', 'right'].map((hand) => {
                const labels = { left: 'Gauche', both: 'Les deux', right: 'Droite' };
                return (
                  <button
                    key={hand}
                    onClick={() => setHandMode(hand)}
                    className={`${styles.handButton} ${handMode === hand ? styles.active : ''}`}
                  >
                    {labels[hand]}
                  </button>
                );
              })}
            </div>

            <div className={styles.timeDisplay}>
              {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
            </div>
          </div>
        )}
      </div>

      {/* Navigation & Loop Controls */}
      <div className={styles.navigationControls}>
        {/* Phrase Selector */}
        <div className={styles.phraseSelector}>
          <label className={styles.selectorLabel}>
            Phrase / Section
          </label>
          <select
            value={selectedPhraseIndex}
            onChange={onPhraseSelect}
            className={styles.select}
          >
            <option value="">Sélectionner une phrase...</option>
            {phraseMeasureRanges.map((phrase, index) => (
              <option key={index} value={index}>
                {phrase.name} (mesures {phrase.startMeasure}-{phrase.endMeasure})
              </option>
            ))}
            <option value="custom">--- Range personnalisé ---</option>
          </select>
        </div>

        {/* Custom Range Selector */}
        {selectedPhraseIndex === 'custom' && (
          <>
            <div className={styles.customRangeInputs}>
              <label className={styles.selectorLabel}>
                De la mesure
              </label>
              <input
                type="number"
                min="1"
                max={totalMeasures}
                value={customRangeStart}
                onChange={(e) => setCustomRangeStart(e.target.value)}
                placeholder="1"
                className={styles.rangeInput}
              />
            </div>
            <div className={styles.customRangeInputs}>
              <label className={styles.selectorLabel}>
                À la mesure
              </label>
              <input
                type="number"
                min={customRangeStart || "1"}
                max={totalMeasures}
                value={customRangeEnd}
                onChange={(e) => setCustomRangeEnd(e.target.value)}
                placeholder={totalMeasures.toString()}
                className={styles.rangeInput}
              />
            </div>
            <button
              onClick={onCustomRangeLoop}
              disabled={!customRangeStart || !customRangeEnd}
              className={styles.loopButton}
            >
              🔁 Loop
            </button>
          </>
        )}

        {/* Clear Loop Button */}
        {isLoopEnabled && (
          <button
            onClick={onClearLoop}
            className={styles.clearLoopButton}
          >
            ❌ Arrêter
          </button>
        )}

        {/* Current Loop Info */}
        {isLoopEnabled && loopConfig && (
          <div className={styles.loopInfo}>
            🔁 {loopConfig.name || `Mesures ${loopConfig.startMeasure}-${loopConfig.endMeasure}`}
          </div>
        )}
      </div>
    </>
  );
});

SynthesiaControls.displayName = 'SynthesiaControls';

export default SynthesiaControls;
