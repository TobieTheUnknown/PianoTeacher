import React, { useEffect, useCallback, useRef, memo, useState, useMemo } from 'react';
import { useCanvasLayers } from '../hooks/useCanvasLayers';
import { getFrenchNoteName } from '../models/song';
import handColorsService from '../services/HandColorsService';
import styles from './SynthesiaView.module.css';

// Static color constants (non-hand colors)
const STATIC_COLORS = {
  background: '#1a1a1a',
  whiteKey: '#ffffff',
  blackKey: '#000000',
  whiteKeyCorrect: '#86efac',
  blackKeyCorrect: '#22c55e',
  whiteKeyWrong: '#fca5a5',
  blackKeyWrong: '#ef4444',
  playedCorrect: '#22c55e',
  playedWrong: '#ef4444',
  missed: '#f59e0b'
};

// Default canvas dimensions (used when no dynamic dimensions provided)
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

// Piano keyboard constants
const FIRST_KEY = 21;
const LAST_KEY = 108;

/**
 * Composant Canvas optimisé pour SynthesiaView
 * Utilise des layers séparés pour minimiser les redraws
 * Supports dynamic dimensions via canvasWidth/canvasHeight props
 */
const SynthesiaCanvas = memo(({
  currentTime,
  activeNotes,
  playedNotes,
  feedbackMessages,
  // eslint-disable-next-line no-unused-vars
  expectedNotes,
  allNotes,
  beatsPerSecond,
  song,
  isLoopEnabled,
  loopConfig,
  sessionStats,
  canvasWidth: propWidth,
  canvasHeight: propHeight,
  mobileKeyRange,
  visualEffects = false
}) => {
  // Use prop dimensions or defaults
  const CANVAS_WIDTH = propWidth || DEFAULT_WIDTH;
  const CANVAS_HEIGHT = propHeight || DEFAULT_HEIGHT;
  const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  const keyboardRatio = aspectRatio < 1.0 ? 0.12 : 0.1875; // portrait → reduce height
  const KEYBOARD_HEIGHT = CANVAS_HEIGHT * keyboardRatio;
  const NOTE_FALL_HEIGHT = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

  // Use mobile key range or full range
  const firstKey = mobileKeyRange ? mobileKeyRange[0] : FIRST_KEY;
  const lastKey = mobileKeyRange ? mobileKeyRange[1] : LAST_KEY;

  // Count white keys in range
  const whiteKeyCount = useMemo(() => {
    let count = 0;
    for (let i = firstKey; i <= lastKey; i++) {
      if (![1, 3, 6, 8, 10].includes(i % 12)) count++;
    }
    return count;
  }, [firstKey, lastKey]);

  const WHITE_KEY_WIDTH = CANVAS_WIDTH / whiteKeyCount;

  // Scale font sizes proportionally
  const fontScale = CANVAS_WIDTH / DEFAULT_WIDTH;

  const {
    containerRef,
    staticLayerRef,
    dynamicLayerRef,
    overlayLayerRef,
    drawLayer,
    markStaticDirty,
    markDynamicDirty,
    markOverlayDirty,
    needsRedraw
  } = useCanvasLayers(CANVAS_WIDTH, CANVAS_HEIGHT);

  const lastDrawTimeRef = useRef(0);
  const particlesRef = useRef([]);
  const prevActiveNotesRef = useRef(new Set());

  // Subscribe to hand color changes from HandColorsService
  const [handColors, setHandColors] = useState(() => handColorsService.getColors());

  useEffect(() => {
    const unsubscribe = handColorsService.addListener((colors) => {
      setHandColors(colors);
      markDynamicDirty(); // Force redraw when colors change
    });
    return unsubscribe;
  }, [markDynamicDirty]);

  // Function to get dynamic colors using the reactive state
  const getDynamicColors = useCallback(() => {
    return {
      ...STATIC_COLORS,
      // Hand colors from state (reactive)
      rightHand: handColors.rightHand.primary,
      rightHandLight: handColors.rightHand.light,
      rightHandDark: handColors.rightHand.dark,
      leftHand: handColors.leftHand.primary,
      leftHandLight: handColors.leftHand.light,
      leftHandDark: handColors.leftHand.dark,
      // Key pressed colors based on hands
      whiteKeyPressed: handColors.leftHand.light, // Default to left hand for freeplay
      blackKeyPressed: handColors.leftHand.dark,
    };
  }, [handColors]);

  // Helper functions
  const isBlackKey = useCallback((midiNote) => {
    const noteInOctave = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  }, []);

  const getNoteX = useCallback((midiNote) => {
    if (midiNote < firstKey || midiNote > lastKey) return null;

    let whiteKeyIdx = 0;
    for (let i = firstKey; i < midiNote; i++) {
      if (!isBlackKey(i)) whiteKeyIdx++;
    }

    const isNoteBlack = isBlackKey(midiNote);

    if (!isNoteBlack) {
      return whiteKeyIdx * WHITE_KEY_WIDTH;
    } else {
      const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
      return (whiteKeyIdx * WHITE_KEY_WIDTH) - (BLACK_KEY_WIDTH / 2);
    }
  }, [isBlackKey, firstKey, lastKey, WHITE_KEY_WIDTH]);

  const getKeyColor = useCallback((midiNote, isBlack) => {
    const isPressed = activeNotes.has(midiNote);
    const recentFeedback = feedbackMessages.find(f => f.noteNum === midiNote);
    const colors = getDynamicColors();

    if (isPressed && recentFeedback) {
      if (recentFeedback.type === 'correct') {
        return isBlack ? STATIC_COLORS.blackKeyCorrect : STATIC_COLORS.whiteKeyCorrect;
      } else if (recentFeedback.type === 'wrong') {
        return isBlack ? STATIC_COLORS.blackKeyWrong : STATIC_COLORS.whiteKeyWrong;
      }
    }

    if (isPressed) {
      // Find if this note is expected and determine which hand
      const lookAheadTime = 0.5;
      const expectedNote = allNotes.find(note => {
        const noteStartTime = note.startTime / beatsPerSecond;
        const noteEndTime = (note.startTime + note.duration) / beatsPerSecond;
        return note.pitch === midiNote &&
               currentTime >= noteStartTime - lookAheadTime &&
               currentTime <= noteEndTime + 0.1;
      });

      if (expectedNote) {
        if (expectedNote.hand === 'right') {
          return isBlack ? colors.rightHandDark : colors.rightHandLight;
        } else {
          return isBlack ? colors.leftHandDark : colors.leftHandLight;
        }
      }

      return isBlack ? colors.blackKeyPressed : colors.whiteKeyPressed;
    }

    return isBlack ? STATIC_COLORS.blackKey : STATIC_COLORS.whiteKey;
  }, [activeNotes, feedbackMessages, allNotes, beatsPerSecond, currentTime, getDynamicColors]);

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
    const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;

    // Alternating measure bands (scroll with notes)
    const visibleStartTime = currentTime;
    const visibleEndTime = currentTime + lookAheadTime;
    const secondsPerBeat = 1 / beatsPerSecond;
    const firstVisibleMeasure = currentMeasure;
    const lastVisibleMeasure = Math.ceil(visibleEndTime * beatsPerSecond / beatsPerMeasure);

    for (let measure = firstVisibleMeasure; measure <= lastVisibleMeasure; measure++) {
      const measureStartTime = (measure * beatsPerMeasure) / beatsPerSecond;
      const measureEndTime = ((measure + 1) * beatsPerMeasure) / beatsPerSecond;

      const topY = NOTE_FALL_HEIGHT * (1 - (measureEndTime - currentTime) / lookAheadTime);
      const bottomY = NOTE_FALL_HEIGHT * (1 - (measureStartTime - currentTime) / lookAheadTime);

      const clampedTop = Math.max(0, topY);
      const clampedBottom = Math.min(NOTE_FALL_HEIGHT, bottomY);

      if (clampedBottom > clampedTop) {
        if (measure % 2 === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.03;
          ctx.fillRect(0, clampedTop, CANVAS_WIDTH, clampedBottom - clampedTop);
        }
      }
    }
    ctx.globalAlpha = 1.0;

    // Vertical grid lines
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.1;

    for (let i = firstKey; i <= lastKey + 1; i++) {
      if (!isBlackKey(i)) {
        const x = getNoteX(i);
        if (x !== null) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, keyboardY);
        }
      }
    }
    ctx.stroke();

    // Black key lanes
    ctx.fillStyle = '#ffffff';

    for (let i = firstKey; i <= lastKey; i++) {
      if (isBlackKey(i)) {
        const x = getNoteX(i);
        if (x !== null) {
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
    }

    // Horizontal beat lines
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const firstVisibleBeat = Math.ceil(visibleStartTime / secondsPerBeat);

    for (let beat = firstVisibleBeat; beat * secondsPerBeat < visibleEndTime; beat++) {
      const beatTime = beat * secondsPerBeat;
      const timeDiff = beatTime - currentTime;
      const y = NOTE_FALL_HEIGHT * (1 - timeDiff / lookAheadTime);
      const isMeasureLine = (beat % beatsPerMeasure) === 0;

      if (y >= 0 && y <= NOTE_FALL_HEIGHT) {
        ctx.globalAlpha = isMeasureLine ? 0.5 : 0.15;
        ctx.lineWidth = isMeasureLine ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1.0;

    // Measure numbers
    ctx.textAlign = 'left';

    for (let measure = firstVisibleMeasure; measure <= lastVisibleMeasure; measure++) {
      const measureTime = (measure * beatsPerMeasure) / beatsPerSecond;
      const timeDiff = measureTime - currentTime;
      const y = NOTE_FALL_HEIGHT * (1 - timeDiff / lookAheadTime);

      if (y >= 0 && y <= NOTE_FALL_HEIGHT) {
        const measureNumber = measure + 1;
        const isHighlighted = highlightedMeasures.has(measureNumber);

        if (isHighlighted) {
          ctx.font = `bold ${Math.round(24 * fontScale)}px Arial`;
          ctx.fillStyle = '#60a5fa';
          ctx.globalAlpha = 0.9;
        } else {
          ctx.font = `bold ${Math.round(20 * fontScale)}px Arial`;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.25;
        }

        ctx.fillText(`${measureNumber}`, 20 * fontScale, y + 7);
      }
    }

    ctx.globalAlpha = 1.0;

    // Loop zone
    if (isLoopEnabled && loopConfig) {
      const bpm = 4;
      const startMeasure = loopConfig.startMeasure - 1;
      const endMeasure = loopConfig.endMeasure;

      const loopStartTime = (startMeasure * bpm) / beatsPerSecond;
      const loopEndTime = (endMeasure * bpm) / beatsPerSecond;

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
  }, [currentTime, beatsPerSecond, song, isLoopEnabled, loopConfig, isBlackKey, getNoteX, CANVAS_WIDTH, CANVAS_HEIGHT, KEYBOARD_HEIGHT, NOTE_FALL_HEIGHT, WHITE_KEY_WIDTH, fontScale, firstKey, lastKey]);

  // Draw dynamic layer (falling notes, keyboard) - changes every frame
  const drawDynamicLayer = useCallback((ctx) => {
    const lookAheadTime = 4;
    const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Falling notes
    const noteColors = getDynamicColors();

    // Spawn particles on newly activated notes (only when effects enabled)
    if (visualEffects) {
      activeNotes.forEach(midi => {
        if (!prevActiveNotesRef.current.has(midi)) {
          const nx = getNoteX(midi);
          if (nx !== null) {
            const isBlack = isBlackKey(midi);
            const nw = isBlack ? WHITE_KEY_WIDTH * 0.5 : WHITE_KEY_WIDTH - 2;
            const noteData = allNotes.find(n => n.pitch === midi);
            const pColor = (noteData?.hand === 'right') ? noteColors.rightHand : noteColors.leftHand;
            for (let j = 0; j < 7; j++) {
              particlesRef.current.push({
                x: nx + nw / 2 + (Math.random() - 0.5) * nw * 1.5,
                y: NOTE_FALL_HEIGHT,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 6 - 2,
                life: 1.0,
                radius: (Math.random() * 2 + 1.5) * fontScale,
                color: pColor,
              });
            }
            if (particlesRef.current.length > 100) {
              particlesRef.current = particlesRef.current.slice(-100);
            }
          }
        }
      });
    }
    prevActiveNotesRef.current = new Set(activeNotes);

    // Pre-compute consecutive repetition counts for same pitch
    const repeatCount = new Map(); // noteId -> count (only first in sequence)
    const skipLabel = new Set();   // noteIds that are duplicates (hide label)
    const EPSILON = 0.01; // tolerance for "consecutive" (gap between end and next start)
    for (let i = 0; i < allNotes.length; i++) {
      if (skipLabel.has(allNotes[i].id)) continue;
      let count = 1;
      let j = i + 1;
      while (j < allNotes.length) {
        const curr = allNotes[j - 1];
        const next = allNotes[j];
        if (next.pitch !== allNotes[i].pitch || next.hand !== allNotes[i].hand) break;
        const currEnd = curr.startTime + curr.duration;
        if (Math.abs(next.startTime - currEnd) > EPSILON) break;
        skipLabel.add(next.id);
        count++;
        j++;
      }
      if (count > 1) repeatCount.set(allNotes[i].id, count);
    }

    allNotes.forEach(note => {
      const noteStartTime = note.startTime / beatsPerSecond;
      const noteEndTime = (note.startTime + note.duration) / beatsPerSecond;

      if (noteEndTime < currentTime - 1 || noteStartTime > currentTime + lookAheadTime) {
        return;
      }

      const x = getNoteX(note.pitch);
      if (x === null) return;

      const startY = NOTE_FALL_HEIGHT * (1 - (noteStartTime - currentTime) / lookAheadTime);
      const endY = NOTE_FALL_HEIGHT * (1 - (noteEndTime - currentTime) / lookAheadTime);
      const height = Math.max(startY - endY, 5);

      if (endY < 0 && startY < 0) return;

      const playStatus = playedNotes.get(note.id);

      let color = note.hand === 'right' ? noteColors.rightHand : noteColors.leftHand;

      if (playStatus === 'correct') {
        color = STATIC_COLORS.playedCorrect;
      } else if (playStatus === 'missed') {
        color = STATIC_COLORS.missed;
      } else if (playStatus === 'auto') {
        color = note.hand === 'right' ? noteColors.rightHandLight : noteColors.leftHandLight;
      }

      const isNoteBlack = isBlackKey(note.pitch);
      const noteWidth = isNoteBlack ? WHITE_KEY_WIDTH * 0.5 : WHITE_KEY_WIDTH - 2;
      const noteX = isNoteBlack ? x + (BLACK_KEY_WIDTH - noteWidth) / 2 : x + 1;

      if (isNoteBlack && playStatus !== 'correct' && playStatus !== 'missed') {
        color = darkenColor(color, 0.35);
      }

      if (playStatus === 'correct' || playStatus === 'auto') {
        ctx.globalAlpha = 0.3;
        if (visualEffects) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = color;
        }
      } else {
        ctx.globalAlpha = 0.9;
      }

      ctx.fillStyle = color;
      const radius = Math.max(4, 6 * fontScale);
      drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
      ctx.stroke();

      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      if (height > 15 * fontScale) {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        const baseName = getFrenchNoteName(note.pitch).replace(/[0-9-]/g, '');
        const rpt = repeatCount.get(note.id);
        const label = rpt ? `${baseName} x${rpt}` : (skipLabel.has(note.id) ? '' : baseName);
        if (label) {
          const fontSize = rpt ? Math.round(10 * fontScale) : Math.round(12 * fontScale);
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.save();
          ctx.beginPath();
          drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
          ctx.clip();
          ctx.fillText(label, noteX + noteWidth / 2, endY + height / 2 + 4 * fontScale);
          ctx.restore();
        }
      }
    });

    // Helper: rounded bottom corners only (top sharp, bottom rounded)
    const drawKeyShape = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.closePath();
    };

    // Keyboard - white keys
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(12 * fontScale)}px Arial`;

    for (let i = firstKey; i <= lastKey; i++) {
      if (!isBlackKey(i)) {
        const x = getNoteX(i);
        if (x === null) continue;
        const keyColor = getKeyColor(i, false);
        const isPressed = activeNotes.has(i);

        if (isPressed && visualEffects) {
          const pd = allNotes.find(n => n.pitch === i && Math.abs(n.startTime / beatsPerSecond - currentTime) < 0.6);
          ctx.shadowColor = pd?.hand === 'right' ? noteColors.rightHandLight : noteColors.leftHandLight;
          ctx.shadowBlur = 18;
        }

        ctx.fillStyle = keyColor;
        drawKeyShape(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT, 4 * fontScale);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        drawKeyShape(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT, 4 * fontScale);
        ctx.stroke();

        ctx.fillStyle = isPressed ? '#ffffff' : '#555';
        const label = getFrenchNoteName(i).replace(/[0-9-]/g, '');
        ctx.fillText(label, x + WHITE_KEY_WIDTH / 2, keyboardY + KEYBOARD_HEIGHT - 10 * fontScale);
      }
    }

    // Keyboard - black keys
    for (let i = firstKey; i <= lastKey; i++) {
      if (isBlackKey(i)) {
        const x = getNoteX(i);
        if (x === null) continue;
        const keyColor = getKeyColor(i, true);
        const isPressed = activeNotes.has(i);
        const blackKeyHeight = KEYBOARD_HEIGHT * 0.42;

        if (isPressed && visualEffects) {
          const pd = allNotes.find(n => n.pitch === i && Math.abs(n.startTime / beatsPerSecond - currentTime) < 0.6);
          ctx.shadowColor = pd?.hand === 'right' ? noteColors.rightHandDark : noteColors.leftHandDark;
          ctx.shadowBlur = 14;
        }

        ctx.fillStyle = keyColor;
        drawKeyShape(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight, 3 * fontScale);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        drawKeyShape(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight, 3 * fontScale);
        ctx.stroke();

        ctx.fillStyle = isPressed ? '#ffffff' : '#ccc';
        ctx.font = `${Math.round(10 * fontScale)}px Arial`;
        const label = getFrenchNoteName(i);
        const shortLabel = label.replace(/[0-9-]/g, '');
        ctx.fillText(shortLabel, x + BLACK_KEY_WIDTH / 2, keyboardY + blackKeyHeight - 8 * fontScale);
      }
    }

    // Hit line
    if (visualEffects) {
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
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, keyboardY);
    ctx.lineTo(CANVAS_WIDTH, keyboardY);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }, [currentTime, allNotes, beatsPerSecond, playedNotes, activeNotes, getNoteX, isBlackKey, getKeyColor, darkenColor, drawRoundedRect, getDynamicColors, CANVAS_WIDTH, CANVAS_HEIGHT, KEYBOARD_HEIGHT, NOTE_FALL_HEIGHT, WHITE_KEY_WIDTH, fontScale, firstKey, lastKey, visualEffects]);

  // Draw overlay layer (feedback, combo) - changes occasionally
  const drawOverlayLayer = useCallback((ctx) => {
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Feedback messages
    feedbackMessages.forEach((feedback, index) => {
      const x = getNoteX(feedback.noteNum);
      if (x === null) return;

      const y = keyboardY - 60 * fontScale - (index * 35 * fontScale);
      const age = Date.now() - feedback.timestamp;
      const duration = feedback.accuracy === 'perfect' ? 1500 : 1000;
      const opacity = Math.max(0, 1 - age / duration);

      ctx.globalAlpha = opacity;

      let color = STATIC_COLORS.playedCorrect;
      let fontSize = Math.round(18 * fontScale);
      let fontWeight = 'bold';

      if (feedback.type === 'correct') {
        if (feedback.accuracy === 'perfect') {
          color = '#fbbf24';
          fontSize = Math.round(22 * fontScale);
          if (visualEffects) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#fbbf24';
          }
        } else if (feedback.accuracy === 'good') {
          color = '#22c55e';
          fontSize = Math.round(20 * fontScale);
        }
      } else if (feedback.type === 'wrong') {
        color = STATIC_COLORS.playedWrong;
      } else if (feedback.type === 'freeplay') {
        color = '#60a5fa';
        fontSize = Math.round(16 * fontScale);
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
      const comboBoxWidth = 140 * fontScale;
      const comboBoxHeight = 70 * fontScale;
      const comboX = CANVAS_WIDTH - comboBoxWidth - 10;
      const comboY = 80 * fontScale;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(comboX - 20 * fontScale, comboY - 50 * fontScale, comboBoxWidth, comboBoxHeight);
      ctx.strokeStyle = sessionStats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(comboX - 20 * fontScale, comboY - 50 * fontScale, comboBoxWidth, comboBoxHeight);

      ctx.textAlign = 'center';
      ctx.fillStyle = sessionStats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';

      ctx.font = `bold ${Math.round(32 * fontScale)}px Arial`;
      ctx.fillText(`${sessionStats.currentCombo}x`, comboX + comboBoxWidth / 2 - 20 * fontScale, comboY - 10 * fontScale);

      ctx.font = `bold ${Math.round(14 * fontScale)}px Arial`;
      ctx.fillText('COMBO', comboX + comboBoxWidth / 2 - 20 * fontScale, comboY + 5 * fontScale);
    }

    // Particles (only when effects enabled)
    if (visualEffects) {
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;    // gravity
        p.life -= 0.028;
        if (p.life <= 0) particles.splice(i, 1);
      }
    } else {
      // Clear particles when effects disabled
      particlesRef.current = [];
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }, [feedbackMessages, sessionStats, getNoteX, CANVAS_WIDTH, CANVAS_HEIGHT, KEYBOARD_HEIGHT, WHITE_KEY_WIDTH, fontScale, visualEffects]);

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

      drawLayer('static', drawStaticLayer);
      drawLayer('dynamic', drawDynamicLayer);
      if (needsRedraw.current.overlay || (visualEffects && particlesRef.current.length > 0)) drawLayer('overlay', drawOverlayLayer);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [drawLayer, drawStaticLayer, drawDynamicLayer, drawOverlayLayer, visualEffects]);

  // Mark static layer dirty when relevant props change
  useEffect(() => {
    markStaticDirty();
  }, [song, isLoopEnabled, loopConfig, markStaticDirty]);

  // Mark dynamic layer dirty on every frame
  useEffect(() => {
    markDynamicDirty();
  }, [currentTime, allNotes, playedNotes, activeNotes, markDynamicDirty]);

  // Mark overlay dirty when feedback, combo, or active notes change (particles need update)
  useEffect(() => {
    markOverlayDirty();
  }, [feedbackMessages, sessionStats.currentCombo, activeNotes, markOverlayDirty]);

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
  return (
    prevProps.currentTime === nextProps.currentTime &&
    prevProps.activeNotes === nextProps.activeNotes &&
    prevProps.playedNotes === nextProps.playedNotes &&
    prevProps.feedbackMessages.length === nextProps.feedbackMessages.length &&
    prevProps.sessionStats.currentCombo === nextProps.sessionStats.currentCombo &&
    prevProps.isLoopEnabled === nextProps.isLoopEnabled &&
    prevProps.loopConfig === nextProps.loopConfig &&
    prevProps.canvasWidth === nextProps.canvasWidth &&
    prevProps.canvasHeight === nextProps.canvasHeight &&
    prevProps.visualEffects === nextProps.visualEffects
  );
});

SynthesiaCanvas.displayName = 'SynthesiaCanvas';

export default SynthesiaCanvas;
