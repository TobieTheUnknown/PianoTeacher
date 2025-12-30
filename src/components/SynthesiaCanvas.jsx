import React, { useEffect, useCallback, useRef, memo } from 'react';
import { useCanvasLayers } from '../hooks/useCanvasLayers';
import { getFrenchNoteName } from '../models/song';
import styles from './SynthesiaView.module.css';

// Color constants
const COLORS = {
  background: '#1a1a1a',
  whiteKey: '#ffffff',
  blackKey: '#000000',
  whiteKeyPressed: '#60a5fa',
  blackKeyPressed: '#3b82f6',
  whiteKeyCorrect: '#86efac',
  blackKeyCorrect: '#22c55e',
  whiteKeyWrong: '#fca5a5',
  blackKeyWrong: '#ef4444',
  rightHand: '#60a5fa',
  leftHand: '#f472b6',
  playedCorrect: '#22c55e',
  playedWrong: '#ef4444',
  missed: '#f59e0b'
};

// Canvas dimensions
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const KEYBOARD_HEIGHT = 150;
const NOTE_FALL_HEIGHT = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

// Piano keyboard constants
const FIRST_KEY = 21;
const LAST_KEY = 108;
const WHITE_KEY_WIDTH = CANVAS_WIDTH / 52;

/**
 * Composant Canvas optimisé pour SynthesiaView
 * Utilise des layers séparés pour minimiser les redraws
 */
const SynthesiaCanvas = memo(({
  currentTime,
  activeNotes,
  playedNotes,
  feedbackMessages,
  expectedNotes,
  allNotes,
  beatsPerSecond,
  song,
  isLoopEnabled,
  loopConfig,
  sessionStats
}) => {
  const {
    containerRef,
    staticLayerRef,
    dynamicLayerRef,
    overlayLayerRef,
    drawLayer,
    markStaticDirty,
    markDynamicDirty,
    markOverlayDirty
  } = useCanvasLayers(CANVAS_WIDTH, CANVAS_HEIGHT);

  const lastDrawTimeRef = useRef(0);

  // Helper functions
  const isBlackKey = useCallback((midiNote) => {
    const noteInOctave = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  }, []);

  const getNoteX = useCallback((midiNote) => {
    if (midiNote < FIRST_KEY || midiNote > LAST_KEY) return null;

    let whiteKeyCount = 0;
    for (let i = FIRST_KEY; i < midiNote; i++) {
      if (!isBlackKey(i)) whiteKeyCount++;
    }

    const isNoteBlack = isBlackKey(midiNote);

    if (!isNoteBlack) {
      return whiteKeyCount * WHITE_KEY_WIDTH;
    } else {
      const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
      return (whiteKeyCount * WHITE_KEY_WIDTH) - (BLACK_KEY_WIDTH / 2);
    }
  }, [isBlackKey]);

  const getKeyColor = useCallback((midiNote, isBlack) => {
    const isPressed = activeNotes.has(midiNote);
    const recentFeedback = feedbackMessages.find(f => f.noteNum === midiNote);

    if (isPressed && recentFeedback) {
      if (recentFeedback.type === 'correct') {
        return isBlack ? COLORS.blackKeyCorrect : COLORS.whiteKeyCorrect;
      } else if (recentFeedback.type === 'wrong') {
        return isBlack ? COLORS.blackKeyWrong : COLORS.whiteKeyWrong;
      }
    }

    if (isPressed) {
      return isBlack ? COLORS.blackKeyPressed : COLORS.whiteKeyPressed;
    }

    return isBlack ? COLORS.blackKey : COLORS.whiteKey;
  }, [activeNotes, feedbackMessages]);

  const darkenColor = useCallback((color, amount = 0.3) => {
    if (!color.startsWith('#')) return color;

    const hex = color.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.floor(r * (1 - amount));
    g = Math.floor(g * (1 - amount));
    b = Math.floor(b * (1 - amount));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }, []);

  const drawRoundedRect = useCallback((ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }, []);

  // Draw static layer (grid, measure numbers) - rarely changes
  const drawStaticLayer = useCallback((ctx) => {
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;
    const lookAheadTime = 4;
    const beatsPerMeasure = 4;
    const currentBeat = currentTime * beatsPerSecond;
    const currentMeasure = Math.floor(currentBeat / beatsPerMeasure);
    const highlightedMeasures = new Set(song.highlightedMeasures || []);

    // Vertical grid lines
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.1;

    for (let i = FIRST_KEY; i <= LAST_KEY + 1; i++) {
      if (!isBlackKey(i)) {
        const x = getNoteX(i);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, keyboardY);
      }
    }
    ctx.stroke();

    // Black key lanes
    const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
    ctx.fillStyle = '#ffffff';

    for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
      if (isBlackKey(i)) {
        const x = getNoteX(i);
        ctx.globalAlpha = 0.03;
        ctx.fillRect(x, 0, BLACK_KEY_WIDTH, keyboardY);

        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.05;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, keyboardY);
        ctx.moveTo(x + BLACK_KEY_WIDTH, 0);
        ctx.lineTo(x + BLACK_KEY_WIDTH, keyboardY);
        ctx.stroke();
      }
    }

    // Horizontal beat lines
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    const visibleStartTime = currentTime;
    const visibleEndTime = currentTime + lookAheadTime;
    const secondsPerBeat = 1 / beatsPerSecond;
    const firstVisibleBeat = Math.ceil(visibleStartTime / secondsPerBeat);

    for (let beat = firstVisibleBeat; beat * secondsPerBeat < visibleEndTime; beat++) {
      const beatTime = beat * secondsPerBeat;
      const timeDiff = beatTime - currentTime;
      const y = NOTE_FALL_HEIGHT * (1 - timeDiff / lookAheadTime);

      if (y >= 0 && y <= NOTE_FALL_HEIGHT) {
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
      }
    }

    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Measure numbers
    ctx.textAlign = 'left';
    const firstVisibleMeasure = currentMeasure;
    const lastVisibleMeasure = Math.ceil((currentTime + lookAheadTime) * beatsPerSecond / beatsPerMeasure);

    for (let measure = firstVisibleMeasure; measure <= lastVisibleMeasure; measure++) {
      const measureTime = (measure * beatsPerMeasure) / beatsPerSecond;
      const timeDiff = measureTime - currentTime;
      const y = NOTE_FALL_HEIGHT * (1 - timeDiff / lookAheadTime);

      if (y >= 0 && y <= NOTE_FALL_HEIGHT) {
        const measureNumber = measure + 1;
        const isHighlighted = highlightedMeasures.has(measureNumber);

        if (isHighlighted) {
          ctx.font = 'bold 24px Arial';
          ctx.fillStyle = '#60a5fa';
          ctx.globalAlpha = 0.9;
        } else {
          ctx.font = 'bold 20px Arial';
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.15;
        }

        ctx.fillText(`${measureNumber}`, 20, y + 7);
      }
    }

    ctx.globalAlpha = 1.0;

    // Loop zone
    if (isLoopEnabled && loopConfig) {
      const beatsPerMeasure = 4;
      const startMeasure = loopConfig.startMeasure - 1;
      const endMeasure = loopConfig.endMeasure;

      const loopStartTime = (startMeasure * beatsPerMeasure) / beatsPerSecond;
      const loopEndTime = (endMeasure * beatsPerMeasure) / beatsPerSecond;

      const startTimeDiff = loopStartTime - currentTime;
      const endTimeDiff = loopEndTime - currentTime;

      const startY = NOTE_FALL_HEIGHT * (1 - startTimeDiff / lookAheadTime);
      const endY = NOTE_FALL_HEIGHT * (1 - endTimeDiff / lookAheadTime);

      if (endY >= -50 && startY <= NOTE_FALL_HEIGHT + 50) {
        const rectStartY = Math.max(-10, endY);
        const rectEndY = Math.min(NOTE_FALL_HEIGHT + 10, startY);
        const rectHeight = rectEndY - rectStartY;

        if (rectHeight > 0) {
          ctx.fillStyle = '#3b82f6';
          ctx.globalAlpha = 0.08;
          ctx.fillRect(0, rectStartY, CANVAS_WIDTH, rectHeight);

          ctx.fillStyle = '#3b82f6';
          ctx.globalAlpha = 0.4;
          ctx.fillRect(0, rectStartY, 4, rectHeight);
          ctx.fillRect(CANVAS_WIDTH - 4, rectStartY, 4, rectHeight);

          ctx.globalAlpha = 0.6;
          ctx.fillRect(0, rectStartY, CANVAS_WIDTH, 2);
          ctx.fillRect(0, rectEndY - 2, CANVAS_WIDTH, 2);

          ctx.globalAlpha = 1.0;
        }
      }
    }
  }, [currentTime, beatsPerSecond, song, isLoopEnabled, loopConfig, isBlackKey, getNoteX]);

  // Draw dynamic layer (falling notes, keyboard) - changes every frame
  const drawDynamicLayer = useCallback((ctx) => {
    const lookAheadTime = 4;
    const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Falling notes
    allNotes.forEach(note => {
      const noteStartTime = note.startTime / beatsPerSecond;
      const noteEndTime = (note.startTime + note.duration) / beatsPerSecond;

      if (noteEndTime < currentTime - 1 || noteStartTime > currentTime + lookAheadTime) {
        return;
      }

      const playStatus = playedNotes.get(note.id);

      if ((playStatus === 'correct' || playStatus === 'auto') && currentTime > noteStartTime + 0.1) {
        // Optionally skip fully played notes for better performance
        // return;
      }

      const x = getNoteX(note.pitch);
      if (x === null) return;

      const startY = NOTE_FALL_HEIGHT * (1 - (noteStartTime - currentTime) / lookAheadTime);
      const endY = NOTE_FALL_HEIGHT * (1 - (noteEndTime - currentTime) / lookAheadTime);
      const height = Math.max(startY - endY, 5);

      if (endY < 0 && startY < 0) return;

      let color = note.hand === 'right' ? COLORS.rightHand : COLORS.leftHand;

      if (playStatus === 'correct') {
        color = COLORS.playedCorrect;
      } else if (playStatus === 'missed') {
        color = COLORS.missed;
      } else if (playStatus === 'auto') {
        color = note.hand === 'right' ? '#93c5fd' : '#f9a8d4';
      }

      const isNoteBlack = isBlackKey(note.pitch);
      const noteWidth = isNoteBlack ? WHITE_KEY_WIDTH * 0.5 : WHITE_KEY_WIDTH - 2;
      const noteX = isNoteBlack ? x + (BLACK_KEY_WIDTH - noteWidth) / 2 : x + 1;

      if (isNoteBlack && playStatus !== 'correct' && playStatus !== 'missed') {
        color = darkenColor(color, 0.35);
      }

      if (playStatus === 'correct' || playStatus === 'auto') {
        ctx.globalAlpha = 0.3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
      } else {
        ctx.globalAlpha = 0.8;
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = color;
      const radius = 6;
      drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
      ctx.stroke();

      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      if (height > 15) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const label = getFrenchNoteName(note.pitch).replace(/[0-9-]/g, '');
        ctx.save();
        ctx.beginPath();
        drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
        ctx.clip();
        ctx.fillText(label, noteX + noteWidth / 2, endY + height / 2 + 4);
        ctx.restore();
      }
    });

    // Keyboard - white keys
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';

    for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
      if (!isBlackKey(i)) {
        const x = getNoteX(i);
        const keyColor = getKeyColor(i, false);
        const isPressed = activeNotes.has(i);

        if (isPressed) {
          ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
          ctx.shadowBlur = 10;
        }

        ctx.fillStyle = keyColor;
        ctx.fillRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);

        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#cccccc';
        ctx.strokeRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);

        ctx.fillStyle = isPressed ? '#ffffff' : '#555';
        const label = getFrenchNoteName(i).replace(/[0-9-]/g, '');
        ctx.fillText(label, x + WHITE_KEY_WIDTH / 2, keyboardY + KEYBOARD_HEIGHT - 10);
      }
    }

    // Keyboard - black keys
    for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
      if (isBlackKey(i)) {
        const x = getNoteX(i);
        const keyColor = getKeyColor(i, true);
        const isPressed = activeNotes.has(i);
        const blackKeyHeight = KEYBOARD_HEIGHT * 0.65;

        if (isPressed) {
          ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
          ctx.shadowBlur = 10;
        }

        ctx.fillStyle = keyColor;
        ctx.fillRect(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight);

        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#333';
        ctx.strokeRect(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight);

        ctx.fillStyle = isPressed ? '#ffffff' : '#ccc';
        ctx.font = '10px Arial';
        const label = getFrenchNoteName(i);
        const shortLabel = label.replace(/[0-9-]/g, '');
        ctx.fillText(shortLabel, x + BLACK_KEY_WIDTH / 2, keyboardY + blackKeyHeight - 8);
      }
    }

    // Hit line
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, keyboardY);
    ctx.lineTo(CANVAS_WIDTH, keyboardY);
    ctx.stroke();

    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, keyboardY);
    ctx.lineTo(CANVAS_WIDTH, keyboardY);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }, [currentTime, allNotes, beatsPerSecond, playedNotes, activeNotes, getNoteX, isBlackKey, getKeyColor, darkenColor, drawRoundedRect]);

  // Draw overlay layer (feedback, combo) - changes occasionally
  const drawOverlayLayer = useCallback((ctx) => {
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Feedback messages
    feedbackMessages.forEach((feedback, index) => {
      const x = getNoteX(feedback.noteNum);
      if (x === null) return;

      const y = keyboardY - 60 - (index * 35);
      const age = Date.now() - feedback.timestamp;
      const duration = feedback.accuracy === 'perfect' ? 1500 : 1000;
      const opacity = Math.max(0, 1 - age / duration);

      ctx.globalAlpha = opacity;

      let color = COLORS.playedCorrect;
      let fontSize = 18;
      let fontWeight = 'bold';

      if (feedback.type === 'correct') {
        if (feedback.accuracy === 'perfect') {
          color = '#fbbf24';
          fontSize = 22;
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#fbbf24';
        } else if (feedback.accuracy === 'good') {
          color = '#22c55e';
          fontSize = 20;
        }
      } else if (feedback.type === 'wrong') {
        color = COLORS.playedWrong;
      } else if (feedback.type === 'freeplay') {
        color = '#60a5fa';
        fontSize = 16;
      }

      ctx.font = `${fontWeight} ${fontSize}px Arial`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(feedback.message, x + WHITE_KEY_WIDTH / 2, y);

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    });

    // Combo counter
    if (sessionStats.currentCombo > 2) {
      const comboX = CANVAS_WIDTH - 150;
      const comboY = 80;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(comboX - 20, comboY - 50, 140, 70);
      ctx.strokeStyle = sessionStats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(comboX - 20, comboY - 50, 140, 70);

      ctx.textAlign = 'center';
      ctx.fillStyle = sessionStats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';

      ctx.font = 'bold 32px Arial';
      ctx.fillText(`${sessionStats.currentCombo}x`, comboX + 50, comboY - 10);

      ctx.font = 'bold 14px Arial';
      ctx.fillText('COMBO', comboX + 50, comboY + 5);

      if (sessionStats.currentCombo >= 10) {
        const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fbbf24';
        ctx.fillText('🔥', comboX + 50, comboY - 25);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }
    }
  }, [feedbackMessages, sessionStats, getNoteX]);

  // Render loop with throttling for better performance
  useEffect(() => {
    let animationFrameId;

    const render = (timestamp) => {
      // Throttle to 60fps max
      if (timestamp - lastDrawTimeRef.current < 16) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      lastDrawTimeRef.current = timestamp;

      // Redraw static layer only when needed (time jumps, loop changes)
      drawLayer('static', drawStaticLayer);

      // Always redraw dynamic layer (notes, keyboard)
      drawLayer('dynamic', drawDynamicLayer);

      // Redraw overlay when feedback or combo changes
      drawLayer('overlay', drawOverlayLayer);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [drawLayer, drawStaticLayer, drawDynamicLayer, drawOverlayLayer]);

  // Mark static layer dirty when relevant props change
  useEffect(() => {
    markStaticDirty();
  }, [song, isLoopEnabled, loopConfig, markStaticDirty]);

  // Mark dynamic layer dirty on every frame
  useEffect(() => {
    markDynamicDirty();
  }, [currentTime, allNotes, playedNotes, activeNotes, markDynamicDirty]);

  // Mark overlay dirty when feedback or combo changes
  useEffect(() => {
    markOverlayDirty();
  }, [feedbackMessages, sessionStats.currentCombo, markOverlayDirty]);

  return (
    <div className={styles.canvasContainer}>
      <div className={styles.canvasWrapper} ref={containerRef}>
        <canvas
          ref={staticLayerRef}
          className={styles.canvas}
          style={{ zIndex: 1 }}
        />
        <canvas
          ref={dynamicLayerRef}
          className={styles.canvas}
          style={{ zIndex: 2 }}
        />
        <canvas
          ref={overlayLayerRef}
          className={styles.canvas}
          style={{ zIndex: 3 }}
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  // Only re-render if essential props change
  return (
    prevProps.currentTime === nextProps.currentTime &&
    prevProps.activeNotes === nextProps.activeNotes &&
    prevProps.playedNotes === nextProps.playedNotes &&
    prevProps.feedbackMessages.length === nextProps.feedbackMessages.length &&
    prevProps.sessionStats.currentCombo === nextProps.sessionStats.currentCombo &&
    prevProps.isLoopEnabled === nextProps.isLoopEnabled &&
    prevProps.loopConfig === nextProps.loopConfig
  );
});

SynthesiaCanvas.displayName = 'SynthesiaCanvas';

export default SynthesiaCanvas;
