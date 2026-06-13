import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import LivePlayCanvas from './LivePlayCanvas';
import { ScoreService } from '../services/ScoreService';
import { getFrenchNoteName } from '../models/song';
import { audioEngine } from '../services/AudioEngine';
import { midiInputService } from '../services/MidiInputService';
import { TimelineNavigator } from './TimelineNavigator';
import { LivePlayMobileOverlay } from './LivePlayMobileOverlay';
import { PlaybackDock } from './PlaybackDock';
import { RotatePrompt } from './RotatePrompt';
import { useDeviceContext } from '../hooks/useDeviceContext';
import { useWakeLock } from '../hooks/useWakeLock';
import { useFullscreen } from '../hooks/useFullscreen';
import styles from './LivePlayView.module.css';

/**
 * LivePlayView — timing core
 *
 * The song clock is anchored to the AUDIO clock (Tone.now()), not
 * performance.now(), so the visual playhead, the auto-played notes and the
 * metronome all share one time base and cannot drift apart.
 *
 * Per-frame work happens in a single rAF loop that reads/writes refs only:
 *  - auto-played notes and metronome clicks are scheduled ~120ms ahead at
 *    their exact audio-clock time (sample-accurate, no React-frame jitter)
 *  - miss detection / expected notes use monotonic pointers into the sorted
 *    note list (O(1) amortized per frame instead of O(n) scans)
 *  - React state for the UI (timeline, dock, stats) updates at ~10Hz; the
 *    canvas reads songTimeRef directly at display refresh rate.
 */

// Timing tolerances (LivePlay standard)
const PERFECT_TOLERANCE = 0.052; // ±52ms
const GOOD_TOLERANCE = 0.152; // ±152ms
const NOTE_TOLERANCE = 0.302; // ±302ms
const WAIT_MODE_THRESHOLD = 0.05;
const SCHEDULE_HORIZON = 0.12; // seconds of audio scheduled ahead each frame
const UI_UPDATE_INTERVAL_MS = 100; // throttled React clock for non-canvas UI

export function LivePlayViewOptimized({ song, onFullscreenChange, onBack }) {
  // ── Timing refs (mutated by the rAF loop, never trigger renders) ──────────
  const songTimeRef = useRef(0);          // position in real seconds at current BPM
  const clockRef = useRef(null);          // audio-clock fn for the play session
  const anchorRef = useRef(null);         // clock time at songTime == 0
  const pausedAtTimeRef = useRef(null);   // wait-mode pause position
  const processedNotesRef = useRef(new Set()); // note ids judged or scheduled
  const playedNotesRef = useRef(new Map());    // mirror of playedNotes state
  const expectedNotesRef = useRef(new Set());  // pitches the user should play now
  const autoVisualQueueRef = useRef([]);  // scheduled auto notes awaiting key visuals
  const autoIdxRef = useRef(0);           // pointer: auto-play scheduling
  const missIdxRef = useRef(0);           // pointer: miss detection
  const windowStartIdxRef = useRef(0);    // pointer: expected-notes window
  const nextClickIdxRef = useRef(-1);     // pointer: metronome clicks (-1 = recompute)
  const lastUiUpdateRef = useRef(0);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // throttled UI clock (~10Hz)
  const [currentBPM, setCurrentBPM] = useState(song?.tempo || 120);
  const [activeNotes, setActiveNotes] = useState(new Set());

  // Features state
  const [handMode, setHandMode] = useState('both');
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [metronomeDivision, setMetronomeDivision] = useState('quarter');
  const [loopEditorOpen, setLoopEditorOpen] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [loopConfig, setLoopConfig] = useState(null);
  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState('');

  // Scoring and wait mode state
  const [waitMode, setWaitMode] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    correctNotes: 0,
    wrongNotes: 0,
    missedNotes: 0,
    perfectNotes: 0,
    goodNotes: 0,
    totalNotes: 0,
    startTime: null,
    completed: false,
    currentCombo: 0,
    maxCombo: 0
  });
  const [playedNotes, setPlayedNotes] = useState(new Map());
  const [feedbackMessages, setFeedbackMessages] = useState([]);
  const [freePlayMode] = useState(false);
  const [visualEffects, setVisualEffects] = useState(false);

  // Mobile context
  const { isMobile, isLandscape } = useDeviceContext();
  const canvasContainerRef = useRef(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // ── Note-fall zoom (lookAheadTime) ────────────────────────────────────────
  const LOOKAHEAD_KEY = 'piano-teacher-liveplay-lookahead';
  const LOOKAHEAD_MIN = 2;
  const LOOKAHEAD_MAX = 10;
  const [lookAheadTime, setLookAheadTime] = useState(() => {
    const stored = localStorage.getItem(LOOKAHEAD_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return Math.min(LOOKAHEAD_MAX, Math.max(LOOKAHEAD_MIN, Math.round(parsed)));
    }
    return isMobile ? 5 : 2;
  });

  const changeLookAhead = useCallback((delta) => {
    setLookAheadTime(prev => {
      const next = Math.min(LOOKAHEAD_MAX, Math.max(LOOKAHEAD_MIN, prev + delta));
      localStorage.setItem(LOOKAHEAD_KEY, String(next));
      return next;
    });
  }, []);

  // Notify parent about fullscreen state for hiding tab bar
  useEffect(() => {
    if (isMobile) {
      onFullscreenChange?.(true);
      return () => onFullscreenChange?.(false);
    }
  }, [isMobile, onFullscreenChange]);

  // Calculate dynamic canvas dimensions on mobile
  // Dock height to reserve at bottom on mobile portrait. Landscape hides
  // the dock so the canvas can use the full viewport.
  const DOCK_HEIGHT_PORTRAIT = 130;

  useEffect(() => {
    if (!isMobile) {
      setCanvasDimensions({ width: 0, height: 0 }); // Use defaults
      return;
    }

    const updateDimensions = () => {
      const w = window.innerWidth;
      const fullH = window.innerHeight;
      // Subtract dock height in portrait so the keyboard sits above the dock.
      const h = isLandscape ? fullH : Math.max(0, fullH - DOCK_HEIGHT_PORTRAIT);
      setCanvasDimensions({ width: w, height: h });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isMobile, isLandscape]);

  // Mobile key range: C2 (36) to C7 (96) for wider keys
  const mobileKeyRange = isMobile ? [36, 96] : null;

  // Keep screen awake during playback
  useWakeLock(isPlaying);

  // Enter fullscreen on mobile LivePlay
  useFullscreen(isMobile);

  // Calculate beats per measure based on time signature
  const beatsPerMeasure = useMemo(() => {
    const ts = song?.timeSignature;
    if (!ts || !ts.numerator || !ts.denominator) {
      return 4;
    }
    return (ts.numerator / ts.denominator) * 4;
  }, [song?.timeSignature]);

  // Helper to convert note name to MIDI number
  const getMidiNumber = useCallback((noteName) => {
    if (typeof noteName === 'number') return noteName;
    if (!noteName) return null;

    const noteToOffset = {
      'C': 0, 'C#': 1, 'Db': 1,
      'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4,
      'F': 5, 'F#': 6, 'Gb': 6,
      'G': 7, 'G#': 8, 'Ab': 8,
      'A': 9, 'A#': 10, 'Bb': 10,
      'B': 11
    };

    try {
      let note, octave;
      if (isNaN(noteName[1])) {
        note = noteName.slice(0, 2);
        octave = parseInt(noteName.slice(2));
      } else {
        note = noteName[0];
        octave = parseInt(noteName.slice(1));
      }

      if (noteToOffset[note] !== undefined && !isNaN(octave)) {
        return 12 + (octave * 12) + noteToOffset[note];
      }
    } catch {
      console.warn('Invalid note name:', noteName);
    }
    return null;
  }, []);

  // Get all notes from song with timing information (sorted by startTime).
  // Ids are deterministic (phrase/track/index) so they survive recomputes.
  const allNotes = useMemo(() => {
    if (!song || !song.phrases || !Array.isArray(song.phrases)) {
      return [];
    }

    const notes = [];
    let phraseStart = 0;

    try {
      song.phrases.forEach((phrase, phraseIdx) => {
        if (!phrase) return;

        const pushTrack = (trackNotes, trackKey, hand) => {
          if (!Array.isArray(trackNotes)) return;
          trackNotes.forEach((note, noteIdx) => {
            const midiPitch = typeof note.pitch === 'number'
              ? note.pitch
              : getMidiNumber(note.pitch);
            if (midiPitch !== null) {
              notes.push({
                id: `${phraseIdx}_${trackKey}_${noteIdx}`,
                pitch: midiPitch,
                startTime: phraseStart + (note.startTime || 0),
                duration: note.duration || 0.5,
                hand,
                velocity: note.velocity || 64
              });
            }
          });
        };

        pushTrack(phrase.tracks?.melody || phrase.melody || [], 'melody', 'right');
        pushTrack(phrase.tracks?.chords || phrase.chords || [], 'chords', 'left');

        phraseStart += (phrase.duration || phrase.length * beatsPerMeasure || beatsPerMeasure);
      });
    } catch (error) {
      console.error('Error building note list:', error);
      return [];
    }

    return notes.sort((a, b) => a.startTime - b.startTime);
  }, [song, getMidiNumber, beatsPerMeasure]);

  const defaultBPM = song?.tempo || 120;
  const beatsPerSecond = currentBPM / 60;

  // Initialize Audio
  useEffect(() => {
    const initAudio = async () => {
      await audioEngine.initialize();
      setAudioInitialized(true);
    };
    initAudio();

    return () => {
      audioEngine.stopAll();
    };
  }, []);

  // ── Shared helpers ─────────────────────────────────────────────────────────

  // Record a note status in both the loop-readable ref and the React state
  // the canvas renders from.
  const markNotePlayed = useCallback((id, status) => {
    playedNotesRef.current.set(id, status);
    setPlayedNotes(new Map(playedNotesRef.current));
  }, []);

  const addFeedback = useCallback((message, type, noteNum, accuracy = null) => {
    const feedback = {
      id: Date.now() + Math.random(),
      message,
      type,
      noteNum,
      accuracy,
      timestamp: Date.now()
    };

    setFeedbackMessages(prev => [...prev, feedback]);

    const duration = accuracy === 'perfect' ? 1500 : 1000;
    setTimeout(() => {
      setFeedbackMessages(prev => prev.filter(f => f.id !== feedback.id));
    }, duration);
  }, []);

  // Seek to a position (seconds). Re-anchors the clock and resets all the
  // scan pointers. Notes already in the past are pre-marked as processed so
  // a forward seek doesn't flood the stats with "missed" notes.
  const seekTo = useCallback((t) => {
    const clamped = Math.max(0, t);
    songTimeRef.current = clamped;
    if (clockRef.current) {
      anchorRef.current = clockRef.current() - clamped;
    }
    autoIdxRef.current = 0;
    missIdxRef.current = 0;
    windowStartIdxRef.current = 0;
    nextClickIdxRef.current = -1;
    pausedAtTimeRef.current = null;

    const bps = currentBPM / 60;
    const processed = new Set();
    for (let i = 0; i < allNotes.length; i++) {
      if (allNotes[i].startTime / bps + NOTE_TOLERANCE < clamped) {
        processed.add(allNotes[i].id);
      } else {
        break; // sorted: everything after is in the future
      }
    }
    processedNotesRef.current = processed;
    playedNotesRef.current = new Map();
    setPlayedNotes(new Map());
    expectedNotesRef.current = new Set();
    autoVisualQueueRef.current = [];
    setCurrentTime(clamped);
  }, [allNotes, currentBPM]);

  // Resume playback after a wait-mode pause
  const resumeAfterWait = useCallback(() => {
    if (pausedAtTimeRef.current !== null) {
      const t = pausedAtTimeRef.current;
      pausedAtTimeRef.current = null;
      songTimeRef.current = t;
      if (!clockRef.current) clockRef.current = audioEngine.getClock();
      anchorRef.current = clockRef.current() - t;
      setIsPlaying(true);
    }
  }, []);

  // ── MIDI input → scoring (reads refs: subscribes once per mode change) ────
  useEffect(() => {
    const handleNoteOn = (event) => {
      const { note } = event;
      setActiveNotes(prev => new Set(prev).add(note));

      if (freePlayMode) {
        addFeedback(`🎹 ${getFrenchNoteName(note)}`, 'freeplay', note);
        return;
      }

      const now = songTimeRef.current; // frame-accurate, not React-state stale
      const bps = beatsPerSecond;

      if (expectedNotesRef.current.has(note)) {
        const noteObj = allNotes.find(n =>
          n.pitch === note &&
          !playedNotesRef.current.has(n.id) &&
          Math.abs(now - n.startTime / bps) <= NOTE_TOLERANCE
        );

        if (noteObj) {
          const timeDiff = Math.abs(now - noteObj.startTime / bps);
          let accuracy = 'ok';
          let feedbackText = '✓';

          if (timeDiff <= PERFECT_TOLERANCE) {
            accuracy = 'perfect';
            feedbackText = '✨ PARFAIT !';
          } else if (timeDiff <= GOOD_TOLERANCE) {
            accuracy = 'good';
            feedbackText = '✓ Bien';
          }

          processedNotesRef.current.add(noteObj.id);
          markNotePlayed(noteObj.id, 'correct');

          setSessionStats(prev => {
            const newCombo = prev.currentCombo + 1;
            return {
              ...prev,
              correctNotes: prev.correctNotes + 1,
              perfectNotes: accuracy === 'perfect' ? prev.perfectNotes + 1 : prev.perfectNotes,
              goodNotes: accuracy === 'good' ? prev.goodNotes + 1 : prev.goodNotes,
              currentCombo: newCombo,
              maxCombo: Math.max(prev.maxCombo, newCombo)
            };
          });

          addFeedback(`${feedbackText} ${getFrenchNoteName(note)}`, 'correct', note, accuracy);

          if (waitMode && pausedAtTimeRef.current !== null) {
            resumeAfterWait();
          }
        }
      } else if (handMode !== 'watch') {
        setSessionStats(prev => ({
          ...prev,
          wrongNotes: prev.wrongNotes + 1,
          currentCombo: 0
        }));

        addFeedback(`✗ ${getFrenchNoteName(note)}`, 'wrong', note);
      }
    };

    const handleNoteOff = (event) => {
      const { note } = event;
      setActiveNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(note);
        return newSet;
      });
    };

    midiInputService.addEventListener('noteOn', handleNoteOn);
    midiInputService.addEventListener('noteOff', handleNoteOff);

    return () => {
      midiInputService.removeEventListener('noteOn', handleNoteOn);
      midiInputService.removeEventListener('noteOff', handleNoteOff);
    };
  }, [allNotes, beatsPerSecond, waitMode, handMode, freePlayMode, resumeAfterWait, markNotePlayed, addFeedback]);

  // Calculate phrase measure ranges
  const phraseMeasureRanges = useMemo(() => {
    if (!song || !song.phrases) return [];

    let currentMeasure = 1;
    return song.phrases.map((phrase, index) => {
      const startMeasure = currentMeasure;
      const endMeasure = currentMeasure + phrase.length - 1;
      currentMeasure = endMeasure + 1;
      return {
        phraseIndex: index,
        name: phrase.name || `Phrase ${index + 1}`,
        startMeasure,
        endMeasure,
        length: phrase.length
      };
    });
  }, [song]);

  const totalMeasures = useMemo(() => {
    return phraseMeasureRanges.length > 0
      ? phraseMeasureRanges[phraseMeasureRanges.length - 1].endMeasure
      : 0;
  }, [phraseMeasureRanges]);

  // Jump to measure
  const jumpToMeasure = useCallback((measureNumber) => {
    const offsetMeasures = 0.5;
    const targetMeasure = Math.max(0, measureNumber - 1 - offsetMeasures);
    seekTo((targetMeasure * beatsPerMeasure) / beatsPerSecond);
  }, [seekTo, beatsPerMeasure, beatsPerSecond]);

  // Loop controls
  const setLoopForRange = useCallback((startMeasure, endMeasure, name = '') => {
    setLoopConfig({ startMeasure, endMeasure, name });
    setIsLoopEnabled(true);
    jumpToMeasure(startMeasure);
  }, [jumpToMeasure]);

  const clearLoop = useCallback(() => {
    setLoopConfig(null);
    setIsLoopEnabled(false);
    setSelectedPhraseIndex('');
  }, []);

  const handlePhraseSelect = useCallback((event) => {
    const index = event.target.value;
    setSelectedPhraseIndex(index);
    if (index !== '' && index !== 'custom') {
      const phrase = phraseMeasureRanges[parseInt(index)];
      if (phrase) {
        setLoopForRange(phrase.startMeasure, phrase.endMeasure, phrase.name);
      }
    }
  }, [phraseMeasureRanges, setLoopForRange]);

  // Total duration in seconds
  const totalDuration = useMemo(() => {
    return (totalMeasures * beatsPerMeasure) / beatsPerSecond;
  }, [totalMeasures, beatsPerSecond, beatsPerMeasure]);

  // Jump to a specific time in seconds (for TimelineNavigator)
  const jumpToTime = useCallback((targetTime) => {
    seekTo(Math.max(0, Math.min(totalDuration, targetTime)));
  }, [totalDuration, seekTo]);

  // Handle loop range change from BOTH the TimelineNavigator handles AND
  // the dock's loop-range popup. Always writes a valid loopConfig so the
  // popup steppers and the timeline stay in sync.
  const handleLoopChange = useCallback((startMeasure, endMeasure) => {
    setLoopConfig({
      startMeasure,
      endMeasure,
      name: loopConfig?.name || `Mesures ${startMeasure}-${endMeasure}`
    });
  }, [loopConfig]);

  // Toggle loop on/off
  const handleLoopToggle = useCallback(() => {
    if (isLoopEnabled) {
      clearLoop();
    } else {
      const currentMeasure = Math.floor((songTimeRef.current * beatsPerSecond) / beatsPerMeasure) + 1;
      const loopMeasure = Math.max(1, currentMeasure);
      // endMeasure is inclusive (loop plays startMeasure through endMeasure)
      setLoopForRange(loopMeasure, loopMeasure, `Mesure ${loopMeasure}`);
    }
  }, [isLoopEnabled, beatsPerSecond, beatsPerMeasure, clearLoop, setLoopForRange]);

  // Reset BPM when song changes
  useEffect(() => {
    setCurrentBPM(song?.tempo || 120);
  }, [song?.id, song?.tempo]);

  // Calculate total notes
  useEffect(() => {
    if (sessionStats.totalNotes === 0 && allNotes.length > 0) {
      setSessionStats(prev => ({ ...prev, totalNotes: allNotes.length }));
    }
  }, [allNotes.length, sessionStats.totalNotes]);

  // Auto-pause when the tab/app goes to background: rAF stops firing there
  // while the real-time clock keeps running, so without this the song would
  // fast-forward (and instantly "finish") when the tab becomes visible again.
  useEffect(() => {
    if (!isPlaying) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        setIsPlaying(false);
        setCurrentTime(songTimeRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isPlaying]);

  // ── Main timing loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;

    if (!clockRef.current) clockRef.current = audioEngine.getClock();
    if (anchorRef.current === null) {
      anchorRef.current = clockRef.current() - songTimeRef.current;
    }

    const bps = beatsPerSecond;

    const userHands = new Set();
    if (handMode === 'both' || handMode === 'left') userHands.add('left');
    if (handMode === 'both' || handMode === 'right') userHands.add('right');
    if (handMode === 'watch') userHands.clear();

    const computerHands = new Set();
    if (handMode === 'left') computerHands.add('right');
    if (handMode === 'right') computerHands.add('left');
    if (handMode === 'watch') {
      computerHands.add('left');
      computerHands.add('right');
    }

    const clickEveryBeats =
      metronomeDivision === 'half' ? 2
        : metronomeDivision === 'eighth' ? 0.5
          : 1; // 'quarter'
    const clickEverySec = clickEveryBeats / bps;

    // A/V offset: scheduled audio is HEARD this long after its audio-clock
    // time (output latency; calibratable in Réglages). Scheduling keeps the
    // raw clock; everything the user SEES or is JUDGED on uses the
    // presented (audible) time = raw − offset, so picture matches sound.
    const avOffsetSec = audioEngine.getAvOffsetSeconds();

    let raf;

    const animate = (ts) => {
      const clock = clockRef.current;
      let elapsed = clock() - anchorRef.current;

      // Loop wrap — phase-preserving so the groove never hiccups
      if (isLoopEnabled && loopConfig) {
        const loopStartTime = ((loopConfig.startMeasure - 1) * beatsPerMeasure) / bps;
        const loopEndTime = (loopConfig.endMeasure * beatsPerMeasure) / bps;
        if (loopEndTime > loopStartTime) {
          if (elapsed >= loopEndTime) {
            const t = loopStartTime + ((elapsed - loopStartTime) % (loopEndTime - loopStartTime));
            seekTo(t);
            elapsed = t;
          } else if (elapsed < loopStartTime - 0.001) {
            seekTo(loopStartTime);
            elapsed = loopStartTime;
          }
        }
      }

      // Presented (audible) time — drives the canvas, the scoring windows
      // and the UI clock. `elapsed` stays the SCHEDULING time.
      const presented = Math.max(0, elapsed - avOffsetSec);
      songTimeRef.current = presented;

      // 1) Auto-played notes: schedule ahead at exact audio-clock times
      if (computerHands.size > 0 && audioInitialized) {
        let a = autoIdxRef.current;
        while (a < allNotes.length && allNotes[a].startTime / bps < elapsed - 0.05) a++;
        autoIdxRef.current = a;

        for (let j = a; j < allNotes.length; j++) {
          const n = allNotes[j];
          const nt = n.startTime / bps;
          if (nt > elapsed + SCHEDULE_HORIZON) break;
          if (!computerHands.has(n.hand) || processedNotesRef.current.has(n.id)) continue;

          const durSec = n.duration / bps;
          const when = Math.max(anchorRef.current + nt, clock());
          audioEngine.playNote(n.pitch, durSec, when);
          processedNotesRef.current.add(n.id);
          autoVisualQueueRef.current.push({
            id: n.id, pitch: n.pitch, onAt: nt, offAt: nt + durSec, on: false
          });
        }
      }

      // 1b) Key-press visuals for auto notes, applied when the note is HEARD
      const queue = autoVisualQueueRef.current;
      if (queue.length > 0) {
        const adds = [];
        const dels = [];
        for (let i = queue.length - 1; i >= 0; i--) {
          const e = queue[i];
          if (!e.on && e.onAt <= presented) {
            e.on = true;
            adds.push(e.pitch);
            markNotePlayed(e.id, 'auto');
          }
          if (e.offAt <= presented) {
            if (e.on) dels.push(e.pitch);
            queue.splice(i, 1);
          }
        }
        if (adds.length || dels.length) {
          setActiveNotes(prev => {
            const s = new Set(prev);
            adds.forEach(p => s.add(p));
            dels.forEach(p => s.delete(p));
            return s;
          });
        }
      }

      // 2) Metronome clicks scheduled on the audio clock (steady, no jitter)
      if (isMetronomeOn && audioInitialized) {
        if (nextClickIdxRef.current < 0) {
          nextClickIdxRef.current = Math.max(0, Math.ceil((elapsed - 1e-6) / clickEverySec));
        }
        while (nextClickIdxRef.current * clickEverySec <= elapsed + SCHEDULE_HORIZON) {
          const i = nextClickIdxRef.current;
          const tClick = i * clickEverySec;
          if (tClick >= elapsed - 0.05) {
            const beat = i * clickEveryBeats;
            const isAccent = (beat % beatsPerMeasure) < 1e-6;
            audioEngine.playClick(Math.max(anchorRef.current + tClick, clock()), isAccent);
          }
          nextClickIdxRef.current++;
        }
      } else {
        nextClickIdxRef.current = -1;
      }

      if (!freePlayMode) {
        // 3) Expected-notes window (sliding pointer over the sorted list).
        // All judgment windows run on PRESENTED time — the user plays along
        // with what they hear.
        let w = windowStartIdxRef.current;
        while (w < allNotes.length && allNotes[w].startTime / bps < presented - NOTE_TOLERANCE) w++;
        windowStartIdxRef.current = w;

        const exp = new Set();
        if (userHands.size > 0) {
          for (let j = w; j < allNotes.length; j++) {
            const n = allNotes[j];
            if (n.startTime / bps > presented + NOTE_TOLERANCE) break;
            if (userHands.has(n.hand) && !playedNotesRef.current.has(n.id)) exp.add(n.pitch);
          }
        }
        expectedNotesRef.current = exp;

        // 4) Miss detection
        let m = missIdxRef.current;
        let missed = 0;
        while (m < allNotes.length && allNotes[m].startTime / bps + NOTE_TOLERANCE < presented) {
          const n = allNotes[m];
          if (userHands.has(n.hand) &&
            !playedNotesRef.current.has(n.id) &&
            !processedNotesRef.current.has(n.id)) {
            processedNotesRef.current.add(n.id);
            markNotePlayed(n.id, 'missed');
            missed++;
          }
          m++;
        }
        missIdxRef.current = m;
        if (missed > 0) {
          setSessionStats(prev => ({ ...prev, missedNotes: prev.missedNotes + missed }));
        }

        // 5) Wait mode: pause just before an unplayed user note
        if (waitMode && userHands.size > 0 && pausedAtTimeRef.current === null) {
          let shouldPause = false;
          for (let j = w; j < allNotes.length; j++) {
            const n = allNotes[j];
            if (n.startTime / bps > presented + WAIT_MODE_THRESHOLD) break;
            if (userHands.has(n.hand) && !playedNotesRef.current.has(n.id)) {
              shouldPause = true;
              break;
            }
          }
          if (shouldPause) {
            pausedAtTimeRef.current = presented;
            setCurrentTime(presented);
            setIsPlaying(false);
            return; // resumeAfterWait re-anchors and restarts the loop
          }
        }
      }

      // 6) Throttled React clock for the timeline / overlay / dock
      if (ts - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = ts;
        setCurrentTime(presented);
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    isPlaying, allNotes, beatsPerSecond, beatsPerMeasure, handMode, waitMode,
    freePlayMode, isMetronomeOn, metronomeDivision, isLoopEnabled, loopConfig,
    audioInitialized, seekTo, markNotePlayed
  ]);

  const handleSongCompleted = useCallback(() => {
    setIsPlaying(false);
    setSessionStats(prev => ({ ...prev, completed: true }));

    const accuracy = sessionStats.totalNotes > 0
      ? ((sessionStats.correctNotes / sessionStats.totalNotes) * 100).toFixed(2)
      : 0;

    const scoreData = {
      correctNotes: sessionStats.correctNotes,
      wrongNotes: sessionStats.wrongNotes,
      missedNotes: sessionStats.missedNotes,
      totalNotes: sessionStats.totalNotes,
      accuracy: parseFloat(accuracy),
      playbackSpeed: currentBPM / Math.max(defaultBPM, 1),
      completed: true,
      duration: songTimeRef.current
    };

    ScoreService.saveScore(song.id, scoreData);

    alert(`Bravo ! Morceau terminé !\nPrécision: ${accuracy}%\nNotes correctes: ${sessionStats.correctNotes}/${sessionStats.totalNotes}`);
  }, [sessionStats, currentBPM, defaultBPM, song?.id]);

  // Check if song completed (runs on the throttled clock — 10Hz is plenty)
  useEffect(() => {
    if (allNotes.length > 0 && currentTime > 0) {
      const lastNote = allNotes[allNotes.length - 1];
      const lastNoteTime = (lastNote.startTime + lastNote.duration) / beatsPerSecond;

      if (currentTime > lastNoteTime + 1 && !sessionStats.completed) {
        handleSongCompleted();
      }
    }
  }, [currentTime, allNotes, sessionStats.completed, beatsPerSecond, handleSongCompleted]);

  // Play/Pause controls — when metronome is on, run a 1-bar preroll
  // before the falling notes start moving.
  const prerollTimerRef = useRef(null);
  const [isPrerolling, setIsPrerolling] = useState(false);

  const handlePlayPause = () => {
    if (isPlaying || isPrerolling) {
      setIsPlaying(false);
      setIsPrerolling(false);
      if (prerollTimerRef.current) {
        clearTimeout(prerollTimerRef.current);
        prerollTimerRef.current = null;
      }
      pausedAtTimeRef.current = null;
      setCurrentTime(songTimeRef.current);
      return;
    }

    if (!sessionStats.startTime) {
      setSessionStats(prev => ({ ...prev, startTime: new Date().toISOString() }));
    }

    clockRef.current = audioEngine.getClock();
    const t = songTimeRef.current;

    if (isMetronomeOn && audioInitialized) {
      // Schedule a full bar of clicks on the audio clock; anchor the song
      // clock at the exact end of the count-in. The setTimeout below only
      // flips UI state — its jitter cannot shift the time base.
      const prerollSec = audioEngine.playPrerollClicks(beatsPerMeasure, currentBPM);
      anchorRef.current = clockRef.current() + prerollSec - t;
      nextClickIdxRef.current = -1;
      setIsPrerolling(true);
      prerollTimerRef.current = setTimeout(() => {
        prerollTimerRef.current = null;
        setIsPrerolling(false);
        setIsPlaying(true);
      }, prerollSec * 1000);
    } else {
      anchorRef.current = clockRef.current() - t;
      setIsPlaying(true);
    }
  };

  // Restart: stop playback, seek to 0, clear feedback and reset session stats.
  const handleRestart = useCallback(() => {
    // Stop any active playback / preroll
    setIsPlaying(false);
    setIsPrerolling(false);
    if (prerollTimerRef.current) {
      clearTimeout(prerollTimerRef.current);
      prerollTimerRef.current = null;
    }
    // Seek to the very beginning
    seekTo(0);
    anchorRef.current = null;
    // Clear feedback messages
    setFeedbackMessages([]);
    // Reset session stats to their initial shape
    setSessionStats({
      correctNotes: 0,
      wrongNotes: 0,
      missedNotes: 0,
      perfectNotes: 0,
      goodNotes: 0,
      totalNotes: allNotes.length,
      startTime: null,
      completed: false,
      currentCombo: 0,
      maxCombo: 0,
    });
  }, [seekTo, allNotes.length]);

  // Change tempo while preserving the BEAT position (no time jump, and no
  // quadratic speed: X% tempo now really plays at X%).
  const handleBPMChange = (newBPM) => {
    const oldBps = currentBPM / 60;
    const newBps = newBPM / 60;
    if (newBps <= 0) return;

    const beats = songTimeRef.current * oldBps;
    const t = beats / newBps;
    songTimeRef.current = t;
    setCurrentTime(t);
    if (isPlaying && clockRef.current) {
      anchorRef.current = clockRef.current() - t;
    }
    nextClickIdxRef.current = -1;
    setCurrentBPM(newBPM);
  };

  // Reset play-session tracking when the song itself changes
  useEffect(() => {
    setIsPlaying(false);
    setIsPrerolling(false);
    songTimeRef.current = 0;
    anchorRef.current = null;
    pausedAtTimeRef.current = null;
    processedNotesRef.current = new Set();
    playedNotesRef.current = new Map();
    expectedNotesRef.current = new Set();
    autoVisualQueueRef.current = [];
    autoIdxRef.current = 0;
    missIdxRef.current = 0;
    windowStartIdxRef.current = 0;
    nextClickIdxRef.current = -1;
    setPlayedNotes(new Map());
    setCurrentTime(0);
    setActiveNotes(new Set());
  }, [song?.id]);

  // Canvas-size state — MUST stay above any early return so the hook order
  // stays consistent across re-renders that hit the empty-song path.
  const canvasSizeRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const el = canvasSizeRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!song || !song.phrases || song.phrases.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>Mode LivePlay</h2>
        <p>Veuillez d'abord créer ou charger un morceau dans l'éditeur.</p>
      </div>
    );
  }

  // Mobile fullscreen layout
  if (isMobile) {
    return (
      <div className={styles.containerFullscreen} ref={canvasContainerRef}>
        <RotatePrompt />

        <LivePlayCanvas
          timeRef={songTimeRef}
          activeNotes={activeNotes}
          playedNotes={playedNotes}
          feedbackMessages={feedbackMessages}
          allNotes={allNotes}
          beatsPerSecond={beatsPerSecond}
          song={song}
          isLoopEnabled={isLoopEnabled}
          loopConfig={loopConfig}
          sessionStats={sessionStats}
          canvasWidth={canvasDimensions.width || undefined}
          canvasHeight={canvasDimensions.height || undefined}
          mobileKeyRange={mobileKeyRange}
          visualEffects={visualEffects}
          lookAheadTime={lookAheadTime}
        />

        <LivePlayMobileOverlay
          song={song}
          allNotes={allNotes}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onRestart={handleRestart}
          onBack={onBack || (() => window.history.back())}
          currentTime={currentTime}
          currentBPM={currentBPM}
          defaultBPM={defaultBPM}
          onTempoChange={handleBPMChange}
          handMode={handMode}
          setHandMode={setHandMode}
          isLoopEnabled={isLoopEnabled}
          onLoopToggle={handleLoopToggle}
          loopRange={loopConfig ? [loopConfig.startMeasure, loopConfig.endMeasure] : [1, song?.phrases?.length || 1]}
          onLoopRangeChange={([from, to]) => handleLoopChange(from, to)}
          totalMeasuresHint={song?.phrases?.length || 1}
          sessionStats={sessionStats}
          phraseMeasureRanges={phraseMeasureRanges}
          selectedPhraseIndex={selectedPhraseIndex}
          onPhraseSelect={handlePhraseSelect}
          isMetronomeOn={isMetronomeOn}
          setIsMetronomeOn={setIsMetronomeOn}
          metronomeSubdivision={metronomeDivision}
          setMetronomeSubdivision={setMetronomeDivision}
          visualEffects={visualEffects}
          setVisualEffects={setVisualEffects}
          waitMode={waitMode}
          setWaitMode={setWaitMode}
          hideDock={isLandscape}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 130px)',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
      padding: 0,
      gap: 0,
      alignItems: 'stretch',
    }}>
      {/* Timeline Navigator (looper) — top, clipped to timeline only */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        padding: '0.2rem 0',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        maxHeight: '120px',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0 0.75rem 0.15rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {song.title}
          </span>
        </div>
        <TimelineNavigator
          totalDuration={totalDuration}
          currentTime={currentTime}
          loopConfig={loopConfig}
          isLoopEnabled={isLoopEnabled}
          phrases={song.phrases}
          beatsPerSecond={beatsPerSecond}
          onSeek={jumpToTime}
          onLoopChange={handleLoopChange}
          onLoopToggle={handleLoopToggle}
          onPhraseLoopSelect={setLoopForRange}
          isPlaying={isPlaying}
          tempo={currentBPM}
        />
      </div>

      {/* Canvas — fills remaining space */}
      <div ref={canvasSizeRef} style={{ flex: '1 1 0', minHeight: 0, position: 'relative', display: 'flex', alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden' }}>
        <LivePlayCanvas
          timeRef={songTimeRef}
          activeNotes={activeNotes}
          playedNotes={playedNotes}
          feedbackMessages={feedbackMessages}
          allNotes={allNotes}
          beatsPerSecond={beatsPerSecond}
          song={song}
          isLoopEnabled={isLoopEnabled}
          loopConfig={loopConfig}
          sessionStats={sessionStats}
          visualEffects={visualEffects}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          lookAheadTime={lookAheadTime}
        />

        {/* Zoom cluster — bottom-right of canvas, above the dock */}
        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 16,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'color-mix(in oklab, var(--surface-1), transparent 10%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-pill)',
          padding: '2px 4px',
          userSelect: 'none',
        }}>
          <button
            onClick={() => changeLookAhead(1)}
            disabled={lookAheadTime >= LOOKAHEAD_MAX}
            title="Dézoomer (plus de mesures visibles)"
            style={zoomBtnStyle(lookAheadTime >= LOOKAHEAD_MAX)}
          >
            −
          </button>
          <span
            title="Fenêtre de défilement (zoom)"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center', padding: '0 2px' }}
          >
            {lookAheadTime}s
          </span>
          <button
            onClick={() => changeLookAhead(-1)}
            disabled={lookAheadTime <= LOOKAHEAD_MIN}
            title="Zoomer (moins de mesures visibles)"
            style={zoomBtnStyle(lookAheadTime <= LOOKAHEAD_MIN)}
          >
            +
          </button>
        </div>
      </div>

      {/* Shared PlaybackDock — same look as Apprentissage / Partition / Editor */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}>
        <PlaybackDock
          playing={isPlaying}
          onPlayPause={handlePlayPause}
          speed={Math.round((currentBPM / Math.max(defaultBPM, 1)) * 100)}
          onSpeed={(pct) => handleBPMChange(Math.round((pct / 100) * defaultBPM))}
          handMode={handMode === 'watch' ? 'listen' : handMode}
          onHandMode={(m) => setHandMode(m === 'listen' ? 'watch' : m)}
          metronome={isMetronomeOn}
          onMetronome={() => setIsMetronomeOn(!isMetronomeOn)}
          metronomeSubdivision={metronomeDivision}
          onMetronomeSubdivisionChange={setMetronomeDivision}
          loop={isLoopEnabled}
          onLoop={handleLoopToggle}
          loopRange={loopConfig ? [loopConfig.startMeasure, loopConfig.endMeasure] : [1, song?.phrases?.length || 1]}
          onLoopRange={([from, to]) => handleLoopChange(from, to)}
          loopEditorOpen={loopEditorOpen}
          onToggleLoopEditor={() => setLoopEditorOpen((o) => !o)}
          totalMeasures={totalMeasures}
          phrases={phraseMeasureRanges}
          onPrev={() => jumpToTime(Math.max(0, songTimeRef.current - 4))}
          onNext={() => jumpToTime(songTimeRef.current + 4)}
          onRestart={handleRestart}
        />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function zoomBtnStyle(disabled) {
  return {
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: disabled ? 'var(--text-disabled, #555)' : 'var(--text-secondary)',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 14,
    fontWeight: 700,
    padding: 0,
    borderRadius: 4,
    lineHeight: 1,
    opacity: disabled ? 0.4 : 1,
    transition: 'opacity 0.15s',
  };
}
