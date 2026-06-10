import React, { useEffect, useCallback, useRef, memo, useState, useMemo } from 'react';
import { useCanvasLayers } from '../hooks/useCanvasLayers';
import { getFrenchNoteName } from '../models/song';
import themeService from '../services/ThemeService';
import styles from './LivePlayView.module.css';

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
 * LivePlay canvas — render loop architecture
 *
 * The playhead time is read from `timeRef` (a mutable ref owned by the view's
 * timing loop) INSIDE the rAF callback, so the canvas renders at full display
 * refresh without a single React re-render per frame. Event-rate props
 * (pressed keys, played-note statuses, feedback) are mirrored into `liveRef`
 * on each render and read from there by the draw functions — this keeps the
 * draw callbacks referentially stable so the rAF loop is mounted once, not
 * torn down per frame.
 *
 * Particle physics and other animations are scaled by deltaTime so they run
 * at identical speed on 60Hz and 120Hz displays.
 */
const LivePlayCanvas = memo(({
  timeRef,
  activeNotes,
  playedNotes,
  feedbackMessages,
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
  const isMobile = !!mobileKeyRange;
  const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  const keyboardRatio = aspectRatio < 1.0 ? 0.10 : 0.12; // compact keyboard
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
  } = useCanvasLayers(CANVAS_WIDTH, CANVAS_HEIGHT, { forceDpr: isMobile ? 1 : undefined });

  // Event-rate props mirrored for the rAF loop (assigned every render — the
  // draw functions read the latest values without depending on them).
  const liveRef = useRef({});
  liveRef.current = {
    activeNotes,
    playedNotes,
    feedbackMessages,
    sessionStats,
    isLoopEnabled,
    loopConfig,
    song,
  };

  const particlesRef = useRef([]);
  const prevActiveNotesObjRef = useRef(null);
  const prevActivePitchesRef = useRef(new Set());
  const visibleStartIdxRef = useRef(0);
  const lastDrawnTimeRef = useRef(-1);

  // Longest note duration (beats) — used to advance the visible-window
  // pointer without ever skipping a long note that is still on screen.
  const maxDurBeats = useMemo(
    () => allNotes.reduce((m, n) => Math.max(m, n.duration || 0), 0),
    [allNotes]
  );

  // Pre-compute consecutive repetition counts (cached, not per-frame)
  const { repeatCount, skipLabel } = useMemo(() => {
    const rc = new Map();
    const sl = new Set();
    const EPSILON = 0.01;
    for (let i = 0; i < allNotes.length; i++) {
      if (sl.has(allNotes[i].id)) continue;
      let count = 1;
      let j = i + 1;
      while (j < allNotes.length) {
        const curr = allNotes[j - 1];
        const next = allNotes[j];
        if (next.pitch !== allNotes[i].pitch || next.hand !== allNotes[i].hand) break;
        const currEnd = curr.startTime + curr.duration;
        if (Math.abs(next.startTime - currEnd) > EPSILON) break;
        sl.add(next.id);
        count++;
        j++;
      }
      if (count > 1) rc.set(allNotes[i].id, count);
    }
    return { repeatCount: rc, skipLabel: sl };
  }, [allNotes]);

  // Pre-compute getNoteX lookup table
  const noteXCache = useMemo(() => {
    const cache = new Map();
    for (let i = firstKey; i <= lastKey; i++) {
      const noteInOctave = i % 12;
      const isBlk = [1, 3, 6, 8, 10].includes(noteInOctave);
      let whiteKeyIdx = 0;
      for (let k = firstKey; k < i; k++) {
        if (![1, 3, 6, 8, 10].includes(k % 12)) whiteKeyIdx++;
      }
      if (!isBlk) {
        cache.set(i, whiteKeyIdx * WHITE_KEY_WIDTH);
      } else {
        const bkw = WHITE_KEY_WIDTH * 0.65;
        cache.set(i, (whiteKeyIdx * WHITE_KEY_WIDTH) - (bkw / 2));
      }
    }
    return cache;
  }, [firstKey, lastKey, WHITE_KEY_WIDTH]);

  // Subscribe to hand color changes from ThemeService (theme editor support)
  const [handColors, setHandColors] = useState(() => themeService.getColors());

  useEffect(() => {
    const unsubscribe = themeService.addListener((colors) => {
      setHandColors(colors);
      markDynamicDirty(); // Force redraw when colors change
    });
    return unsubscribe;
  }, [markDynamicDirty]);

  // Colors object (only changes when handColors change)
  const dynamicColors = useMemo(() => ({
    ...STATIC_COLORS,
    rightHand: handColors.rightHand.primary,
    rightHandLight: handColors.rightHand.light,
    rightHandDark: handColors.rightHand.dark,
    leftHand: handColors.leftHand.primary,
    leftHandLight: handColors.leftHand.light,
    leftHandDark: handColors.leftHand.dark,
    // Key pressed colors based on hands
    whiteKeyPressed: handColors.leftHand.light, // Default to left hand for freeplay
    blackKeyPressed: handColors.leftHand.dark,
  }), [handColors]);

  // Pre-compute darkened colors for black key notes (avoid hex parsing per frame)
  const darkenedColors = useMemo(() => {
    const darken = (color, amount = 0.35) => {
      if (!color.startsWith('#')) return color;
      const hex = color.replace('#', '');
      let r = parseInt(hex.substring(0, 2), 16);
      let g = parseInt(hex.substring(2, 4), 16);
      let b = parseInt(hex.substring(4, 6), 16);
      r = Math.floor(r * (1 - amount));
      g = Math.floor(g * (1 - amount));
      b = Math.floor(b * (1 - amount));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    return {
      rightHand: darken(handColors.rightHand.primary),
      leftHand: darken(handColors.leftHand.primary),
    };
  }, [handColors]);

  // Helper functions
  const isBlackKey = useCallback((midiNote) => {
    const noteInOctave = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave);
  }, []);

  const getNoteX = useCallback((midiNote) => {
    return noteXCache.get(midiNote) ?? null;
  }, [noteXCache]);

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

  // Build pitch→hand map for notes near `time` (called once per frame,
  // starting from the visible-window pointer — no full-array scan).
  const buildHandMap = useCallback((time, fromIdx) => {
    const map = new Map();
    const lookBehind = 0.5;
    for (let j = fromIdx; j < allNotes.length; j++) {
      const n = allNotes[j];
      const ns = n.startTime / beatsPerSecond;
      if (ns > time + lookBehind) break;
      const ne = (n.startTime + n.duration) / beatsPerSecond;
      if (time >= ns - lookBehind && time <= ne + 0.1 && !map.has(n.pitch)) {
        map.set(n.pitch, n.hand);
      }
    }
    return map;
  }, [allNotes, beatsPerSecond]);

  const getKeyColor = useCallback((midiNote, isBlack, handMap) => {
    const { activeNotes: pressed, feedbackMessages: feedbacks } = liveRef.current;
    const isPressed = pressed.has(midiNote);
    const colors = dynamicColors;

    if (isPressed) {
      const recentFeedback = feedbacks.find(f => f.noteNum === midiNote);
      if (recentFeedback) {
        if (recentFeedback.type === 'correct') {
          return isBlack ? STATIC_COLORS.blackKeyCorrect : STATIC_COLORS.whiteKeyCorrect;
        } else if (recentFeedback.type === 'wrong') {
          return isBlack ? STATIC_COLORS.blackKeyWrong : STATIC_COLORS.whiteKeyWrong;
        }
      }

      const hand = handMap.get(midiNote);
      if (hand === 'right') {
        return isBlack ? colors.rightHandDark : colors.rightHandLight;
      } else if (hand === 'left') {
        return isBlack ? colors.leftHandDark : colors.leftHandLight;
      }

      return isBlack ? colors.blackKeyPressed : colors.whiteKeyPressed;
    }

    return isBlack ? STATIC_COLORS.blackKey : STATIC_COLORS.whiteKey;
  }, [dynamicColors]);

  // Draw static layer (grid, measure numbers, loop zone)
  const drawStaticLayer = useCallback((ctx, currentTime) => {
    const { song: songNow, isLoopEnabled: loopOn, loopConfig: loopCfg } = liveRef.current;
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;
    const lookAheadTime = 4;
    const beatsPerMeasure = 4;
    const currentBeat = currentTime * beatsPerSecond;
    const currentMeasure = Math.floor(currentBeat / beatsPerMeasure);
    const highlightedMeasures = new Set(songNow?.highlightedMeasures || []);
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

    // Vertical grid lines (white key separators)
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

    // Black key lanes (skip on mobile for perf)
    if (!isMobile) {
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
    }

    // Horizontal beat lines (mobile: measure lines only)
    ctx.strokeStyle = '#ffffff';
    const firstVisibleBeat = Math.ceil(visibleStartTime / secondsPerBeat);

    for (let beat = firstVisibleBeat; beat * secondsPerBeat < visibleEndTime; beat++) {
      const isMeasureLine = (beat % beatsPerMeasure) === 0;
      if (isMobile && !isMeasureLine) continue; // Skip beat subdivisions on mobile

      const beatTime = beat * secondsPerBeat;
      const timeDiff = beatTime - currentTime;
      const y = NOTE_FALL_HEIGHT * (1 - timeDiff / lookAheadTime);

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

    // Measure numbers (skip on mobile)
    if (isMobile) {
      ctx.globalAlpha = 1.0;
      // Skip loop zone on mobile too (handled by overlay)
      return;
    }
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
    if (loopOn && loopCfg) {
      const bpm = 4;
      const startMeasure = loopCfg.startMeasure - 1;
      const endMeasure = loopCfg.endMeasure;

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
  }, [beatsPerSecond, isBlackKey, getNoteX, CANVAS_WIDTH, CANVAS_HEIGHT, KEYBOARD_HEIGHT, NOTE_FALL_HEIGHT, WHITE_KEY_WIDTH, fontScale, firstKey, lastKey, isMobile]);

  // Draw dynamic layer (falling notes, keyboard) - changes every frame
  const drawDynamicLayer = useCallback((ctx, currentTime, visibleStartIdx) => {
    const { activeNotes: pressed, playedNotes: played } = liveRef.current;
    const lookAheadTime = 4;
    const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    const noteColors = dynamicColors;
    const handMap = buildHandMap(currentTime, visibleStartIdx);

    // Spawn particles on newly activated notes (only when effects enabled,
    // desktop only). Set rebuilds only when the activeNotes object changed.
    if (visualEffects && !isMobile) {
      if (pressed !== prevActiveNotesObjRef.current) {
        pressed.forEach(midi => {
          if (!prevActivePitchesRef.current.has(midi)) {
            const nx = getNoteX(midi);
            if (nx !== null) {
              const isBlack = isBlackKey(midi);
              const nw = isBlack ? WHITE_KEY_WIDTH * 0.5 : WHITE_KEY_WIDTH - 2;
              const hand = handMap.get(midi);
              const pColor = (hand === 'right') ? noteColors.rightHand : noteColors.leftHand;
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
        prevActiveNotesObjRef.current = pressed;
        prevActivePitchesRef.current = new Set(pressed);
      }
    }

    // Set font once for all note labels
    const noteFontSize = Math.round(12 * fontScale);
    const noteSmallFontSize = Math.round(10 * fontScale);
    ctx.textAlign = 'center';

    for (let ni = visibleStartIdx; ni < allNotes.length; ni++) {
      const note = allNotes[ni];
      const noteStartTime = note.startTime / beatsPerSecond;
      if (noteStartTime > currentTime + lookAheadTime) break; // sorted: rest is later
      const noteEndTime = (note.startTime + note.duration) / beatsPerSecond;

      if (noteEndTime < currentTime - 0.5) {
        continue;
      }

      const x = getNoteX(note.pitch);
      if (x === null) continue;

      const startY = NOTE_FALL_HEIGHT * (1 - (noteStartTime - currentTime) / lookAheadTime);
      const endY = NOTE_FALL_HEIGHT * (1 - (noteEndTime - currentTime) / lookAheadTime);
      const height = Math.max(startY - endY, 5);

      if (endY < 0 && startY < 0) continue;

      const playStatus = played.get(note.id);

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
        color = isMobile
          ? (note.hand === 'right' ? darkenedColors.rightHand : darkenedColors.leftHand)
          : darkenColor(color, 0.35);
      }

      ctx.globalAlpha = (playStatus === 'correct' || playStatus === 'auto') ? 0.3 : 0.9;

      ctx.fillStyle = color;

      if (isMobile) {
        // Simple rectangles on mobile — no rounded corners, no stroke
        ctx.fillRect(noteX, endY, noteWidth, height);
      } else {
        const radius = Math.max(4, 6 * fontScale);
        if (visualEffects && (playStatus === 'correct' || playStatus === 'auto')) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = color;
        }
        drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
        ctx.stroke();
      }

      ctx.globalAlpha = 1.0;

      // Note labels — skip entirely on mobile for performance
      if (height > (isMobile ? 20 : 15) * fontScale && !skipLabel.has(note.id)) {
        ctx.fillStyle = '#ffffff';
        const baseName = getFrenchNoteName(note.pitch).replace(/[0-9-]/g, '');
        const rpt = repeatCount.get(note.id);
        const label = rpt ? `${baseName} x${rpt}` : baseName;
        ctx.font = `bold ${rpt ? noteSmallFontSize : noteFontSize}px Arial`;
        ctx.fillText(label, noteX + noteWidth / 2, endY + height / 2 + 4 * fontScale);
      }
    }

    // Helper: rounded bottom corners only (top sharp, bottom rounded)
    const drawKeyShape = isMobile ? null : (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.closePath();
    };

    const blackKeyHeight = KEYBOARD_HEIGHT * 0.42;

    // Keyboard - white keys
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(12 * fontScale)}px Arial`;

    for (let i = firstKey; i <= lastKey; i++) {
      if (!isBlackKey(i)) {
        const x = getNoteX(i);
        if (x === null) continue;
        const keyColor = getKeyColor(i, false, handMap);
        const isPressed = pressed.has(i);

        ctx.fillStyle = keyColor;

        if (isMobile) {
          ctx.fillRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);
          ctx.strokeStyle = '#cbd0d8';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, keyboardY + 0.5, WHITE_KEY_WIDTH - 2, KEYBOARD_HEIGHT - 1);
          ctx.fillStyle = isPressed ? '#ffffff' : '#555';
          const label = getFrenchNoteName(i).replace(/[0-9-]/g, '');
          ctx.fillText(label, x + WHITE_KEY_WIDTH / 2, keyboardY + KEYBOARD_HEIGHT - 10 * fontScale);
        } else {
          if (isPressed && visualEffects) {
            const hand = handMap.get(i);
            ctx.shadowColor = hand === 'right' ? noteColors.rightHandLight : noteColors.leftHandLight;
            ctx.shadowBlur = 18;
          }
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
    }

    // Keyboard - black keys
    for (let i = firstKey; i <= lastKey; i++) {
      if (isBlackKey(i)) {
        const x = getNoteX(i);
        if (x === null) continue;
        const keyColor = getKeyColor(i, true, handMap);

        ctx.fillStyle = keyColor;

        if (isMobile) {
          ctx.fillRect(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight);
          ctx.strokeStyle = '#0a0c10';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, keyboardY + 0.5, BLACK_KEY_WIDTH - 1, blackKeyHeight - 1);
        } else {
          const isPressed = pressed.has(i);
          if (isPressed && visualEffects) {
            const hand = handMap.get(i);
            ctx.shadowColor = hand === 'right' ? noteColors.rightHandDark : noteColors.leftHandDark;
            ctx.shadowBlur = 14;
          }
          drawKeyShape(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight, 3 * fontScale);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1;
          drawKeyShape(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight, 3 * fontScale);
          ctx.stroke();

          ctx.fillStyle = isPressed ? '#ffffff' : '#ccc';
          ctx.font = `${Math.round(10 * fontScale)}px Arial`;
          const label = getFrenchNoteName(i).replace(/[0-9-]/g, '');
          ctx.fillText(label, x + BLACK_KEY_WIDTH / 2, keyboardY + blackKeyHeight - 8 * fontScale);
        }
      }
    }

    // Hit line — simple on mobile
    if (!isMobile && visualEffects) {
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
  }, [allNotes, beatsPerSecond, getNoteX, isBlackKey, getKeyColor, darkenColor, darkenedColors, drawRoundedRect, dynamicColors, buildHandMap, CANVAS_WIDTH, CANVAS_HEIGHT, KEYBOARD_HEIGHT, NOTE_FALL_HEIGHT, WHITE_KEY_WIDTH, fontScale, firstKey, lastKey, visualEffects, isMobile, repeatCount, skipLabel]);

  // Draw overlay layer (feedback, combo, particles)
  // dtFrames ≈ 1.0 at 60Hz, 0.5 at 120Hz — keeps animation speed identical
  // across display refresh rates.
  const drawOverlayLayer = useCallback((ctx, currentTime, dtFrames) => {
    // Skip overlay entirely on mobile — mobile overlay component handles UI
    if (isMobile) return;

    const { feedbackMessages: feedbacks, sessionStats: stats } = liveRef.current;
    const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Feedback messages
    feedbacks.forEach((feedback, index) => {
      const x = getNoteX(feedback.noteNum);
      if (x === null) return;

      const y = keyboardY - 60 * fontScale - (index * 35 * fontScale);
      const age = Date.now() - feedback.timestamp;
      const duration = feedback.accuracy === 'perfect' ? 1500 : 1000;
      const opacity = Math.max(0, 1 - age / duration);

      ctx.globalAlpha = opacity;

      let color = STATIC_COLORS.playedCorrect;
      let fontSize = Math.round(18 * fontScale);
      const fontWeight = 'bold';

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
    if (stats.currentCombo > 2) {
      const comboBoxWidth = 140 * fontScale;
      const comboBoxHeight = 70 * fontScale;
      const comboX = CANVAS_WIDTH - comboBoxWidth - 10;
      const comboY = 80 * fontScale;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(comboX - 20 * fontScale, comboY - 50 * fontScale, comboBoxWidth, comboBoxHeight);
      ctx.strokeStyle = stats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(comboX - 20 * fontScale, comboY - 50 * fontScale, comboBoxWidth, comboBoxHeight);

      ctx.textAlign = 'center';
      ctx.fillStyle = stats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';

      ctx.font = `bold ${Math.round(32 * fontScale)}px Arial`;
      ctx.fillText(`${stats.currentCombo}x`, comboX + comboBoxWidth / 2 - 20 * fontScale, comboY - 10 * fontScale);

      ctx.font = `bold ${Math.round(14 * fontScale)}px Arial`;
      ctx.fillText('COMBO', comboX + comboBoxWidth / 2 - 20 * fontScale, comboY + 5 * fontScale);
    }

    // Particles (only when effects enabled) — deltaTime-scaled physics
    if (visualEffects) {
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx * dtFrames;
        p.y += p.vy * dtFrames;
        p.vy += 0.2 * dtFrames;    // gravity
        p.life -= 0.028 * dtFrames;
        if (p.life <= 0) particles.splice(i, 1);
      }
    } else {
      // Clear particles when effects disabled
      particlesRef.current = [];
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }, [getNoteX, CANVAS_WIDTH, CANVAS_HEIGHT, KEYBOARD_HEIGHT, WHITE_KEY_WIDTH, fontScale, visualEffects, isMobile]);

  // Render loop — mounted once per layout/theme change, NOT per frame.
  // Reads timeRef each frame; skips drawing entirely when nothing changed
  // (paused, no animations) to save battery.
  useEffect(() => {
    let animationFrameId;
    let lastTs = 0;

    const render = (ts) => {
      const dt = lastTs > 0 ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / 60;
      lastTs = ts;
      const dtFrames = dt * 60; // 1.0 at 60Hz

      const time = timeRef?.current ?? 0;
      const timeChanged = time !== lastDrawnTimeRef.current;
      const hasParticles = particlesRef.current.length > 0;
      const hasFeedback = liveRef.current.feedbackMessages.length > 0;
      const dirty = needsRedraw.current;

      if (timeChanged || dirty.static || dirty.dynamic || dirty.overlay || hasParticles || hasFeedback) {
        // Advance the shared visible-window pointer (reset on backward seek)
        if (time < lastDrawnTimeRef.current) visibleStartIdxRef.current = 0;
        let v = visibleStartIdxRef.current;
        while (v < allNotes.length &&
          (allNotes[v].startTime + maxDurBeats) / beatsPerSecond < time - 0.5) v++;
        visibleStartIdxRef.current = v;

        if (isMobile) {
          // On mobile: draw everything into dynamic canvas only (single canvas, DPR=1)
          drawLayer('dynamic', (ctx) => {
            drawStaticLayer(ctx, time);
            drawDynamicLayer(ctx, time, v);
            drawOverlayLayer(ctx, time, dtFrames);
          });
          dirty.static = false;
          dirty.overlay = false;
        } else {
          if (timeChanged || dirty.static) drawLayer('static', (ctx) => drawStaticLayer(ctx, time));
          if (timeChanged || dirty.dynamic) drawLayer('dynamic', (ctx) => drawDynamicLayer(ctx, time, v));
          if (timeChanged || dirty.overlay || hasParticles || hasFeedback) {
            drawLayer('overlay', (ctx) => drawOverlayLayer(ctx, time, dtFrames));
          }
        }
        lastDrawnTimeRef.current = time;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [drawLayer, drawStaticLayer, drawDynamicLayer, drawOverlayLayer, isMobile, timeRef, needsRedraw, allNotes, beatsPerSecond, maxDurBeats]);

  // Mark layers dirty when event-rate props change so updates render even
  // while paused (the loop skips clean frames otherwise).
  useEffect(() => {
    markStaticDirty();
  }, [song, isLoopEnabled, loopConfig, markStaticDirty]);

  useEffect(() => {
    markDynamicDirty();
  }, [allNotes, playedNotes, activeNotes, markDynamicDirty]);

  useEffect(() => {
    markOverlayDirty();
  }, [feedbackMessages, sessionStats.currentCombo, activeNotes, markOverlayDirty]);

  return (
    <div className={styles.canvasContainer}>
      <div className={styles.canvasWrapper} ref={containerRef}>
        <canvas
          ref={staticLayerRef}
          className={styles.canvas}
          style={{ zIndex: 1, display: isMobile ? 'none' : undefined }}
        />
        <canvas
          ref={dynamicLayerRef}
          className={styles.canvas}
          style={{ zIndex: 2 }}
        />
        <canvas
          ref={overlayLayerRef}
          className={styles.canvas}
          style={{ zIndex: 3, display: isMobile ? 'none' : undefined }}
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.timeRef === nextProps.timeRef &&
    prevProps.activeNotes === nextProps.activeNotes &&
    prevProps.playedNotes === nextProps.playedNotes &&
    prevProps.feedbackMessages === nextProps.feedbackMessages &&
    prevProps.sessionStats.currentCombo === nextProps.sessionStats.currentCombo &&
    prevProps.allNotes === nextProps.allNotes &&
    prevProps.beatsPerSecond === nextProps.beatsPerSecond &&
    prevProps.song === nextProps.song &&
    prevProps.isLoopEnabled === nextProps.isLoopEnabled &&
    prevProps.loopConfig === nextProps.loopConfig &&
    prevProps.canvasWidth === nextProps.canvasWidth &&
    prevProps.canvasHeight === nextProps.canvasHeight &&
    prevProps.visualEffects === nextProps.visualEffects
  );
});

LivePlayCanvas.displayName = 'LivePlayCanvas';

export default LivePlayCanvas;
