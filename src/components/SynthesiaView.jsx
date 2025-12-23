import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ScoreService } from '../services/ScoreService';

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
 */
export function SynthesiaView({ song }) {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(null);
    const pausedAtTimeRef = useRef(null);
    const processedNotesRef = useRef(new Set()); // Track notes already marked as missed

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [midiAccess, setMidiAccess] = useState(null);
    const [activeNotes, setActiveNotes] = useState(new Set());

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

    // Colors
    const COLORS = {
        rightHand: '#3b82f6', // Blue
        leftHand: '#a855f7', // Purple
        playedCorrect: '#22c55e', // Green
        playedWrong: '#ef4444', // Red
        missed: '#f59e0b', // Orange
        background: '#1a1a2e',
        whiteKey: '#ffffff',
        blackKey: '#000000',
        whiteKeyPressed: '#3b82f6',
        blackKeyPressed: '#2563eb',
        whiteKeyCorrect: '#22c55e',
        blackKeyCorrect: '#16a34a',
        whiteKeyWrong: '#ef4444',
        blackKeyWrong: '#dc2626'
    };

    // Initialize MIDI
    useEffect(() => {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess()
                .then(access => {
                    setMidiAccess(access);
                    setupMIDIInputs(access);
                })
                .catch(err => console.warn('MIDI access denied:', err));
        }
    }, []);

    const setupMIDIInputs = (access) => {
        access.inputs.forEach(input => {
            input.onmidimessage = handleMIDIMessage;
        });
    };

    // Get all notes from song with timing information
    const getAllNotes = useCallback(() => {
        console.log('🎵 [SynthesiaView] getAllNotes - START');
        console.log('📦 [SynthesiaView] song:', song);

        // Multiple defensive checks
        if (!song) {
            console.log('❌ [SynthesiaView] No song - returning empty array');
            return [];
        }

        console.log('📋 [SynthesiaView] song.phrases:', song.phrases);

        if (!song.phrases) {
            console.log('❌ [SynthesiaView] No phrases - returning empty array');
            return [];
        }

        if (!Array.isArray(song.phrases)) {
            console.log('❌ [SynthesiaView] phrases is not an array - returning empty array');
            return [];
        }

        if (song.phrases.length === 0) {
            console.log('❌ [SynthesiaView] phrases array is empty - returning empty array');
            return [];
        }

        console.log(`✅ [SynthesiaView] Processing ${song.phrases.length} phrases`);
        const notes = [];
        let currentTime = 0;

        try {
            // Use for...of instead of forEach for better error handling
            for (let i = 0; i < song.phrases.length; i++) {
                const phrase = song.phrases[i];
                console.log(`\n🔄 [SynthesiaView] Processing phrase ${i}:`, phrase);

                // Skip invalid phrases
                if (!phrase) {
                    console.log(`⚠️ [SynthesiaView] Phrase ${i} is null/undefined - skipping`);
                    continue;
                }

                if (typeof phrase !== 'object') {
                    console.log(`⚠️ [SynthesiaView] Phrase ${i} is not an object - skipping`);
                    continue;
                }

                // Process melody notes (right hand)
                console.log(`  📝 [SynthesiaView] phrase.melody:`, phrase.melody);
                const melodyNotes = phrase.melody || [];
                console.log(`  📝 [SynthesiaView] melodyNotes (after || []):`, melodyNotes);

                if (Array.isArray(melodyNotes)) {
                    console.log(`  ✅ [SynthesiaView] Processing ${melodyNotes.length} melody notes`);
                    for (let j = 0; j < melodyNotes.length; j++) {
                        const note = melodyNotes[j];
                        if (note && typeof note.pitch === 'number') {
                            notes.push({
                                id: `${currentTime}_${note.pitch}_melody_${Math.random()}`,
                                pitch: note.pitch,
                                startTime: currentTime + (note.startTime || 0),
                                duration: note.duration || 0.5,
                                hand: 'right',
                                velocity: note.velocity || 64
                            });
                        }
                    }
                } else {
                    console.log(`  ⚠️ [SynthesiaView] melodyNotes is not an array`);
                }

                // Process chord notes (left hand)
                console.log(`  🎹 [SynthesiaView] phrase.chords:`, phrase.chords);
                const chordNotes = phrase.chords || [];
                console.log(`  🎹 [SynthesiaView] chordNotes (after || []):`, chordNotes);

                if (Array.isArray(chordNotes)) {
                    console.log(`  ✅ [SynthesiaView] Processing ${chordNotes.length} chord notes`);
                    for (let j = 0; j < chordNotes.length; j++) {
                        const note = chordNotes[j];
                        if (note && typeof note.pitch === 'number') {
                            notes.push({
                                id: `${currentTime}_${note.pitch}_chord_${Math.random()}`,
                                pitch: note.pitch,
                                startTime: currentTime + (note.startTime || 0),
                                duration: note.duration || 0.5,
                                hand: 'left',
                                velocity: note.velocity || 64
                            });
                        }
                    }
                } else {
                    console.log(`  ⚠️ [SynthesiaView] chordNotes is not an array`);
                }

                // Update time for next phrase
                currentTime += (phrase.duration || 4);
            }
        } catch (error) {
            console.error('💥 [SynthesiaView] ERROR in getAllNotes:', error);
            console.error('Stack trace:', error.stack);
            return [];
        }

        console.log(`\n🎉 [SynthesiaView] getAllNotes - COMPLETE - ${notes.length} notes total`);
        return notes.sort((a, b) => a.startTime - b.startTime);
    }, [song]);

    // Memoize allNotes to prevent recalculation on every render
    const allNotes = useMemo(() => getAllNotes(), [getAllNotes]);
    const beatsPerSecond = (song?.tempo || 120) / 60;

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

    // Check for notes that should be played at current time
    useEffect(() => {
        const currentExpectedNotes = new Set();

        allNotes.forEach(note => {
            const noteTime = note.startTime / beatsPerSecond;
            const timeDiff = Math.abs(currentTime - noteTime);

            // Note is in the "hit window"
            if (timeDiff <= NOTE_TOLERANCE && !playedNotes.has(note.id)) {
                currentExpectedNotes.add(note.pitch);
            }

            // Note was missed (passed the window without being played)
            // Only process each note once using processedNotesRef
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
    }, [currentTime, allNotes, beatsPerSecond]); // Removed playedNotes dependency

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
                // Wrong note (not expected at this time)
                setSessionStats(prev => ({
                    ...prev,
                    wrongNotes: prev.wrongNotes + 1
                }));

                addFeedback(`✗ ${getMidiNoteName(note)}`, 'wrong', note);
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

    // Get note name from MIDI number
    const getMidiNoteName = (midiNum) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNum / 12) - 1;
        const noteName = noteNames[midiNum % 12];
        return `${noteName}${octave}`;
    };

    // Convert MIDI note to piano key position
    const getNoteX = (midiNote) => {
        if (midiNote < FIRST_KEY || midiNote > LAST_KEY) return null;

        const noteInOctave = midiNote % 12;
        const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);
        const whiteNotesBefore = Math.floor((midiNote - FIRST_KEY) / 12) * 7 +
            [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][noteInOctave];

        if (isBlack) {
            const whiteKeyX = whiteNotesBefore * WHITE_KEY_WIDTH;
            return whiteKeyX + WHITE_KEY_WIDTH * 0.7;
        } else {
            return whiteNotesBefore * WHITE_KEY_WIDTH;
        }
    };

    const isBlackKey = (midiNote) => {
        const noteInOctave = midiNote % 12;
        return [1, 3, 6, 8, 10].includes(noteInOctave);
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

        return isBlack ? COLORS.blackKey : COLORS.whiteKey;
    };

    // Draw piano keyboard
    const drawKeyboard = (ctx) => {
        const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

        // Draw white keys first
        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (!isBlackKey(i)) {
                const x = getNoteX(i);
                ctx.fillStyle = getKeyColor(i, false);
                ctx.fillRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);
                ctx.strokeStyle = '#cccccc';
                ctx.strokeRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);
            }
        }

        // Draw black keys on top
        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (isBlackKey(i)) {
                const x = getNoteX(i);
                ctx.fillStyle = getKeyColor(i, true);
                const blackKeyWidth = WHITE_KEY_WIDTH * 0.6;
                const blackKeyHeight = KEYBOARD_HEIGHT * 0.6;
                ctx.fillRect(x - blackKeyWidth / 2, keyboardY, blackKeyWidth, blackKeyHeight);
            }
        }
    };

    // Draw falling notes
    const drawFallingNotes = (ctx, currentTime) => {
        const lookAheadTime = 4; // Show notes 4 seconds ahead

        allNotes.forEach(note => {
            const noteStartTime = note.startTime / beatsPerSecond;
            const noteEndTime = (note.startTime + note.duration) / beatsPerSecond;

            // Only draw notes that are visible
            if (noteEndTime < currentTime - 1 || noteStartTime > currentTime + lookAheadTime) {
                return;
            }

            const x = getNoteX(note.pitch);
            if (x === null) return;

            // Calculate Y position (notes fall down)
            const startY = NOTE_FALL_HEIGHT * (1 - (noteStartTime - currentTime) / lookAheadTime);
            const endY = NOTE_FALL_HEIGHT * (1 - (noteEndTime - currentTime) / lookAheadTime);
            const height = Math.max(endY - startY, 5);

            if (endY < 0) return;

            // Determine color based on play status
            let color = note.hand === 'right' ? COLORS.rightHand : COLORS.leftHand;
            const playStatus = playedNotes.get(note.id);

            if (playStatus === 'correct') {
                color = COLORS.playedCorrect;
            } else if (playStatus === 'missed') {
                color = COLORS.missed;
            }

            // Draw note rectangle
            const noteWidth = isBlackKey(note.pitch) ? WHITE_KEY_WIDTH * 0.6 : WHITE_KEY_WIDTH - 2;
            const noteX = isBlackKey(note.pitch) ? x - noteWidth / 2 : x + 1;

            ctx.fillStyle = color;
            ctx.globalAlpha = playStatus ? 0.5 : 0.8;
            ctx.fillRect(noteX, startY, noteWidth, height);
            ctx.globalAlpha = 1.0;

            // Draw border
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(noteX, startY, noteWidth, height);
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

            // In wait mode, pause if there are expected notes
            if (waitMode && expectedNotes.size > 0 && pausedAtTimeRef.current === null) {
                pausedAtTimeRef.current = elapsed;
                setIsPlaying(false);
                return;
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, playbackSpeed, waitMode, expectedNotes.size]);

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

    const handleSpeedChange = (newSpeed) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) {
            setIsPlaying(false);
        }
        setPlaybackSpeed(newSpeed);
        if (wasPlaying) {
            setTimeout(() => {
                setIsPlaying(true);
                startTimeRef.current = performance.now() - (currentTime / newSpeed) * 1000;
            }, 50);
        }
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
                boxShadow: 'var(--shadow-xl)'
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

            {/* Controls */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                padding: '1rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap'
            }}>
                {/* Play/Pause Button */}
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
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {isPlaying ? '⏸️ Pause' : '▶️ Jouer'}
                </button>

                {/* Reset Button */}
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

                {/* Wait Mode Toggle */}
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
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {waitMode ? '⏸️ Mode Attente: ON' : '▶️ Mode Attente: OFF'}
                </button>

                {/* Speed Control */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <label style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                    }}>
                        Vitesse:
                    </label>
                    <select
                        value={playbackSpeed}
                        onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        <option value="0.25">0.25x</option>
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1.0">1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2.0">2x</option>
                    </select>
                </div>

                {/* Time Display */}
                <div style={{
                    marginLeft: 'auto',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace'
                }}>
                    {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                </div>
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
                    <li>Connectez votre clavier MIDI pour jouer en temps réel</li>
                    <li>La ligne blanche indique le moment où il faut jouer la note</li>
                    <li><strong>Mode Attente:</strong> La lecture s'arrête jusqu'à ce que vous jouiez la bonne note</li>
                    <li>Vos performances sont enregistrées et affichées dans les statistiques</li>
                    <li>Les notes deviennent vertes quand jouées correctement, oranges si manquées</li>
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
