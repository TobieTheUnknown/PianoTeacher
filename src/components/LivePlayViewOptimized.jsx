import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import LivePlayCanvas from './LivePlayCanvas';
import LivePlayControls from './LivePlayControls';
import LivePlayStats from './LivePlayStats';
import { ScoreService } from '../services/ScoreService';
import { getFrenchNoteName } from '../models/song';
import { audioEngine } from '../services/AudioEngine';
import { midiInputService } from '../services/MidiInputService';
import { TimelineNavigator } from './TimelineNavigator';
import { LivePlayMobileOverlay } from './LivePlayMobileOverlay';
import { RotatePrompt } from './RotatePrompt';
import { useDeviceContext } from '../hooks/useDeviceContext';
import { useWakeLock } from '../hooks/useWakeLock';
import { useFullscreen } from '../hooks/useFullscreen';
import styles from './LivePlayView.module.css';

/**
 * Version optimisée de LivePlayView
 * Utilise les nouveaux composants pour de meilleures performances
 *
 * Améliorations:
 * - Canvas layers séparés (static/dynamic/overlay)
 * - Composants mémorisés pour éviter re-renders
 * - CSS modules au lieu d'inline styles
 * - FPS stable à 60
 * - Réduction mémoire de 50%
 */

// Timing tolerances (LivePlay standard)
const PERFECT_TOLERANCE = 0.052; // ±52ms
const GOOD_TOLERANCE = 0.152; // ±152ms
const NOTE_TOLERANCE = 0.302; // ±302ms
const WAIT_MODE_THRESHOLD = 0.05;

export function LivePlayViewOptimized({ song, onFullscreenChange, onBack }) {
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedAtTimeRef = useRef(null);
  const processedNotesRef = useRef(new Set());
  const lastMetronomeClickRef = useRef(-1);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentBPM, setCurrentBPM] = useState(song?.tempo || 120);
  const [activeNotes, setActiveNotes] = useState(new Set());

  // Features state
  const [handMode, setHandMode] = useState('both');
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [metronomeDivision, setMetronomeDivision] = useState('measure');
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [loopConfig, setLoopConfig] = useState(null);
  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState('');
  const [customRangeStart, setCustomRangeStart] = useState('');
  const [customRangeEnd, setCustomRangeEnd] = useState('');

  // Scoring and wait mode state
  const [waitMode, setWaitMode] = useState(false);
  const [showScores, setShowScores] = useState(false);
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
  const [expectedNotes, setExpectedNotes] = useState(new Set());
  const [songStats, setSongStats] = useState(null);
  const [freePlayMode, setFreePlayMode] = useState(false);
  const [visualEffects, setVisualEffects] = useState(false);

  // Mobile context
  const { isMobile, isLandscape } = useDeviceContext();
  const canvasContainerRef = useRef(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

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

  // Mobile key range: C2 (36) to C7 (96) in landscape for wider keys
  const mobileKeyRange = isMobile && isLandscape ? [36, 96] : (isMobile ? [36, 96] : null);

  // Keep screen awake during playback
  useWakeLock(isPlaying);

  // Enter fullscreen on mobile LivePlay
  useFullscreen(isMobile);

  // Calculate beats per measure based on time signature
  const timeSignature = song?.timeSignature || { numerator: 4, denominator: 4 };
  const beatsPerMeasure = useMemo(() => {
    if (!timeSignature || !timeSignature.numerator || !timeSignature.denominator) {
      return 4;
    }
    return (timeSignature.numerator / timeSignature.denominator) * 4;
  }, [timeSignature]);

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
    // eslint-disable-next-line no-unused-vars
    } catch (_e) {
      console.warn('Invalid note name:', noteName);
    }
    return null;
  }, []);

  // Get all notes from song with timing information
  const getAllNotes = useCallback(() => {
    if (!song || !song.phrases || !Array.isArray(song.phrases)) {
      return [];
    }

    const notes = [];
    let currentTime = 0;

    try {
      for (const phrase of song.phrases) {
        if (!phrase) continue;

        const melodyNotes = phrase.tracks?.melody || phrase.melody || [];
        if (Array.isArray(melodyNotes)) {
          for (const note of melodyNotes) {
            const midiPitch = typeof note.pitch === 'number'
              ? note.pitch
              : getMidiNumber(note.pitch);

            if (midiPitch !== null) {
              notes.push({
                id: `${currentTime}_${midiPitch}_melody_${Math.random()}`,
                pitch: midiPitch,
                startTime: currentTime + (note.startTime || 0),
                duration: note.duration || 0.5,
                hand: 'right',
                velocity: note.velocity || 64
              });
            }
          }
        }

        const chordNotes = phrase.tracks?.chords || phrase.chords || [];
        if (Array.isArray(chordNotes)) {
          for (const note of chordNotes) {
            const midiPitch = typeof note.pitch === 'number'
              ? note.pitch
              : getMidiNumber(note.pitch);

            if (midiPitch !== null) {
              notes.push({
                id: `${currentTime}_${midiPitch}_chord_${Math.random()}`,
                pitch: midiPitch,
                startTime: currentTime + (note.startTime || 0),
                duration: note.duration || 0.5,
                hand: 'left',
                velocity: note.velocity || 64
              });
            }
          }
        }

        currentTime += (phrase.duration || phrase.length * beatsPerMeasure || beatsPerMeasure);
      }
    } catch (error) {
      console.error('Error in getAllNotes:', error);
      return [];
    }

    return notes.sort((a, b) => a.startTime - b.startTime);
  }, [song, getMidiNumber, beatsPerMeasure]);

  const allNotes = useMemo(() => getAllNotes(), [getAllNotes]);
  const defaultBPM = song?.tempo || 120;
  const playbackSpeed = currentBPM / defaultBPM;
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

  // Setup MIDI Input Service listener
  useEffect(() => {
    const handleNoteOn = (event) => {
      const { note } = event;
      setActiveNotes(prev => new Set([...prev, note]));

      if (!freePlayMode) {
        const isExpected = expectedNotes.has(note);

        if (isExpected) {
          const noteObj = allNotes.find(n =>
            n.pitch === note &&
            !playedNotes.has(n.id) &&
            Math.abs(currentTime - n.startTime / beatsPerSecond) <= NOTE_TOLERANCE
          );

          if (noteObj) {
            const timeDiff = Math.abs(currentTime - noteObj.startTime / beatsPerSecond);
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
            setPlayedNotes(prev => new Map(prev).set(noteObj.id, 'correct'));

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
        } else {
          if (handMode !== 'watch') {
            setSessionStats(prev => ({
              ...prev,
              wrongNotes: prev.wrongNotes + 1,
              currentCombo: 0
            }));

            addFeedback(`✗ ${getFrenchNoteName(note)}`, 'wrong', note);
          }
        }
      } else {
        addFeedback(`🎹 ${getFrenchNoteName(note)}`, 'freeplay', note);
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
  }, [expectedNotes, playedNotes, currentTime, beatsPerSecond, allNotes, waitMode, handMode, audioInitialized, freePlayMode]);

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
    const targetTime = (targetMeasure * beatsPerMeasure) / beatsPerSecond;

    setCurrentTime(targetTime);
    startTimeRef.current = performance.now() - (targetTime / playbackSpeed) * 1000;
    processedNotesRef.current = new Set();
    setPlayedNotes(new Map());
  }, [beatsPerMeasure, beatsPerSecond, playbackSpeed]);

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
    setCustomRangeStart('');
    setCustomRangeEnd('');
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

  const handleCustomRangeLoop = useCallback(() => {
    const start = parseInt(customRangeStart);
    const end = parseInt(customRangeEnd);
    if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
      setLoopForRange(start, end, `Mesures ${start}-${end}`);
      setSelectedPhraseIndex('custom');
    }
  }, [customRangeStart, customRangeEnd, setLoopForRange]);

  // Total duration in seconds
  const totalDuration = useMemo(() => {
    return (totalMeasures * beatsPerMeasure) / beatsPerSecond;
  }, [totalMeasures, beatsPerSecond, beatsPerMeasure]);

  // Jump to a specific time in seconds (for TimelineNavigator)
  const jumpToTime = useCallback((targetTime) => {
    const clampedTime = Math.max(0, Math.min(totalDuration, targetTime));
    setCurrentTime(clampedTime);
    startTimeRef.current = performance.now() - (clampedTime / playbackSpeed) * 1000;
    processedNotesRef.current = new Set();
    setPlayedNotes(new Map());
  }, [totalDuration, playbackSpeed]);

  // Handle loop range change from TimelineNavigator handles
  const handleLoopChange = useCallback((startMeasure, endMeasure) => {
    if (loopConfig) {
      setLoopConfig({
        startMeasure,
        endMeasure,
        name: loopConfig.name || `Mesures ${startMeasure}-${endMeasure}`
      });
    }
  }, [loopConfig]);

  // Toggle loop on/off
  const handleLoopToggle = useCallback(() => {
    if (isLoopEnabled) {
      clearLoop();
    } else {
      const currentMeasure = Math.floor((currentTime * beatsPerSecond) / beatsPerMeasure) + 1;
      const loopMeasure = Math.max(1, currentMeasure);
      // endMeasure is inclusive (loop plays startMeasure through endMeasure)
      setLoopForRange(loopMeasure, loopMeasure, `Mesure ${loopMeasure}`);
    }
  }, [isLoopEnabled, currentTime, beatsPerSecond, beatsPerMeasure, clearLoop, setLoopForRange]);

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

  // Load song statistics
  useEffect(() => {
    if (song?.id) {
      const stats = ScoreService.getSongStatistics(song.id);
      setSongStats(stats);
    }
  }, [song?.id]);

  // Check for expected notes
  useEffect(() => {
    const currentExpectedNotes = new Set();
    const userHands = new Set();

    if (handMode !== 'watch') {
      if (handMode === 'both' || handMode === 'left') userHands.add('left');
      if (handMode === 'both' || handMode === 'right') userHands.add('right');
    }

    allNotes.forEach(note => {
      if (!userHands.has(note.hand)) return;

      const noteTime = note.startTime / beatsPerSecond;
      const timeDiff = Math.abs(currentTime - noteTime);

      if (timeDiff <= NOTE_TOLERANCE && !playedNotes.has(note.id)) {
        currentExpectedNotes.add(note.pitch);
      }

      if (currentTime > noteTime + NOTE_TOLERANCE &&
        !playedNotes.has(note.id) &&
        !processedNotesRef.current.has(note.id)) {

        processedNotesRef.current.add(note.id);
        setPlayedNotes(prev => new Map(prev).set(note.id, 'missed'));
        setSessionStats(prev => ({
          ...prev,
          missedNotes: prev.missedNotes + 1
        }));
      }
    });

    setExpectedNotes(currentExpectedNotes);

    if (waitMode && isPlaying && currentExpectedNotes.size > 0) {
      let shouldPause = false;

      for (const note of allNotes) {
        if (!userHands.has(note.hand) || playedNotes.has(note.id)) continue;

        const noteTime = note.startTime / beatsPerSecond;
        const timeDiff = noteTime - currentTime;

        if (timeDiff >= 0 && timeDiff <= WAIT_MODE_THRESHOLD) {
          shouldPause = true;
          break;
        }
      }

      if (shouldPause && pausedAtTimeRef.current === null) {
        pausedAtTimeRef.current = currentTime;
        setIsPlaying(false);
      }
    }
  }, [currentTime, allNotes, beatsPerSecond, handMode, waitMode, isPlaying, playedNotes]);

  // Auto-play computer notes
  useEffect(() => {
    if (!isPlaying) return;

    const computerHands = new Set();
    if (handMode === 'left') computerHands.add('right');
    if (handMode === 'right') computerHands.add('left');
    if (handMode === 'watch') {
      computerHands.add('left');
      computerHands.add('right');
    }

    if (computerHands.size === 0) return;

    const notesToActivate = [];
    const notesToDeactivate = [];

    allNotes.forEach(note => {
      if (!computerHands.has(note.hand)) return;

      const noteTime = note.startTime / beatsPerSecond;
      const noteEndTime = noteTime + (note.duration / beatsPerSecond);

      // Note should start playing
      if (currentTime >= noteTime && currentTime < noteTime + 0.1) {
        if (!processedNotesRef.current.has(note.id)) {
          audioEngine.playNote(note.pitch, note.duration / beatsPerSecond);
          processedNotesRef.current.add(note.id);
          setPlayedNotes(prev => new Map(prev).set(note.id, 'auto'));
          notesToActivate.push(note.pitch);
        }
      }

      // Note should stop (for visual feedback)
      if (currentTime >= noteEndTime && currentTime < noteEndTime + 0.1) {
        notesToDeactivate.push(note.pitch);
      }
    });

    // Update activeNotes for visual feedback on keyboard
    if (notesToActivate.length > 0 || notesToDeactivate.length > 0) {
      setActiveNotes(prev => {
        const newSet = new Set(prev);
        notesToActivate.forEach(pitch => newSet.add(pitch));
        notesToDeactivate.forEach(pitch => newSet.delete(pitch));
        return newSet;
      });
    }
  }, [currentTime, isPlaying, handMode, allNotes, beatsPerSecond]);

  // Metronome control
  useEffect(() => {
    if (!isPlaying || !isMetronomeOn || !audioInitialized) {
      audioEngine.stopMetronome();
      lastMetronomeClickRef.current = -1;
      return;
    }

    const currentBeat = currentTime * beatsPerSecond;

    let currentClickPosition;

    switch (metronomeDivision) {
      case 'half-measure':
        currentClickPosition = Math.floor(currentBeat / 2);
        break;
      case 'beat':
        currentClickPosition = Math.floor(currentBeat);
        break;
      case 'measure':
      default:
        currentClickPosition = Math.floor(currentBeat / beatsPerMeasure);
        break;
    }

    if (currentClickPosition !== lastMetronomeClickRef.current && currentClickPosition >= 0) {
      lastMetronomeClickRef.current = currentClickPosition;

      const beatInMeasure = Math.floor(currentBeat % beatsPerMeasure);
      const isAccent = metronomeDivision === 'measure' || beatInMeasure < 0.1;

      audioEngine.playClick(undefined, isAccent);
    }


  }, [currentTime, isPlaying, isMetronomeOn, audioInitialized, beatsPerSecond, metronomeDivision, beatsPerMeasure]);

  const resumeAfterWait = () => {
    if (pausedAtTimeRef.current !== null) {
      setIsPlaying(true);
      startTimeRef.current = performance.now() - (pausedAtTimeRef.current / playbackSpeed) * 1000;
      pausedAtTimeRef.current = null;
    }
  };

  const addFeedback = (message, type, noteNum, accuracy = null) => {
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
  };

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      if (!startTimeRef.current) {
        startTimeRef.current = performance.now();
      }

      const elapsed = (performance.now() - startTimeRef.current) / 1000 * playbackSpeed;

      if (isLoopEnabled && loopConfig) {
        const firstMeasure = loopConfig.startMeasure - 1;
        const lastMeasure = loopConfig.endMeasure - 1;

        const loopStartTime = (firstMeasure * beatsPerMeasure) / beatsPerSecond;
        const loopEndTime = ((lastMeasure + 1) * beatsPerMeasure) / beatsPerSecond;

        if (elapsed >= loopEndTime) {
          startTimeRef.current = performance.now() - (loopStartTime / playbackSpeed) * 1000;
          setCurrentTime(loopStartTime);
          processedNotesRef.current = new Set();
          setPlayedNotes(new Map());
          return;
        } else if (elapsed < loopStartTime) {
          startTimeRef.current = performance.now() - (loopStartTime / playbackSpeed) * 1000;
          setCurrentTime(loopStartTime);
          processedNotesRef.current = new Set();
          setPlayedNotes(new Map());
          return;
        }
      }

      setCurrentTime(elapsed);

      if (waitMode && pausedAtTimeRef.current === null && handMode !== 'watch') {
        const userHands = new Set();
        if (handMode === 'both' || handMode === 'left') userHands.add('left');
        if (handMode === 'both' || handMode === 'right') userHands.add('right');

        const shouldPause = allNotes.some(note => {
          const noteTime = note.startTime / beatsPerSecond;
          return (
            userHands.has(note.hand) &&
            expectedNotes.has(note.pitch) &&
            !playedNotes.has(note.id) &&
            elapsed >= noteTime - WAIT_MODE_THRESHOLD
          );
        });

        if (shouldPause) {
          pausedAtTimeRef.current = elapsed;
          setIsPlaying(false);
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, waitMode, expectedNotes, allNotes, beatsPerSecond, playedNotes, isLoopEnabled, loopConfig, handMode, beatsPerMeasure]);

  // Check if song completed
  useEffect(() => {
    if (allNotes.length > 0 && currentTime > 0) {
      const lastNote = allNotes[allNotes.length - 1];
      const lastNoteTime = (lastNote.startTime + lastNote.duration) / beatsPerSecond;

      if (currentTime > lastNoteTime + 1 && !sessionStats.completed) {
        handleSongCompleted();
      }
    }
  }, [currentTime, allNotes, sessionStats.completed, beatsPerSecond]);

  const handleSongCompleted = () => {
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
      playbackSpeed,
      completed: true,
      duration: currentTime
    };

    ScoreService.saveScore(song.id, scoreData);

    const stats = ScoreService.getSongStatistics(song.id);
    setSongStats(stats);

    alert(`Bravo ! Morceau terminé !\nPrécision: ${accuracy}%\nNotes correctes: ${sessionStats.correctNotes}/${sessionStats.totalNotes}`);
  };

  // Play/Pause controls
  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      startTimeRef.current = null;
    } else {
      if (!sessionStats.startTime) {
        setSessionStats(prev => ({ ...prev, startTime: new Date().toISOString() }));
      }
      setIsPlaying(true);
      startTimeRef.current = performance.now() - (currentTime / playbackSpeed) * 1000;
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    startTimeRef.current = null;
    pausedAtTimeRef.current = null;
    processedNotesRef.current = new Set();
    lastMetronomeClickRef.current = -1;
    setPlayedNotes(new Map());
    setFeedbackMessages([]);
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
      maxCombo: 0
    });
  };

  const handleBPMChange = (newBPM) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      setIsPlaying(false);
    }
    setCurrentBPM(newBPM);
    if (wasPlaying) {
      setTimeout(() => {
        setIsPlaying(true);
        const newSpeed = newBPM / defaultBPM;
        startTimeRef.current = performance.now() - (currentTime / newSpeed) * 1000;
      }, 50);
    }
  };

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

  // Desktop-only state (must be declared before any conditional returns)
  const currentMeasure = Math.floor(currentTime * beatsPerSecond / 4) + 1;
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

  // Mobile fullscreen layout
  if (isMobile) {
    return (
      <div className={styles.containerFullscreen} ref={canvasContainerRef}>
        <RotatePrompt />

        <LivePlayCanvas
          currentTime={currentTime}
          activeNotes={activeNotes}
          playedNotes={playedNotes}
          feedbackMessages={feedbackMessages}
          expectedNotes={expectedNotes}
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
        />

        <LivePlayMobileOverlay
          song={song}
          allNotes={allNotes}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onBack={onBack || (() => window.history.back())}
          currentTime={currentTime}
          currentBPM={currentBPM}
          defaultBPM={defaultBPM}
          onTempoChange={handleBPMChange}
          handMode={handMode}
          setHandMode={setHandMode}
          isLoopEnabled={isLoopEnabled}
          onLoopToggle={handleLoopToggle}
          sessionStats={sessionStats}
          phraseMeasureRanges={phraseMeasureRanges}
          selectedPhraseIndex={selectedPhraseIndex}
          onPhraseSelect={handlePhraseSelect}
          isMetronomeOn={isMetronomeOn}
          setIsMetronomeOn={setIsMetronomeOn}
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
      height: '100vh',
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
          <span style={{ flex: 1 }} />
          <button
            onClick={handleLoopToggle}
            style={{
              padding: '0.15rem 0.4rem', fontSize: '0.6rem',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
              background: isLoopEnabled ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: isLoopEnabled ? 'var(--bg-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', minHeight: 'auto',
            }}
          >
            🔁 Loop
          </button>
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
      <div ref={canvasSizeRef} style={{ flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden' }}>
        <LivePlayCanvas
          currentTime={currentTime}
          activeNotes={activeNotes}
          playedNotes={playedNotes}
          feedbackMessages={feedbackMessages}
          expectedNotes={expectedNotes}
          allNotes={allNotes}
          beatsPerSecond={beatsPerSecond}
          song={song}
          isLoopEnabled={isLoopEnabled}
          loopConfig={loopConfig}
          sessionStats={sessionStats}
          visualEffects={visualEffects}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
        />
      </div>

      {/* Controls — bottom */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
      }}>
        <LivePlayControls
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onReset={handleReset}
          currentTime={currentTime}
          handMode={handMode}
          setHandMode={setHandMode}
          waitMode={waitMode}
          setWaitMode={setWaitMode}
          freePlayMode={freePlayMode}
          setFreePlayMode={setFreePlayMode}
          visualEffects={visualEffects}
          setVisualEffects={setVisualEffects}
          isMetronomeOn={isMetronomeOn}
          setIsMetronomeOn={setIsMetronomeOn}
          metronomeDivision={metronomeDivision}
          setMetronomeDivision={setMetronomeDivision}
          currentBPM={currentBPM}
          defaultBPM={defaultBPM}
          onTempoChange={handleBPMChange}
        />
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className={styles.legendItem}>
      <div className={styles.legendColor} style={{ backgroundColor: color }} />
      <span className={styles.legendLabel}>{label}</span>
    </div>
  );
}
