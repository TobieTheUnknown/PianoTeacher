import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { ScoreService } from '../services/ScoreService';
import { getFrenchNoteName } from '../models/song';
import { audioEngine } from '../services/AudioEngine';

/**
 * SynthesiaView - Falling notes visualization with scoring and wait mode
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
    whiteKeyPressed: '#e6e6e6',
    blackKeyPressed: '#333333',
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

export function SynthesiaView({ song }) {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(null);
    const pausedAtTimeRef = useRef(null);
    const processedNotesRef = useRef(new Set()); // Track notes already marked as missed

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentBPM, setCurrentBPM] = useState(song?.tempo || 120);
    const [midiAccess, setMidiAccess] = useState(null);
    const [activeNotes, setActiveNotes] = useState(new Set());

    // New features state
    const [handMode, setHandMode] = useState('both'); // 'left', 'right', 'both'
    const [isMetronomeOn, setIsMetronomeOn] = useState(false);
    const [metronomeDivision, setMetronomeDivision] = useState('measure'); // 'measure', 'half-measure', 'beat'
    const [audioInitialized, setAudioInitialized] = useState(false);

    // New scoring and wait mode state
    const [waitMode, setWaitMode] = useState(false);
    const [showScores, setShowScores] = useState(false);
    const [sessionStats, setSessionStats] = useState({
        correctNotes: 0,
        wrongNotes: 0,
        missedNotes: 0,
        totalNotes: 0,
        startTime: null,
        completed: false
    });
    const [playedNotes, setPlayedNotes] = useState(new Map()); // Track which notes have been played
    const [feedbackMessages, setFeedbackMessages] = useState([]); // Visual feedback for correct/wrong
    const [expectedNotes, setExpectedNotes] = useState(new Set()); // Notes that should be played now
    const [songStats, setSongStats] = useState(null);

    // Canvas dimensions
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 800;
    const KEYBOARD_HEIGHT = 150;
    const NOTE_FALL_HEIGHT = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Piano keyboard constants (88 keys, A0 to C8)
    const FIRST_KEY = 21; // MIDI note A0
    const LAST_KEY = 108; // MIDI note C8
    const WHITE_KEY_WIDTH = CANVAS_WIDTH / 52; // 52 white keys

    // Timing tolerance for note detection (in seconds)
    const NOTE_TOLERANCE = 0.3; // 300ms window
    const WAIT_MODE_THRESHOLD = 0.05; // Wait mode triggers when note is within 50ms of hit line

    // Initialize Audio & MIDI
    useEffect(() => {
        // Init Audio Service on mount (requires user interaction technically, but we prepare it)
        const initAudio = async () => {
            await audioEngine.initialize();
            setAudioInitialized(true);
        };
        initAudio();

        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess()
                .then(access => {
                    setMidiAccess(access);
                    setupMIDIInputs(access);
                })
                .catch(err => console.warn('MIDI access denied:', err));
        }

        return () => {
            audioEngine.stopAll();
        };
    }, []);

    const setupMIDIInputs = (access) => {
        access.inputs.forEach(input => {
            input.onmidimessage = handleMIDIMessage;
        });
    };

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
        } catch (e) {
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
                currentTime += (phrase.duration || phrase.length * 4 || 4);
            }
        } catch (error) {
            console.error('Error in getAllNotes:', error);
            return [];
        }

        return notes.sort((a, b) => a.startTime - b.startTime);
    }, [song]);

    // Memoize allNotes to prevent recalculation on every render
    const allNotes = useMemo(() => getAllNotes(), [getAllNotes]);
    const defaultBPM = song?.tempo || 120;
    const playbackSpeed = currentBPM / defaultBPM;
    const beatsPerSecond = currentBPM / 60;

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
    }, [currentTime, allNotes, beatsPerSecond, handMode]);

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
        const beatsPerMeasure = 4;
        const currentBeat = currentTime * beatsPerSecond;

        // Calculate click position based on division
        let currentClickPosition;
        let clicksPerMeasure;

        switch (metronomeDivision) {
            case 'half-measure':
                // Click twice per measure (1/2)
                currentClickPosition = Math.floor(currentBeat / 2);
                clicksPerMeasure = 2;
                break;
            case 'beat':
                // Click on every beat (4 times per measure in 4/4) (1/4)
                currentClickPosition = Math.floor(currentBeat);
                clicksPerMeasure = beatsPerMeasure;
                break;
            case 'measure':
            default:
                // Click on every measure (1)
                currentClickPosition = Math.floor(currentBeat / beatsPerMeasure);
                clicksPerMeasure = 1;
                break;
        }

        // Play click when position changes
        if (currentClickPosition !== lastMetronomeClickRef.current && currentClickPosition >= 0) {
            lastMetronomeClickRef.current = currentClickPosition;

            // Determine if this is an accented beat (first beat of measure)
            const beatInMeasure = Math.floor(currentBeat % beatsPerMeasure);
            const isAccent = metronomeDivision === 'measure' || beatInMeasure < 0.1; // Accent first beat of measure

            // Play click with accent if applicable
            audioEngine.playClick(Tone.now(), isAccent);
        }

        // No need for automatic metronome loop anymore
        audioEngine.stopMetronome();

    }, [currentTime, isPlaying, isMetronomeOn, audioInitialized, beatsPerSecond, metronomeDivision]);

    // MIDI message handler with note detection
    const handleMIDIMessage = (message) => {
        const [command, note, velocity] = message.data;

        if (command === 144 && velocity > 0) {
            // Note on
            setActiveNotes(prev => new Set([...prev, note]));

            // Check if this note is expected
            const isExpected = expectedNotes.has(note);

            if (isExpected) {
                // Find the note object
                const noteObj = allNotes.find(n =>
                    n.pitch === note &&
                    !playedNotes.has(n.id) &&
                    Math.abs(currentTime - n.startTime / beatsPerSecond) <= NOTE_TOLERANCE
                );

                if (noteObj) {
                    // Correct note!
                    processedNotesRef.current.add(noteObj.id); // Mark as processed
                    setPlayedNotes(prev => new Map(prev).set(noteObj.id, 'correct'));
                    setSessionStats(prev => ({
                        ...prev,
                        correctNotes: prev.correctNotes + 1
                    }));

                    addFeedback(`✓ ${getMidiNoteName(note)}`, 'correct', note);

                    // In wait mode, resume playback after correct note
                    if (waitMode && pausedAtTimeRef.current !== null) {
                        resumeAfterWait();
                    }
                }
            } else {
                // Only count wrong notes if we are supposed to be playing something
                if (handMode !== 'watch') {
                    setSessionStats(prev => ({
                        ...prev,
                        wrongNotes: prev.wrongNotes + 1
                    }));

                    addFeedback(`✗ ${getMidiNoteName(note)}`, 'wrong', note);
                }
            }
        } else if (command === 128 || (command === 144 && velocity === 0)) {
            // Note off
            setActiveNotes(prev => {
                const newSet = new Set(prev);
                newSet.delete(note);
                return newSet;
            });
        }
    };

    // Resume playback after wait mode pause
    const resumeAfterWait = () => {
        if (pausedAtTimeRef.current !== null) {
            setIsPlaying(true);
            startTimeRef.current = performance.now() - (pausedAtTimeRef.current / playbackSpeed) * 1000;
            pausedAtTimeRef.current = null;
        }
    };

    // Add visual feedback
    const addFeedback = (message, type, noteNum) => {
        const feedback = {
            id: Date.now(),
            message,
            type,
            noteNum,
            timestamp: Date.now()
        };

        setFeedbackMessages(prev => [...prev, feedback]);

        // Remove feedback after 1 second
        setTimeout(() => {
            setFeedbackMessages(prev => prev.filter(f => f.id !== feedback.id));
        }, 1000);
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

    // Get key color based on state
    const getKeyColor = (midiNote, isBlack) => {
        const isPressed = activeNotes.has(midiNote);
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

        // Highlight expected notes on keyboard
        /*
        if (isExpectedNote) {
             return isBlack ? '#444' : '#eee';
        }
        */

        return isBlack ? COLORS.blackKey : COLORS.whiteKey;
    };

    // Draw measure numbers
    const drawMeasureNumbers = (ctx) => {
        const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;
        const lookAheadTime = 4;
        const beatsPerMeasure = 4;
        const currentBeat = currentTime * beatsPerSecond;
        const currentMeasure = Math.floor(currentBeat / beatsPerMeasure);

        // Draw measure numbers on the left side
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.15;
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
                ctx.fillText(`${measure + 1}`, 20, y + 7);
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
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
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

    // Draw piano keyboard
    const drawKeyboard = (ctx) => {
        const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;
        const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.65;

        // Draw white keys first
        ctx.textAlign = 'center';
        ctx.font = '12px Arial';

        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (!isBlackKey(i)) {
                const x = getNoteX(i);
                ctx.fillStyle = getKeyColor(i, false);
                ctx.fillRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);
                ctx.strokeStyle = '#cccccc';
                ctx.strokeRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);

                // Label (French)
                ctx.fillStyle = '#555';
                const label = getMidiNoteName(i);
                ctx.fillText(label, x + WHITE_KEY_WIDTH / 2, keyboardY + KEYBOARD_HEIGHT - 10);
            }
        }

        // Draw black keys on top
        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (isBlackKey(i)) {
                const x = getNoteX(i);
                ctx.fillStyle = getKeyColor(i, true);
                const blackKeyHeight = KEYBOARD_HEIGHT * 0.65;

                ctx.fillRect(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight);

                // Border
                ctx.strokeStyle = '#333';
                ctx.strokeRect(x, keyboardY, BLACK_KEY_WIDTH, blackKeyHeight);

                // Label
                ctx.fillStyle = '#ccc';
                ctx.font = '10px Arial';
                const label = getMidiNoteName(i);
                const shortLabel = label.replace(/[0-9-]/g, '');
                ctx.fillText(shortLabel, x + BLACK_KEY_WIDTH / 2, keyboardY + blackKeyHeight - 8);
            }
        }
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
            // But usually in Synthesia, helpful notes disappear after being hit or turn into 'sparks'.
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
            const noteWidth = isNoteBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH - 2;
            const noteX = isNoteBlack ? x : x + 1; // Black key x correction handled in getNoteX

            // Special effect for hit notes
            if (playStatus === 'correct' || playStatus === 'auto') {
                ctx.globalAlpha = 0.3; // Fade out hit notes
                ctx.shadowBlur = 20;
                ctx.shadowColor = color;
            } else {
                ctx.globalAlpha = 0.8;
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = color;

            // Draw from Top (endY) to Bottom
            // Clip to not draw below keyboard line if we want them to disappear 'into' the keyboard?
            // But they fall *onto* the keyboard.

            ctx.fillRect(noteX, endY, noteWidth, height);

            // Draw border
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(noteX, endY, noteWidth, height);

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
                ctx.rect(noteX, endY, noteWidth, height);
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

            const y = CANVAS_HEIGHT - KEYBOARD_HEIGHT - 60 - (index * 30);
            const age = Date.now() - feedback.timestamp;
            const opacity = Math.max(0, 1 - age / 1000);

            ctx.globalAlpha = opacity;
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = feedback.type === 'correct' ? COLORS.playedCorrect : COLORS.playedWrong;
            ctx.textAlign = 'center';
            ctx.fillText(feedback.message, x + WHITE_KEY_WIDTH / 2, y);
            ctx.globalAlpha = 1.0;
        });
    };

    // Main render loop
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw measure numbers first (in background)
        drawMeasureNumbers(ctx);

        // Draw Grid (pass beatsPerSecond for tempo adjustment)
        drawGrid(ctx, beatsPerSecond);

        // Draw falling notes
        drawFallingNotes(ctx, currentTime);

        // Draw keyboard
        drawKeyboard(ctx);

        // Draw current time indicator (horizontal line at keyboard top)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT - KEYBOARD_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - KEYBOARD_HEIGHT);
        ctx.stroke();

        // Draw feedback messages
        drawFeedback(ctx);

    }, [currentTime, activeNotes, playedNotes, feedbackMessages, expectedNotes]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying) return;

        const animate = () => {
            if (!startTimeRef.current) {
                startTimeRef.current = performance.now();
            }

            const elapsed = (performance.now() - startTimeRef.current) / 1000 * playbackSpeed;
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
    }, [isPlaying, playbackSpeed, waitMode, expectedNotes, allNotes, beatsPerSecond, playedNotes]);

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
        processedNotesRef.current = new Set(); // Reset processed notes tracking
        lastMetronomeClickRef.current = -1; // Reset metronome tracking
        setPlayedNotes(new Map());
        setFeedbackMessages([]);
        setSessionStats({
            correctNotes: 0,
            wrongNotes: 0,
            missedNotes: 0,
            totalNotes: allNotes.length,
            startTime: null,
            completed: false
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
                <h2 style={{ marginBottom: '1rem' }}>Mode Synthesia</h2>
                <p>Veuillez d'abord créer ou charger un morceau dans l'éditeur.</p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '2rem'
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
                    Mode Synthesia - {song.title}
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
                    📊 {showScores ? 'Masquer' : 'Voir'} Statistiques
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
                        📊 Statistiques - {song.title}
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
                gap: '2rem',
                padding: '1rem 1.5rem',
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
                            fontSize: '1.1rem'
                        }}
                        title="Métronome"
                    >
                        ⏰
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
                                            background: metronomeDivision === division ? 'var(--primary-color)' : 'var(--bg-tertiary)',
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
                            accentColor: 'var(--primary-color)'
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
                display: 'flex',
                gap: '1rem',
                padding: '1rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        Précision
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {calculateAccuracy()}%
                    </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        ✓ Correctes
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
                        {sessionStats.correctNotes}/{sessionStats.totalNotes}
                    </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        ✗ Incorrectes
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
                        {sessionStats.wrongNotes}
                    </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        ⊘ Manquées
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
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
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                        onClick={handlePlayPause}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '1rem'
                        }}
                    >
                        {isPlaying ? '⏸️ Pause' : '▶️ Jouer'}
                    </button>

                    <button
                        onClick={handleReset}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '1rem'
                        }}
                    >
                        🔄 Recommencer
                    </button>

                    <button
                        onClick={() => setHandMode(handMode === 'watch' ? 'both' : 'watch')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: handMode === 'watch' ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                            color: handMode === 'watch' ? 'white' : 'var(--text-primary)',
                            border: handMode === 'watch' ? 'none' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '1rem'
                        }}
                        title="Basculer entre mode écoute et mode pratique"
                    >
                        {handMode === 'watch' ? '👀 Mode Écoute' : '🎹 Mode Pratique'}
                    </button>

                    <button
                        onClick={() => setWaitMode(!waitMode)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: waitMode ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                            color: waitMode ? 'white' : 'var(--text-primary)',
                            border: waitMode ? 'none' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '1rem'
                        }}
                    >
                        {waitMode ? '⏸️ Attente ON' : '⏸️ Attente OFF'}
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
                                            background: handMode === hand ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                                            color: handMode === hand ? 'white' : 'var(--text-primary)',
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
