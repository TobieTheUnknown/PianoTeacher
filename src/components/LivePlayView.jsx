import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ScoreService } from '../services/ScoreService';
import { getFrenchNoteName } from '../models/song';
import { audioEngine } from '../services/AudioEngine';
import { midiInputService } from '../services/MidiInputService';
import { TimelineNavigator } from './TimelineNavigator';

/**
 * LivePlayView - Falling notes visualization with scoring and wait mode
 * Features:
 * - Canvas rendering for performance
 * - Notes fall from top to piano keyboard at bottom
 * - Color coding for left/right hands
 * - Real-time MIDI input detection with correct/incorrect feedback
 * - Wait mode: pauses until correct note is played
 * - Scoring system with statistics
 * - Playback controls (play/pause/speed)
 * - Hand Separation (Left/Right/Both)
 * - Computer auto-play for non-user hands
 * - Metronome
 */
// Color constants
const COLORS = {
    background: '#1a1a1a',
    whiteKey: '#ffffff',
    blackKey: '#000000',
    whiteKeyPressed: '#60a5fa', // blue-400 - matches MIDI visualizer
    blackKeyPressed: '#3b82f6', // blue-500 - matches MIDI visualizer
    whiteKeyCorrect: '#86efac', // green-300
    blackKeyCorrect: '#22c55e', // green-500
    whiteKeyWrong: '#fca5a5', // red-300
    blackKeyWrong: '#ef4444', // red-500
    rightHand: '#60a5fa', // blue-400
    leftHand: '#f472b6', // pink-400
    playedCorrect: '#22c55e', // green-500
    playedWrong: '#ef4444', // red-500
    missed: '#f59e0b' // amber-500
};

export function LivePlayView({ song }) {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(null);
    const pausedAtTimeRef = useRef(null);
    const processedNotesRef = useRef(new Set()); // Track notes already marked as missed
    const preRollEndTimeRef = useRef(0); // Temps où le pré-roll doit se terminer

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentBPM, setCurrentBPM] = useState(song?.tempo || 120);
    // midiAccess state removed - not used (MIDI is handled via midiInputService)
    const [activeNotes, setActiveNotes] = useState(new Set());

    // New features state
    const [handMode, setHandMode] = useState('both'); // 'left', 'right', 'both'
    const [isMetronomeOn, setIsMetronomeOn] = useState(false);
    const [metronomeDivision, setMetronomeDivision] = useState('measure'); // 'measure', 'half-measure', 'beat'
    const [audioInitialized, setAudioInitialized] = useState(false);
    const [isLoopEnabled, setIsLoopEnabled] = useState(false);
    const [loopConfig, setLoopConfig] = useState(null); // { startMeasure, endMeasure, name }
    // eslint-disable-next-line no-unused-vars
    const [selectedPhraseIndex, setSelectedPhraseIndex] = useState('');
    const [customRangeStart, setCustomRangeStart] = useState('');
    const [customRangeEnd, setCustomRangeEnd] = useState('');

    // New scoring and wait mode state
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
    const [playedNotes, setPlayedNotes] = useState(new Map()); // Track which notes have been played
    const [feedbackMessages, setFeedbackMessages] = useState([]); // Visual feedback for correct/wrong
    const [expectedNotes, setExpectedNotes] = useState(new Set()); // Notes that should be played now
    const [songStats, setSongStats] = useState(null);
    const [freePlayMode, setFreePlayMode] = useState(false); // Mode "sans fausse note" pour improvisation
    const [visualEffects, setVisualEffects] = useState(false); // Effets visuels (glow, ombres) - off par défaut pour perf

    // Count-in state (mesure de préparation)
    const [isInPreRoll, setIsInPreRoll] = useState(false);
    const [metronomeWasOn, setMetronomeWasOn] = useState(false); // État du métronome avant le pré-roll
    const [preRollEnabled, setPreRollEnabled] = useState(true); // Activer/désactiver le pré-roll

    // Loop intelligent state (activation automatique quand on rentre dans la loop)
    const [loopActivationPending, setLoopActivationPending] = useState(false);
    const [loopWillActivateAt, setLoopWillActivateAt] = useState(null);

    // Active keys state (pour l'allumage visuel des touches)
    const [activeKeys, setActiveKeys] = useState({
        student: new Set(),      // Notes pressées par l'élève
        computer: new Set(),     // Notes jouées par le logiciel
        expected: new Set()      // Notes attendues (wait mode uniquement)
    });

    // Canvas dimensions
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 800;
    const KEYBOARD_HEIGHT = 150;
    const NOTE_FALL_HEIGHT = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Piano keyboard constants (88 keys, A0 to C8)
    const FIRST_KEY = 21; // MIDI note A0
    const LAST_KEY = 108; // MIDI note C8
    const WHITE_KEY_WIDTH = CANVAS_WIDTH / 52; // 52 white keys

    // Timing tolerance for note detection (in seconds) - Inspired by LivePlay
    const PERFECT_TOLERANCE = 0.052; // ±52ms for "Perfect" (LivePlay standard + 2ms buffer)
    const GOOD_TOLERANCE = 0.152; // ±152ms for "Good"
    const NOTE_TOLERANCE = 0.302; // ±302ms max window for "OK"
    const WAIT_MODE_THRESHOLD = 0.05; // Wait mode triggers when note is within 50ms of hit line

    // Calculate beats per measure based on time signature
    // Memoize timeSignature to avoid creating new object references on every render
    const timeSignature = useMemo(() => {
        return song?.timeSignature || { numerator: 4, denominator: 4 };
    }, [song?.timeSignature]);

    const beatsPerMeasure = useMemo(() => {
        if (!timeSignature || !timeSignature.numerator || !timeSignature.denominator) {
            return 4; // Default to 4/4
        }
        return (timeSignature.numerator / timeSignature.denominator) * 4;
    }, [timeSignature]);

    // Detect if time signature is compound (ternary)
    const isCompoundTime = useMemo(() => {
        if (!timeSignature || !timeSignature.numerator || !timeSignature.denominator) {
            return false;
        }
        return timeSignature.denominator === 8 && timeSignature.numerator % 3 === 0;
    }, [timeSignature]);

    // Initialize Audio & MIDI
    useEffect(() => {
        // Init Audio Service on mount
        const initAudio = async () => {
            await audioEngine.initialize();
            setAudioInitialized(true);
        };
        initAudio();

        return () => {
            audioEngine.stopAll();
        };
    }, []);

    // Helper to convert note name to MIDI number
    const getMidiNumber = (noteName) => {
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
            // Extract note and octave (e.g., "C#4" -> note="C#", octave="4")
            // Handle both 2 and 3 character note names
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
    };

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

                // Process melody notes (right hand)
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

                // Process chord notes (left hand)
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

                // Update time for next phrase
                currentTime += (phrase.duration || phrase.length * beatsPerMeasure || beatsPerMeasure);
            }
        } catch (error) {
            console.error('Error in getAllNotes:', error);
            return [];
        }

        return notes.sort((a, b) => a.startTime - b.startTime);
    }, [song, beatsPerMeasure]);

    // Memoize allNotes to prevent recalculation on every render
    const allNotes = useMemo(() => getAllNotes(), [getAllNotes]);
    const defaultBPM = song?.tempo || 120;
    const playbackSpeed = currentBPM / defaultBPM;
    const beatsPerSecond = currentBPM / 60;

    // Setup MIDI Input Service listener
    useEffect(() => {
        // Listen to MIDI note events from MidiInputService
        const handleNoteOn = (event) => {
            const { note } = event;

            // Add to active notes (ancienne méthode, conservée pour compatibilité)
            setActiveNotes(prev => new Set([...prev, note]));

            // Add to activeKeys.student pour l'allumage visuel des touches
            setActiveKeys(prev => ({
                ...prev,
                student: new Set([...prev.student, note])
            }));

            // Note: Audio is now handled globally by useMidiAudio hook in App.jsx
            // This useEffect only handles game logic (correct/wrong notes, scoring, wait mode)

            // Check if this note is expected in the song (only if not in free play mode)
            if (!freePlayMode) {
                const isExpected = expectedNotes.has(note);

                if (isExpected) {
                    // Find the note object
                    const noteObj = allNotes.find(n =>
                        n.pitch === note &&
                        !playedNotes.has(n.id) &&
                        Math.abs(currentTime - n.startTime / beatsPerSecond) <= NOTE_TOLERANCE
                    );

                    if (noteObj) {
                        const timeDiff = Math.abs(currentTime - noteObj.startTime / beatsPerSecond);
                        let accuracy = 'ok';
                        let feedbackText = '✓';

                        // Determine accuracy level
                        if (timeDiff <= PERFECT_TOLERANCE) {
                            accuracy = 'perfect';
                            feedbackText = '✨ PARFAIT !';
                        } else if (timeDiff <= GOOD_TOLERANCE) {
                            accuracy = 'good';
                            feedbackText = '✓ Bien';
                        }

                        // Correct note!
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

                        // In wait mode, resume playback after correct note
                        if (waitMode && pausedAtTimeRef.current !== null) {
                            resumeAfterWait();
                        }
                    }
                } else {
                    // Wrong note (not expected)
                    if (handMode !== 'watch') {
                        setSessionStats(prev => ({
                            ...prev,
                            wrongNotes: prev.wrongNotes + 1,
                            currentCombo: 0 // Reset combo on wrong note
                        }));

                        addFeedback(`✗ ${getFrenchNoteName(note)}`, 'wrong', note);
                    }
                }
            } else {
                // Free play mode - just show the note being played
                addFeedback(`🎹 ${getFrenchNoteName(note)}`, 'freeplay', note);
            }
        };

        const handleNoteOff = (event) => {
            const { note } = event;

            // Remove from active notes (ancienne méthode, conservée pour compatibilité)
            setActiveNotes(prev => {
                const newSet = new Set(prev);
                newSet.delete(note);
                return newSet;
            });

            // Remove from activeKeys.student pour l'allumage visuel des touches
            setActiveKeys(prev => {
                const newStudent = new Set(prev.student);
                newStudent.delete(note);
                return {
                    ...prev,
                    student: newStudent
                };
            });

            // Note: Audio release is handled globally by useMidiAudio hook
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

        let currentMeasure = 1; // 1-indexed
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

    // Jump to a specific measure (with 0.5 measure offset for anticipation)
    const jumpToMeasure = useCallback((measureNumber) => {
        const offsetMeasures = 0.5;
        const targetMeasure = Math.max(0, measureNumber - 1 - offsetMeasures); // Convert to 0-indexed and add offset
        const targetTime = (targetMeasure * beatsPerMeasure) / beatsPerSecond;

        setCurrentTime(targetTime);
        startTimeRef.current = performance.now() - (targetTime / playbackSpeed) * 1000;
        processedNotesRef.current = new Set();
        setPlayedNotes(new Map());
    }, [beatsPerSecond, playbackSpeed]);

    // Jump to a specific time in seconds (for timeline navigation)
    const jumpToTime = useCallback((targetTime) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) setIsPlaying(false);

        // Clamp to valid range
        const clampedTime = Math.max(0, Math.min(totalDuration, targetTime));

        setCurrentTime(clampedTime);
        startTimeRef.current = performance.now() - (clampedTime / playbackSpeed) * 1000;

        // Reset notes processing
        processedNotesRef.current = new Set();
        setPlayedNotes(new Map());
        setFeedbackMessages([]);

        // Détection: si on se positionne avant le début du loop et que le loop est actif
        if (isLoopEnabled && loopConfig) {
            const loopStartTime = ((loopConfig.startMeasure - 1) * beatsPerMeasure) / beatsPerSecond;

            if (clampedTime < loopStartTime) {
                // On est avant la loop, activer le mode "pending"
                setLoopActivationPending(true);
                setLoopWillActivateAt(loopStartTime);
            } else {
                // On est dans ou après la loop, désactiver le pending
                setLoopActivationPending(false);
                setLoopWillActivateAt(null);
            }
        }

        // Reprendre la lecture si elle était active
        if (wasPlaying) {
            setTimeout(() => setIsPlaying(true), 100);
        }
    }, [isPlaying, playbackSpeed, isLoopEnabled, loopConfig, beatsPerSecond]);

    // Set loop for a specific phrase or measure range
    const setLoopForRange = useCallback((startMeasure, endMeasure, name = '') => {
        setLoopConfig({ startMeasure, endMeasure, name });
        setIsLoopEnabled(true);
        // Jump to the start of the loop
        jumpToMeasure(startMeasure);
    }, [jumpToMeasure]);

    // Clear loop
    const clearLoop = useCallback(() => {
        setLoopConfig(null);
        setIsLoopEnabled(false);
        setSelectedPhraseIndex('');
        setCustomRangeStart('');
        setCustomRangeEnd('');
    }, []);

    // Handle phrase selection from dropdown (legacy - now handled by TimelineNavigator)
    // eslint-disable-next-line no-unused-vars
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

    // Handle custom range loop (legacy - now handled by TimelineNavigator)
    // eslint-disable-next-line no-unused-vars
    const handleCustomRangeLoop = useCallback(() => {
        const start = parseInt(customRangeStart);
        const end = parseInt(customRangeEnd);
        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
            setLoopForRange(start, end, `Mesures ${start}-${end}`);
            setSelectedPhraseIndex('custom');
        }
    }, [customRangeStart, customRangeEnd, setLoopForRange]);

    // Handle loop change from timeline (drag handles)
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
            // Désactiver la loop
            clearLoop();
        } else {
            // Créer une loop d'une mesure à la position actuelle
            const currentMeasure = Math.floor((currentTime * beatsPerSecond) / beatsPerMeasure) + 1;
            const loopMeasure = Math.max(1, currentMeasure); // Au moins mesure 1

            setLoopForRange(loopMeasure, loopMeasure, `Mesure ${loopMeasure}`);
        }
    }, [isLoopEnabled, currentTime, beatsPerSecond, clearLoop, setLoopForRange]);

    // Calculate total measures in the song
    const totalMeasures = useMemo(() => {
        return phraseMeasureRanges.length > 0
            ? phraseMeasureRanges[phraseMeasureRanges.length - 1].endMeasure
            : 0;
    }, [phraseMeasureRanges]);

    // Calculate total duration in seconds
    const totalDuration = useMemo(() => {
        return (totalMeasures * beatsPerMeasure) / beatsPerSecond;
    }, [totalMeasures, beatsPerSecond, beatsPerMeasure]);

    // Reset BPM when song changes
    useEffect(() => {
        setCurrentBPM(song?.tempo || 120);
    }, [song?.id, song?.tempo]);

    // Calculate total notes for stats
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

    // Check for notes that should be played at current time (User's responsibility)
    useEffect(() => {
        const currentExpectedNotes = new Set();
        const userHands = new Set();

        if (handMode !== 'watch') {
            if (handMode === 'both' || handMode === 'left') userHands.add('left');
            if (handMode === 'both' || handMode === 'right') userHands.add('right');
        }

        allNotes.forEach(note => {
            // Only expect user to play notes for their selected hand
            if (!userHands.has(note.hand)) return;

            const noteTime = note.startTime / beatsPerSecond;
            const timeDiff = Math.abs(currentTime - noteTime);

            // Note is in the "hit window"
            if (timeDiff <= NOTE_TOLERANCE && !playedNotes.has(note.id)) {
                currentExpectedNotes.add(note.pitch);
            }

            // Note was missed (passed the window without being played)
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

        // Wait mode: Pause when a note is approaching
        if (waitMode && isPlaying && currentExpectedNotes.size > 0) {
            // Check if any expected note is very close (within wait threshold)
            let shouldPause = false;

            for (const note of allNotes) {
                // Skip if not user's hand or already played
                if (!userHands.has(note.hand) || playedNotes.has(note.id)) continue;

                const noteTime = note.startTime / beatsPerSecond;
                const timeDiff = noteTime - currentTime;

                // Note is approaching (between 0 and WAIT_MODE_THRESHOLD ahead)
                if (timeDiff >= 0 && timeDiff <= WAIT_MODE_THRESHOLD) {
                    shouldPause = true;
                    break;
                }
            }

            if (shouldPause && pausedAtTimeRef.current === null) {
                // Pause the playback
                pausedAtTimeRef.current = currentTime;
                setIsPlaying(false);
                console.log('Wait mode: Paused for expected note');
            }
        }
    }, [currentTime, allNotes, beatsPerSecond, handMode, waitMode, isPlaying, playedNotes]);

    // Update activeKeys (expected and computer notes) based on current time
    useEffect(() => {
        if (!isPlaying) {
            // Clear expected and computer keys when not playing
            setActiveKeys(prev => ({
                ...prev,
                expected: new Set(),
                computer: new Set()
            }));
            return;
        }

        const computerHands = new Set();
        const userHands = new Set();

        if (handMode === 'left') {
            userHands.add('left');
            computerHands.add('right');
        } else if (handMode === 'right') {
            userHands.add('right');
            computerHands.add('left');
        } else if (handMode === 'both') {
            userHands.add('left');
            userHands.add('right');
        } else if (handMode === 'watch') {
            computerHands.add('left');
            computerHands.add('right');
        }

        const newExpectedNotes = new Set();
        const newComputerNotes = new Set();

        allNotes.forEach(note => {
            const noteTime = note.startTime / beatsPerSecond;
            const noteEndTime = noteTime + (note.duration / beatsPerSecond);

            // Check if note is currently active (being played)
            const isNoteActive = currentTime >= noteTime && currentTime < noteEndTime;

            // Expected notes (for user hands, in all modes)
            // Ne pas afficher les notes que l'ordinateur va jouer
            if (userHands.has(note.hand) && !playedNotes.has(note.id)) {
                // Show expected notes slightly before they should be played (0.5 secondes d'avance)
                if (currentTime >= noteTime - 0.5 && currentTime < noteTime + NOTE_TOLERANCE) {
                    newExpectedNotes.add(note.pitch);
                }
            }

            // Computer notes (currently being played by computer)
            if (computerHands.has(note.hand) && isNoteActive) {
                newComputerNotes.add(note.pitch);
            }
        });

        setActiveKeys(prev => ({
            ...prev,
            expected: newExpectedNotes,
            computer: newComputerNotes
        }));
    }, [currentTime, isPlaying, handMode, allNotes, beatsPerSecond, waitMode, playedNotes]);

    // Auto-Play Computer Notes
    useEffect(() => {
        if (!isPlaying) return;

        const computerHands = new Set();
        if (handMode === 'left') computerHands.add('right'); // User plays left, computer plays right
        if (handMode === 'right') computerHands.add('left'); // User plays right, computer plays left
        if (handMode === 'watch') {
            computerHands.add('left');
            computerHands.add('right');
        }

        // If computer has nothing to play, return
        if (computerHands.size === 0) return;

        allNotes.forEach(note => {
            if (!computerHands.has(note.hand)) return;
            if (processedNotesRef.current.has(note.id)) return; // Already played

            const noteTime = note.startTime / beatsPerSecond;

            // If it's time to play (or slightly past due but not processed)
            // We use a tight window to trigger the audio
            if (currentTime >= noteTime && currentTime < noteTime + 0.1) {
                // Play audio
                audioEngine.playNote(note.pitch, note.duration / beatsPerSecond);

                // Mark visually as "correct" (or a specific "computer" status?)
                // For now, let's mark as correct so it lights up green/blue
                processedNotesRef.current.add(note.id);
                setPlayedNotes(prev => new Map(prev).set(note.id, 'auto'));
            }
        });
    }, [currentTime, isPlaying, handMode, allNotes, beatsPerSecond]);

    // Metronome Control - Synchronized with measure crossing
    const lastMetronomeClickRef = useRef(-1); // Track last click position

    useEffect(() => {
        if (!isPlaying || !isMetronomeOn || !audioInitialized) {
            audioEngine.stopMetronome();
            // Reset metronome tracking when stopped so it re-syncs on restart
            lastMetronomeClickRef.current = -1;
            return;
        }

        // Calculate current beat position
        const currentBeat = currentTime * beatsPerSecond;

        // Pendant le pré-roll, forcer le métronome en mode beat (1/4)
        const effectiveDivision = isInPreRoll ? 'beat' : metronomeDivision;

        // Calculate click position based on division
        let currentClickPosition;

        switch (effectiveDivision) {
            case 'half-measure':
                // Click twice per measure (1/2)
                currentClickPosition = Math.floor(currentBeat / (beatsPerMeasure / 2));
                break;
            case 'beat':
                // Click on every beat
                // For compound time (ternary), click on dotted quarter notes (1.5 beats)
                // For simple time, click on quarter notes (1 beat)
                if (isCompoundTime) {
                    currentClickPosition = Math.floor(currentBeat / 1.5);
                } else {
                    currentClickPosition = Math.floor(currentBeat);
                }
                break;
            case 'measure':
            default:
                // Click on every measure (1)
                currentClickPosition = Math.floor(currentBeat / beatsPerMeasure);
                break;
        }

        // Play click when position changes (allow negative positions for pre-roll)
        if (currentClickPosition !== lastMetronomeClickRef.current) {
            lastMetronomeClickRef.current = currentClickPosition;

            // Determine if this is an accented beat (first beat of measure)
            const beatInMeasure = Math.floor(currentBeat % beatsPerMeasure);
            const isAccent = effectiveDivision === 'measure' || beatInMeasure < 0.1; // Accent first beat of measure

            // Play click with accent if applicable
            const Tone = audioEngine.getTone();
            audioEngine.playClick(Tone ? Tone.now() : undefined, isAccent);
        }

        // No need for automatic metronome loop anymore
        audioEngine.stopMetronome();

    }, [currentTime, isPlaying, isMetronomeOn, audioInitialized, beatsPerSecond, metronomeDivision, isInPreRoll]);

    // Resume playback after wait mode pause
    const resumeAfterWait = () => {
        if (pausedAtTimeRef.current !== null) {
            setIsPlaying(true);
            startTimeRef.current = performance.now() - (pausedAtTimeRef.current / playbackSpeed) * 1000;
            pausedAtTimeRef.current = null;
        }
    };

    // Add visual feedback
    const addFeedback = (message, type, noteNum, accuracy = null) => {
        const feedback = {
            id: Date.now() + Math.random(), // Ensure unique ID
            message,
            type,
            noteNum,
            accuracy, // 'perfect', 'good', 'ok', or null
            timestamp: Date.now()
        };

        setFeedbackMessages(prev => [...prev, feedback]);

        // Remove feedback after duration based on type
        const duration = accuracy === 'perfect' ? 1500 : 1000; // Perfect notes stay longer
        setTimeout(() => {
            setFeedbackMessages(prev => prev.filter(f => f.id !== feedback.id));
        }, duration);
    };

    // Get note name from MIDI number (French)
    const getMidiNoteName = (midiNum) => {
        return getFrenchNoteName(midiNum);
    };

    const isBlackKey = (midiNote) => {
        const noteInOctave = midiNote % 12;
        return [1, 3, 6, 8, 10].includes(noteInOctave);
    };

    // Convert MIDI note to piano key position
    const getNoteX = (midiNote) => {
        if (midiNote < FIRST_KEY || midiNote > LAST_KEY) return null;

        // Count white keys before this note
        let whiteKeyInfo = 0;
        for (let i = FIRST_KEY; i < midiNote; i++) {
            if (!isBlackKey(i)) whiteKeyInfo++;
        }

        const isNoteBlack = isBlackKey(midiNote);

        if (!isNoteBlack) {
            return whiteKeyInfo * WHITE_KEY_WIDTH;
        } else {
            // Black keys are centered on the boundary between the two surrounding white keys
            const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
            return (whiteKeyInfo * WHITE_KEY_WIDTH) - (BLACK_KEY_WIDTH / 2);
        }
    };

    // Get key color based on state (legacy - color logic is now inline in drawKeyboard)
    // eslint-disable-next-line no-unused-vars
    const getKeyColor = (midiNote, isBlack) => {
        const isPressed = activeNotes.has(midiNote);
        // eslint-disable-next-line no-unused-vars
        const isExpectedNote = expectedNotes.has(midiNote);

        // Check if note was just played
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
    };

    // Draw loop zone highlight
    const drawLoopZone = (ctx) => {
        if (!isLoopEnabled || !loopConfig) return;

        const lookAheadTime = 4;

        const startMeasure = loopConfig.startMeasure - 1; // Convert to 0-indexed
        const endMeasure = loopConfig.endMeasure - 1; // Convert to 0-indexed (endMeasure is exclusive)

        const loopStartTime = (startMeasure * beatsPerMeasure) / beatsPerSecond;
        const loopEndTime = (endMeasure * beatsPerMeasure) / beatsPerSecond;

        // Calculate Y positions for the loop zone
        const startTimeDiff = loopStartTime - currentTime;
        const endTimeDiff = loopEndTime - currentTime;

        const startY = NOTE_FALL_HEIGHT * (1 - startTimeDiff / lookAheadTime);
        const endY = NOTE_FALL_HEIGHT * (1 - endTimeDiff / lookAheadTime);

        // Only draw if at least part of the loop zone is visible
        if (endY >= -50 && startY <= NOTE_FALL_HEIGHT + 50) {
            const rectStartY = Math.max(-10, endY);
            const rectEndY = Math.min(NOTE_FALL_HEIGHT + 10, startY);
            const rectHeight = rectEndY - rectStartY;

            if (rectHeight > 0) {
                // Draw semi-transparent background
                ctx.fillStyle = '#3b82f6';
                ctx.globalAlpha = 0.08;
                ctx.fillRect(0, rectStartY, CANVAS_WIDTH, rectHeight);

                // Draw left border (more prominent)
                ctx.fillStyle = '#3b82f6';
                ctx.globalAlpha = 0.4;
                ctx.fillRect(0, rectStartY, 4, rectHeight);

                // Draw right border (more prominent)
                ctx.fillRect(CANVAS_WIDTH - 4, rectStartY, 4, rectHeight);

                // Draw top border with gradient
                ctx.globalAlpha = 0.6;
                ctx.fillRect(0, rectStartY, CANVAS_WIDTH, 2);

                // Draw bottom border with gradient
                ctx.fillRect(0, rectEndY - 2, CANVAS_WIDTH, 2);

                ctx.globalAlpha = 1.0;
            }
        }
    };

    // Draw measure numbers
    const drawMeasureNumbers = (ctx) => {
        const _keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;
        const lookAheadTime = 4;
        const currentBeat = currentTime * beatsPerSecond;
        const currentMeasure = Math.floor(currentBeat / beatsPerMeasure);
        const highlightedMeasures = new Set(song.highlightedMeasures || []);

        // Draw measure numbers on the left side
        ctx.textAlign = 'left';

        // Calculate which measures are visible
        const firstVisibleMeasure = currentMeasure;
        const lastVisibleMeasure = Math.ceil((currentTime + lookAheadTime) * beatsPerSecond / beatsPerMeasure);

        for (let measure = firstVisibleMeasure; measure <= lastVisibleMeasure; measure++) {
            const measureTime = (measure * beatsPerMeasure) / beatsPerSecond;
            const timeDiff = measureTime - currentTime;

            // Calculate Y position (falling down)
            const y = NOTE_FALL_HEIGHT * (1 - timeDiff / lookAheadTime);

            if (y >= 0 && y <= NOTE_FALL_HEIGHT) {
                const measureNumber = measure + 1;
                const isHighlighted = highlightedMeasures.has(measureNumber);

                // Highlight active measures with different style
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
    };

    // Draw grid lines
    const drawGrid = (ctx, beatsPerSecond) => {
        const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

        // Vertical lines
        ctx.lineWidth = 1;

        // 1. Draw lanes for white key boundaries (faint)
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

        // 2. Draw lanes for black keys
        const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;
        ctx.fillStyle = '#ffffff';

        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (isBlackKey(i)) {
                const x = getNoteX(i);
                // Draw a faint background for the black key lane
                ctx.globalAlpha = 0.03;
                ctx.fillRect(x, 0, BLACK_KEY_WIDTH, keyboardY);

                // Vertical lines at edges of black key lane
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

        // 3. Draw HIT LINE (The "Now" line)
        ctx.globalAlpha = 1.0;
        if (visualEffects) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffffff';
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, keyboardY);
        ctx.lineTo(CANVAS_WIDTH, keyboardY);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset

        // Horizontal lines (Beats) - Moving with the music
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;

        // Determine visible time range
        const lookAheadTime = 4;
        const visibleStartTime = currentTime;
        const visibleEndTime = currentTime + lookAheadTime;

        // Calculate beat duration in seconds (using current BPM)
        const secondsPerBeat = 1 / beatsPerSecond;

        // Find the first beat that is visible
        const firstVisibleBeat = Math.ceil(visibleStartTime / secondsPerBeat);

        // Draw lines for all visible beats
        for (let beat = firstVisibleBeat; beat * secondsPerBeat < visibleEndTime; beat++) {
            const beatTime = beat * secondsPerBeat;
            const timeDiff = beatTime - currentTime;

            // Calculate Y position (falling down)
            const y = NOTE_FALL_HEIGHT * (1 - timeDiff / lookAheadTime);

            if (y >= 0 && y <= NOTE_FALL_HEIGHT) {
                ctx.moveTo(0, y);
                ctx.lineTo(CANVAS_WIDTH, y);
            }
        }

        ctx.stroke();
        ctx.globalAlpha = 1.0;
    };

    // Draw piano keyboard (avec états: expected, computer, student)
    const drawKeyboard = (ctx) => {
        const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;
        const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;

        // Draw white keys first
        ctx.textAlign = 'center';
        ctx.font = '12px Arial';

        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (!isBlackKey(i)) {
                const x = getNoteX(i);
                const _isPressed = activeNotes.has(i);

                // Déterminer l'état de la touche (ordre de priorité)
                const isStudentKey = activeKeys.student.has(i);
                const isComputerKey = activeKeys.computer.has(i);
                const isExpectedKey = activeKeys.expected.has(i);

                // Couleur de base
                let keyColor = COLORS.whiteKey;
                let glowColor = null;
                let outlineColor = null;

                // Ordre de rendu: expected < computer < student
                if (isExpectedKey) {
                    // Note attendue: outline jaune pulsant
                    outlineColor = '#fbbf24';
                    glowColor = 'rgba(251, 191, 36, 0.3)';
                }

                if (isComputerKey) {
                    // Note jouée par l'ordinateur: remplissage bleu clair
                    keyColor = '#93c5fd';
                    glowColor = 'rgba(147, 197, 253, 0.4)';
                }

                if (isStudentKey) {
                    // Note pressée par l'élève: couleur selon précision
                    const recentFeedback = feedbackMessages.find(f => f.noteNum === i);
                    if (recentFeedback) {
                        if (recentFeedback.type === 'correct') {
                            keyColor = COLORS.whiteKeyCorrect;
                            glowColor = 'rgba(34, 197, 94, 0.6)';
                        } else if (recentFeedback.type === 'wrong') {
                            keyColor = COLORS.whiteKeyWrong;
                            glowColor = 'rgba(239, 68, 68, 0.6)';
                        }
                    } else {
                        keyColor = COLORS.whiteKeyPressed;
                        glowColor = 'rgba(59, 130, 246, 0.6)';
                    }
                }

                // Appliquer le glow si nécessaire
                if (glowColor && visualEffects) {
                    ctx.shadowColor = glowColor;
                    ctx.shadowBlur = 10;
                }

                // Dessiner la touche
                ctx.fillStyle = keyColor;
                ctx.fillRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);

                // Reset shadow
                ctx.shadowBlur = 0;

                // Border normale
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);

                // Outline pour expected notes (pulsant)
                if (isExpectedKey && outlineColor) {
                    const pulse = visualEffects ? Math.sin(Date.now() / 200) * 0.3 + 0.7 : 0.8;
                    ctx.strokeStyle = outlineColor;
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = pulse;
                    ctx.strokeRect(x + 2, keyboardY + 2, WHITE_KEY_WIDTH - 5, KEYBOARD_HEIGHT - 4);
                    ctx.globalAlpha = 1.0;
                    ctx.lineWidth = 1;
                }

                // Label (French) - without octave numbers
                ctx.fillStyle = (isStudentKey || isComputerKey) ? '#ffffff' : '#555';
                const label = getMidiNoteName(i).replace(/[0-9-]/g, '');
                ctx.fillText(label, x + WHITE_KEY_WIDTH / 2, keyboardY + KEYBOARD_HEIGHT - 10);
            }
        }

        // Draw black keys on top
        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (isBlackKey(i)) {
                const x = getNoteX(i);
                const _isPressed = activeNotes.has(i);
                const blackKeyHeight = KEYBOARD_HEIGHT * 0.65;

                // Déterminer l'état de la touche (ordre de priorité)
                const isStudentKey = activeKeys.student.has(i);
                const isComputerKey = activeKeys.computer.has(i);
                const isExpectedKey = activeKeys.expected.has(i);

                // Couleur de base
                let keyColor = COLORS.blackKey;
                let glowColor = null;
                let outlineColor = null;

                // Ordre de rendu: expected < computer < student
                if (isExpectedKey) {
                    // Note attendue: outline jaune pulsant
                    outlineColor = '#fbbf24';
                    glowColor = 'rgba(251, 191, 36, 0.3)';
                }

                if (isComputerKey) {
                    // Note jouée par l'ordinateur: remplissage bleu clair (plus foncé pour touche noire)
                    keyColor = '#60a5fa';
                    glowColor = 'rgba(96, 165, 250, 0.4)';
                }

                if (isStudentKey) {
                    // Note pressée par l'élève: couleur selon précision
                    const recentFeedback = feedbackMessages.find(f => f.noteNum === i);
                    if (recentFeedback) {
                        if (recentFeedback.type === 'correct') {
                            keyColor = COLORS.blackKeyCorrect;
                            glowColor = 'rgba(34, 197, 94, 0.6)';
                        } else if (recentFeedback.type === 'wrong') {
                            keyColor = COLORS.blackKeyWrong;
                            glowColor = 'rgba(239, 68, 68, 0.6)';
                        }
                    } else {
                        keyColor = COLORS.blackKeyPressed;
                        glowColor = 'rgba(59, 130, 246, 0.6)';
                    }
                }

                // Appliquer le glow si nécessaire
                if (glowColor && visualEffects) {
                    ctx.shadowColor = glowColor;
                    ctx.shadowBlur = 10;
                }

                // Dessiner la touche
                ctx.fillStyle = keyColor;
                ctx.fillRect(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight);

                // Reset shadow
                ctx.shadowBlur = 0;

                // Border normale
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight);

                // Outline pour expected notes (pulsant)
                if (isExpectedKey && outlineColor) {
                    const pulse = visualEffects ? Math.sin(Date.now() / 200) * 0.3 + 0.7 : 0.8;
                    ctx.strokeStyle = outlineColor;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = pulse;
                    ctx.strokeRect(x + 1, keyboardY + 1, BLACK_KEY_WIDTH - 2, blackKeyHeight - 2);
                    ctx.globalAlpha = 1.0;
                    ctx.lineWidth = 1;
                }

                // Label
                ctx.fillStyle = (isStudentKey || isComputerKey) ? '#ffffff' : '#ccc';
                ctx.font = '10px Arial';
                const label = getMidiNoteName(i);
                const shortLabel = label.replace(/[0-9-]/g, '');
                ctx.fillText(shortLabel, x + BLACK_KEY_WIDTH / 2, keyboardY + blackKeyHeight - 8);
            }
        }
    };

    // Helper function to draw rounded rectangle
    const drawRoundedRect = (ctx, x, y, width, height, radius) => {
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
    };

    // Helper function to darken a color (for black keys)
    const darkenColor = (color, amount = 0.3) => {
        // Convert hex to RGB
        let r, g, b;
        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return color; // Return as-is if not hex
        }

        // Darken by reducing RGB values
        r = Math.floor(r * (1 - amount));
        g = Math.floor(g * (1 - amount));
        b = Math.floor(b * (1 - amount));

        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    // Draw falling notes
    const drawFallingNotes = (ctx, currentTime) => {
        const lookAheadTime = 4; // Show notes 4 seconds ahead
        const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;

        allNotes.forEach(note => {
            const noteStartTime = note.startTime / beatsPerSecond;
            const noteEndTime = (note.startTime + note.duration) / beatsPerSecond;

            // Only draw notes that are visible
            if (noteEndTime < currentTime - 1 || noteStartTime > currentTime + lookAheadTime) {
                return;
            }

            const playStatus = playedNotes.get(note.id);

            // If played correctly or by computer, don't draw the "falling" part if it's past the hit line
            // Or maybe draw it as "exploded" / different opacity?
            // User requested: "Allumage des notes jouées" - maybe they mean the 'hit' effect.
            // But usually in LivePlay, helpful notes disappear after being hit or turn into 'sparks'.
            // Let's fade them out aggressively if correct.

            if ((playStatus === 'correct' || playStatus === 'auto') && currentTime > noteStartTime + 0.1) {
                // If it's been hit, maybe don't draw it anymore?
                // return;
            }

            const x = getNoteX(note.pitch);
            if (x === null) return;

            // Calculate Y position (notes fall down)
            const startY = NOTE_FALL_HEIGHT * (1 - (noteStartTime - currentTime) / lookAheadTime);
            const endY = NOTE_FALL_HEIGHT * (1 - (noteEndTime - currentTime) / lookAheadTime);
            const height = Math.max(startY - endY, 5);

            if (endY < 0 && startY < 0) return; // Entirely above screen

            // Determine color based on play status
            let color = note.hand === 'right' ? COLORS.rightHand : COLORS.leftHand;

            if (playStatus === 'correct') {
                color = COLORS.playedCorrect;
            } else if (playStatus === 'missed') {
                color = COLORS.missed;
            } else if (playStatus === 'auto') {
                // Computer played it
                color = note.hand === 'right' ? '#93c5fd' : '#f9a8d4'; // Lighter version
            }

            // Draw note rectangle
            const isNoteBlack = isBlackKey(note.pitch);
            // Make black key notes thinner (50% instead of 65%)
            const noteWidth = isNoteBlack ? WHITE_KEY_WIDTH * 0.5 : WHITE_KEY_WIDTH - 2;
            const noteX = isNoteBlack ? x + (BLACK_KEY_WIDTH - noteWidth) / 2 : x + 1; // Center black notes

            // Darken color for black keys (sharps and flats)
            if (isNoteBlack && playStatus !== 'correct' && playStatus !== 'missed') {
                color = darkenColor(color, 0.35);
            }

            // Special effect for hit notes
            if (playStatus === 'correct' || playStatus === 'auto') {
                ctx.globalAlpha = 0.3; // Fade out hit notes
                if (visualEffects) {
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = color;
                }
            } else {
                ctx.globalAlpha = 0.8;
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = color;

            // Draw rounded rectangle
            const radius = 6; // Border radius
            drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
            ctx.fill();

            // Draw border
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
            ctx.stroke();

            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;

            // Draw Label inside note
            if (height > 15) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                const label = getMidiNoteName(note.pitch).replace(/[0-9-]/g, '');
                ctx.save();
                ctx.beginPath();
                drawRoundedRect(ctx, noteX, endY, noteWidth, height, radius);
                ctx.clip();
                ctx.fillText(label, noteX + noteWidth / 2, endY + height / 2 + 4);
                ctx.restore();
            }
        });
    };

    // Draw feedback messages
    const drawFeedback = (ctx) => {
        feedbackMessages.forEach((feedback, index) => {
            const x = getNoteX(feedback.noteNum);
            if (x === null) return;

            const y = CANVAS_HEIGHT - KEYBOARD_HEIGHT - 60 - (index * 35);
            const age = Date.now() - feedback.timestamp;
            const duration = feedback.accuracy === 'perfect' ? 1500 : 1000;
            const opacity = Math.max(0, 1 - age / duration);

            ctx.globalAlpha = opacity;

            // Determine color and font size based on accuracy
            let color = COLORS.playedCorrect;
            let fontSize = 18;
            let fontWeight = 'bold';

            if (feedback.type === 'correct') {
                if (feedback.accuracy === 'perfect') {
                    color = '#fbbf24'; // Gold for perfect
                    fontSize = 22;
                    // Add sparkle effect for perfect notes
                    if (visualEffects) {
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = '#fbbf24';
                    }
                } else if (feedback.accuracy === 'good') {
                    color = '#22c55e'; // Green for good
                    fontSize = 20;
                }
            } else if (feedback.type === 'wrong') {
                color = COLORS.playedWrong;
            } else if (feedback.type === 'freeplay') {
                color = '#60a5fa'; // Blue for free play
                fontSize = 16;
            }

            ctx.font = `${fontWeight} ${fontSize}px Arial`;
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.fillText(feedback.message, x + WHITE_KEY_WIDTH / 2, y);

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        });
    };

    // Draw combo counter
    const drawCombo = (ctx) => {
        if (sessionStats.currentCombo <= 2) return; // Only show combo after 3+ notes

        const comboX = CANVAS_WIDTH - 150;
        const comboY = 80;

        // Draw combo background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(comboX - 20, comboY - 50, 140, 70);
        ctx.strokeStyle = sessionStats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';
        ctx.lineWidth = 3;
        ctx.strokeRect(comboX - 20, comboY - 50, 140, 70);

        // Draw combo text
        ctx.textAlign = 'center';
        ctx.fillStyle = sessionStats.currentCombo >= 10 ? '#fbbf24' : '#22c55e';

        // Combo number
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`${sessionStats.currentCombo}x`, comboX + 50, comboY - 10);

        // "COMBO" label
        ctx.font = 'bold 14px Arial';
        ctx.fillText('COMBO', comboX + 50, comboY + 5);

        // Add pulse effect for high combos
        if (sessionStats.currentCombo >= 10) {
            if (visualEffects) {
                const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;
                ctx.globalAlpha = pulse;
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#fbbf24';
            }
            ctx.fillText('🔥', comboX + 50, comboY - 25);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        }
    };

    // Draw enhanced hit line with glow effect
    const drawHitLine = (ctx) => {
        const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

        if (visualEffects) {
            // Outer glow - Extended
            ctx.shadowBlur = 30;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(0, keyboardY);
            ctx.lineTo(CANVAS_WIDTH, keyboardY);
            ctx.stroke();

            // Core line (brightest)
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffffff';
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, keyboardY);
        ctx.lineTo(CANVAS_WIDTH, keyboardY);
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow
    };

    // Main render loop
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw loop zone first (in background)
        drawLoopZone(ctx);

        // Draw measure numbers (in background)
        drawMeasureNumbers(ctx);

        // Draw Grid (pass beatsPerSecond for tempo adjustment)
        drawGrid(ctx, beatsPerSecond);

        // Draw falling notes
        drawFallingNotes(ctx, currentTime);

        // Draw keyboard
        drawKeyboard(ctx);

        // Draw enhanced hit line with glow effect
        drawHitLine(ctx);

        // Draw feedback messages
        drawFeedback(ctx);

        // Draw combo counter
        drawCombo(ctx);

    }, [currentTime, activeNotes, playedNotes, feedbackMessages, expectedNotes, sessionStats.currentCombo, activeKeys]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying) return;

        const animate = () => {
            if (!startTimeRef.current) {
                startTimeRef.current = performance.now();
            }

            const elapsed = (performance.now() - startTimeRef.current) / 1000 * playbackSpeed;

            // Gestion du pré-roll (mesure de préparation)
            if (isInPreRoll && elapsed >= preRollEndTimeRef.current) {
                // Le pré-roll se termine quand on atteint le temps cible
                setIsInPreRoll(false);
                // Restaurer l'état du métronome
                setIsMetronomeOn(metronomeWasOn);
            }

            // Gestion du loop intelligent (activation automatique)
            if (loopActivationPending && loopWillActivateAt !== null && elapsed >= loopWillActivateAt) {
                setLoopActivationPending(false);
                setLoopWillActivateAt(null);
                // La loop s'active maintenant automatiquement
            }

            // Handle loop logic for configured loop range (seulement si pas en mode pending)
            if (isLoopEnabled && loopConfig && !loopActivationPending) {
                const firstMeasure = loopConfig.startMeasure - 1; // Convert to 0-indexed
                const lastMeasure = loopConfig.endMeasure - 1; // Convert to 0-indexed (endMeasure is exclusive)

                const loopStartTime = (firstMeasure * beatsPerMeasure) / beatsPerSecond;
                const loopEndTime = (lastMeasure * beatsPerMeasure) / beatsPerSecond;

                // If elapsed has passed the end of the loop zone, reset to the beginning
                if (elapsed >= loopEndTime) {
                    // Retour direct au début de la loop (pas de pré-roll entre les itérations)
                    startTimeRef.current = performance.now() - (loopStartTime / playbackSpeed) * 1000;
                    setCurrentTime(loopStartTime);
                    // Reset played notes and processed notes for the loop
                    processedNotesRef.current = new Set();
                    setPlayedNotes(new Map());
                    return; // Skip the rest of this frame to prevent double-rendering
                }
            }

            setCurrentTime(elapsed);

            // In wait mode, pause only when notes are at the hit line (not just in the tolerance window)
            if (waitMode && pausedAtTimeRef.current === null && handMode !== 'watch') {
                // Determine which hands the user is playing
                const userHands = new Set();
                if (handMode === 'both' || handMode === 'left') userHands.add('left');
                if (handMode === 'both' || handMode === 'right') userHands.add('right');

                // Check if any user note is at or past the hit line
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
    }, [isPlaying, playbackSpeed, waitMode, expectedNotes, allNotes, beatsPerSecond, playedNotes, isLoopEnabled, loopConfig, isInPreRoll, metronomeWasOn, loopActivationPending, loopWillActivateAt, handMode]);

    // Render on state changes
    useEffect(() => {
        render();
    }, [render]);

    // Check if song is completed
    useEffect(() => {
        if (allNotes.length > 0 && currentTime > 0) {
            const lastNoteTime = Math.max(...allNotes.map(n => (n.startTime + n.duration) / beatsPerSecond));

            if (currentTime > lastNoteTime + 1 && !sessionStats.completed) {
                // Song completed!
                handleSongCompleted();
            }
        }
    }, [currentTime, allNotes, sessionStats.completed]);

    const handleSongCompleted = () => {
        setIsPlaying(false);
        setSessionStats(prev => ({ ...prev, completed: true }));

        // Save score
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

        // Reload stats
        const stats = ScoreService.getSongStatistics(song.id);
        setSongStats(stats);

        alert(`Bravo ! Morceau terminé !\nPrécision: ${accuracy}%\nNotes correctes: ${sessionStats.correctNotes}/${sessionStats.totalNotes}`);
    };

    // Play/Pause controls (avec pré-roll optionnel de 1 mesure)
    const handlePlayPause = () => {
        if (isPlaying) {
            // Pause
            setIsPlaying(false);
            startTimeRef.current = null;
            setIsInPreRoll(false);
        } else {
            // Play avec pré-roll optionnel de 1 mesure
            if (!sessionStats.startTime) {
                setSessionStats(prev => ({ ...prev, startTime: new Date().toISOString() }));
            }

            let targetStartTime;

            if (isLoopEnabled && loopConfig) {
                // Si loop actif, démarrer au début du loop
                targetStartTime = ((loopConfig.startMeasure - 1) * beatsPerMeasure) / beatsPerSecond;
            } else {
                // Sinon, démarrer à la position actuelle (ou au début)
                targetStartTime = currentTime === 0 ? 0 : currentTime;
            }

            if (preRollEnabled) {
                // Avec pré-roll: sauvegarder l'état du métronome et le forcer à ON
                setMetronomeWasOn(isMetronomeOn);
                setIsMetronomeOn(true);

                const preparationTime = beatsPerMeasure / beatsPerSecond; // 1 mesure en secondes

                // Stocker le temps où le pré-roll doit se terminer
                preRollEndTimeRef.current = targetStartTime;

                // Démarrer -1 mesure avant (peut être négatif)
                const preRollStartTime = targetStartTime - preparationTime;

                setCurrentTime(preRollStartTime);
                startTimeRef.current = performance.now() - (preRollStartTime / playbackSpeed) * 1000;
                setIsPlaying(true);
                setIsInPreRoll(true);
            } else {
                // Sans pré-roll: démarrer directement
                setCurrentTime(targetStartTime);
                startTimeRef.current = performance.now() - (targetStartTime / playbackSpeed) * 1000;
                setIsPlaying(true);
                setIsInPreRoll(false);
            }
        }
    };

    const handleReset = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        startTimeRef.current = null;
        pausedAtTimeRef.current = null;
        processedNotesRef.current = new Set(); // Reset processed notes tracking
        lastMetronomeClickRef.current = -1; // Reset metronome tracking
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

    // Snap tempo to predefined values
    const snapTempo = (value) => {
        const snapPoints = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
        const bpmSnapPoints = snapPoints.map(p => Math.round(defaultBPM * p));

        // Find closest snap point
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
        handleBPMChange(snapped);
    };

    const calculateAccuracy = () => {
        if (sessionStats.totalNotes === 0) return 0;
        return ((sessionStats.correctNotes / sessionStats.totalNotes) * 100).toFixed(1);
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

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                maxWidth: `${CANVAS_WIDTH}px`
            }}>
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                }}>
                    Mode LivePlay - {song.title}
                </h2>

                <button
                    onClick={() => setShowScores(!showScores)}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {showScores ? 'Masquer' : 'Voir'} Statistiques
                </button>
            </div>

            {/* Statistics Panel */}
            {showScores && songStats && (
                <div style={{
                    width: '100%',
                    maxWidth: `${CANVAS_WIDTH}px`,
                    padding: '1.5rem',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)'
                }}>
                    <h3 style={{
                        fontSize: '1.2rem',
                        fontWeight: '600',
                        marginBottom: '1.5rem',
                        color: 'var(--text-primary)'
                    }}>
                        Statistiques - {song.title}
                    </h3>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem'
                    }}>
                        <StatCard label="Sessions jouées" value={songStats.totalSessions} />
                        <StatCard label="Précision moyenne" value={`${songStats.averageAccuracy}%`} />
                        <StatCard label="Meilleure précision" value={`${songStats.bestAccuracy}%`} />
                        <StatCard label="Notes correctes" value={songStats.totalCorrectNotes} color="#22c55e" />
                        <StatCard label="Notes manquées" value={songStats.totalMissedNotes} color="#f59e0b" />
                        <StatCard label="Notes incorrectes" value={songStats.totalWrongNotes} color="#ef4444" />
                        <StatCard label="Vitesse moyenne" value={`${songStats.averageSpeed}x`} />
                        <StatCard label="Taux de complétion" value={`${songStats.completionRate}%`} />
                    </div>
                </div>
            )}

            {/* Top Controls - Metronome and Tempo */}
            <div style={{
                width: '100%',
                maxWidth: `${CANVAS_WIDTH}px`,
                display: 'flex',
                gap: '1rem',
                padding: '0.5rem 0.75rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                {/* Metronome Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => setIsMetronomeOn(!isMetronomeOn)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: isMetronomeOn ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                            color: isMetronomeOn ? '#22c55e' : 'var(--text-secondary)',
                            border: isMetronomeOn ? '2px solid #22c55e' : '2px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap'
                        }}
                        title="Métronome"
                    >
                        Métronome
                    </button>

                    {isMetronomeOn && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
                                Division:
                            </span>
                            {['measure', 'half-measure', 'beat'].map((division, idx) => {
                                const labels = ['1', '1/2', '1/4'];
                                return (
                                    <button
                                        key={division}
                                        onClick={() => setMetronomeDivision(division)}
                                        style={{
                                            padding: '0.4rem 0.8rem',
                                            background: metronomeDivision === division ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: metronomeDivision === division ? 'white' : 'var(--text-primary)',
                                            border: metronomeDivision === division ? 'none' : '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            minWidth: '45px'
                                        }}
                                    >
                                        {labels[idx]}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pre-roll Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        onClick={() => setPreRollEnabled(!preRollEnabled)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: preRollEnabled ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                            color: preRollEnabled ? '#3b82f6' : 'var(--text-secondary)',
                            border: preRollEnabled ? '2px solid #3b82f6' : '2px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap'
                        }}
                        title="Activer/désactiver le pré-roll d'une mesure avant le démarrage"
                    >
                        Pré-roll
                    </button>
                </div>

                {/* Tempo Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '500px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        Tempo:
                    </span>
                    <input
                        type="range"
                        min={Math.round(defaultBPM * 0.25)}
                        max={Math.round(defaultBPM * 2)}
                        value={currentBPM}
                        onChange={handleTempoSliderChange}
                        style={{
                            flex: 1,
                            cursor: 'pointer',
                            accentColor: 'var(--accent-primary)'
                        }}
                    />
                    <span style={{
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        minWidth: '100px',
                        textAlign: 'right'
                    }}>
                        {currentBPM} BPM ({Math.round((currentBPM / defaultBPM) * 100)}%)
                    </span>
                </div>
            </div>

            {/* Current Session Stats */}
            <div style={{
                width: '100%',
                maxWidth: `${CANVAS_WIDTH}px`,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                        Précision
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {calculateAccuracy()}%
                    </div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                        ✓ Correctes
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e' }}>
                        {sessionStats.correctNotes}/{sessionStats.totalNotes}
                    </div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                        ✗ Incorrectes
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ef4444' }}>
                        {sessionStats.wrongNotes}
                    </div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>
                        ⊘ Manquées
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f59e0b' }}>
                        {sessionStats.missedNotes}
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <div style={{
                border: '2px solid var(--border-color)',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-xl)',
                position: 'relative' // For overlay elements if needed
            }}>
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    style={{
                        display: 'block',
                        backgroundColor: COLORS.background
                    }}
                />
            </div>

            {/* Main Controls - Single Line */}
            <div style={{
                width: '100%',
                maxWidth: `${CANVAS_WIDTH}px`,
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                justifyContent: 'space-between'
            }}>
                {/* Left Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        onClick={handlePlayPause}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.875rem'
                        }}
                    >
                        {isPlaying ? 'Pause' : 'Jouer'}
                    </button>

                    <button
                        onClick={handleReset}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem'
                        }}
                    >
                        Recommencer
                    </button>

                    <button
                        onClick={() => setHandMode(handMode === 'watch' ? 'both' : 'watch')}
                        style={{
                            padding: '0.5rem 1rem',
                            background: handMode === 'watch' ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                            color: handMode === 'watch' ? 'white' : 'var(--text-primary)',
                            border: handMode === 'watch' ? 'none' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem'
                        }}
                        title="Basculer entre mode écoute et mode pratique"
                    >
                        {handMode === 'watch' ? 'Écoute' : 'Pratique'}
                    </button>

                    <button
                        onClick={() => setWaitMode(!waitMode)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: waitMode ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                            color: waitMode ? 'white' : 'var(--text-primary)',
                            border: waitMode ? 'none' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem'
                        }}
                    >
                        {waitMode ? 'Attente' : 'Continue'}
                    </button>

                    <button
                        onClick={() => setFreePlayMode(!freePlayMode)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: freePlayMode ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                            color: freePlayMode ? 'white' : 'var(--text-primary)',
                            border: freePlayMode ? 'none' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem'
                        }}
                        title="Mode libre : jouez sans contrainte, pas de notes manquées"
                    >
                        {freePlayMode ? 'Libre' : 'Guidé'}
                    </button>

                    <button
                        onClick={() => setVisualEffects(!visualEffects)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: visualEffects ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                            color: visualEffects ? 'white' : 'var(--text-primary)',
                            border: visualEffects ? 'none' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem'
                        }}
                        title="Activer/désactiver les effets visuels (glow, ombres). Désactiver améliore les performances."
                    >
                        {visualEffects ? '✨ Effets' : '⚡ Perf'}
                    </button>
                </div>

                {/* Right - Hand Selection (when in practice mode) */}
                {handMode !== 'watch' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Main:
                        </span>
                        <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            {['left', 'both', 'right'].map((hand) => {
                                const labels = { left: 'Gauche', both: 'Les deux', right: 'Droite' };
                                return (
                                    <button
                                        key={hand}
                                        onClick={() => setHandMode(hand)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: handMode === hand ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: handMode === hand ? 'var(--bg-primary)' : 'var(--text-primary)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: '500',
                                            borderRight: hand !== 'right' ? '1px solid var(--border-color)' : 'none'
                                        }}
                                    >
                                        {labels[hand]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Time Display */}
                        <div style={{
                            marginLeft: '1rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                            fontFamily: 'monospace',
                            fontWeight: '600'
                        }}>
                            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                        </div>
                    </div>
                )}
            </div>

            {/* Timeline Navigator - Navigation & Loop Controls */}
            <div style={{
                width: '100%',
                maxWidth: `${CANVAS_WIDTH}px`
            }}>
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

            {/* Legend */}
            <div style={{
                display: 'flex',
                gap: '2rem',
                padding: '1rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap'
            }}>
                <LegendItem color={COLORS.rightHand} label="Main droite (MD)" />
                <LegendItem color={COLORS.leftHand} label="Main gauche (MG)" />
                <LegendItem color={COLORS.playedCorrect} label="Note correcte" />
                <LegendItem color={COLORS.playedWrong} label="Note incorrecte" />
                <LegendItem color={COLORS.missed} label="Note manquée" />
            </div>

            {/* Instructions */}
            <div style={{
                padding: '1rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                maxWidth: '800px'
            }}>
                <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    marginBottom: '0.75rem',
                    color: 'var(--text-primary)'
                }}>
                    Mode d'emploi
                </h3>
                <ul style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    paddingLeft: '1.5rem'
                }}>
                    <li>Les notes tombent du haut vers le clavier en bas</li>
                    <li><strong>Ligne de jeu :</strong> Jouez la note quand elle touche le haut du clavier (ligne lumineuse) !</li>
                    <li>Connectez votre clavier MIDI pour jouer en temps réel</li>
                    <li>Clicker sur le bouton de main active pour passer en <strong>Mode Écoute</strong> (l'ordinateur joue tout)</li>
                    <li><strong>Mode Attente:</strong> La lecture s'arrête jusqu'à ce que vous jouiez la bonne note</li>
                    <li>Vos performances sont enregistrées et affichées dans les statistiques</li>
                </ul>
            </div>
        </div>
    );
}

// Helper Components
function StatCard({ label, value, color }) {
    return (
        <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
        }}>
            <div style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem'
            }}>
                {label}
            </div>
            <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: color || 'var(--text-primary)'
            }}>
                {value}
            </div>
        </div>
    );
}

function LegendItem({ color, label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: color,
                borderRadius: '4px'
            }}></div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {label}
            </span>
        </div>
    );
}
