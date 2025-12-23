import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SynthesiaView - Falling notes visualization (like Synthesia/Openthesia)
 * Features:
 * - Canvas rendering for performance
 * - Notes fall from top to piano keyboard at bottom
 * - Color coding for left/right hands
 * - Real-time MIDI input detection
 * - Playback controls (play/pause/speed)
 */
export function SynthesiaView({ song }) {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const audioContextRef = useRef(null);
    const startTimeRef = useRef(null);

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [midiAccess, setMidiAccess] = useState(null);
    const [activeNotes, setActiveNotes] = useState(new Set());

    // Canvas dimensions
    const CANVAS_WIDTH = 1200;
    const CANVAS_HEIGHT = 800;
    const KEYBOARD_HEIGHT = 150;
    const NOTE_FALL_HEIGHT = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

    // Piano keyboard constants (88 keys, A0 to C8)
    const FIRST_KEY = 21; // MIDI note A0
    const LAST_KEY = 108; // MIDI note C8
    const TOTAL_KEYS = LAST_KEY - FIRST_KEY + 1;
    const WHITE_KEY_WIDTH = CANVAS_WIDTH / 52; // 52 white keys

    // Colors
    const COLORS = {
        rightHand: '#3b82f6', // Blue
        leftHand: '#a855f7', // Purple
        bothHands: '#10b981', // Green
        playedCorrect: '#22c55e', // Green
        playedWrong: '#ef4444', // Red
        background: '#1a1a2e',
        whiteKey: '#ffffff',
        blackKey: '#000000',
        whiteKeyPressed: '#3b82f6',
        blackKeyPressed: '#2563eb'
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

    const handleMIDIMessage = (message) => {
        const [command, note, velocity] = message.data;

        if (command === 144 && velocity > 0) {
            // Note on
            setActiveNotes(prev => new Set([...prev, note]));
        } else if (command === 128 || (command === 144 && velocity === 0)) {
            // Note off
            setActiveNotes(prev => {
                const newSet = new Set(prev);
                newSet.delete(note);
                return newSet;
            });
        }
    };

    // Get all notes from song with timing information
    const getAllNotes = useCallback(() => {
        if (!song || !song.phrases) return [];

        const notes = [];
        let currentTime = 0;

        song.phrases.forEach(phrase => {
            // Add melody notes (right hand)
            phrase.melody.forEach(note => {
                notes.push({
                    pitch: note.pitch,
                    startTime: currentTime + note.startTime,
                    duration: note.duration,
                    hand: 'right',
                    velocity: note.velocity || 64
                });
            });

            // Add chord notes (left hand)
            phrase.chords.forEach(note => {
                notes.push({
                    pitch: note.pitch,
                    startTime: currentTime + note.startTime,
                    duration: note.duration,
                    hand: 'left',
                    velocity: note.velocity || 64
                });
            });

            // Update time for next phrase
            currentTime += phrase.duration || 4; // Default 4 beats if not specified
        });

        return notes.sort((a, b) => a.startTime - b.startTime);
    }, [song]);

    // Convert MIDI note to piano key position
    const getNoteX = (midiNote) => {
        if (midiNote < FIRST_KEY || midiNote > LAST_KEY) return null;

        // Calculate position based on white keys
        const noteInOctave = midiNote % 12;
        const octave = Math.floor((midiNote - FIRST_KEY) / 12);

        const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);
        const whiteNotesBefore = Math.floor((midiNote - FIRST_KEY) / 12) * 7 +
            [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][noteInOctave];

        if (isBlack) {
            const whiteKeyX = whiteNotesBefore * WHITE_KEY_WIDTH;
            return whiteKeyX + WHITE_KEY_WIDTH * 0.7; // Offset for black key
        } else {
            return whiteNotesBefore * WHITE_KEY_WIDTH;
        }
    };

    const isBlackKey = (midiNote) => {
        const noteInOctave = midiNote % 12;
        return [1, 3, 6, 8, 10].includes(noteInOctave);
    };

    // Draw piano keyboard
    const drawKeyboard = (ctx) => {
        const keyboardY = CANVAS_HEIGHT - KEYBOARD_HEIGHT;

        // Draw white keys first
        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (!isBlackKey(i)) {
                const x = getNoteX(i);
                const isPressed = activeNotes.has(i);

                ctx.fillStyle = isPressed ? COLORS.whiteKeyPressed : COLORS.whiteKey;
                ctx.fillRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);

                ctx.strokeStyle = '#cccccc';
                ctx.strokeRect(x, keyboardY, WHITE_KEY_WIDTH - 1, KEYBOARD_HEIGHT);
            }
        }

        // Draw black keys on top
        for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
            if (isBlackKey(i)) {
                const x = getNoteX(i);
                const isPressed = activeNotes.has(i);

                ctx.fillStyle = isPressed ? COLORS.blackKeyPressed : COLORS.blackKey;
                const blackKeyWidth = WHITE_KEY_WIDTH * 0.6;
                const blackKeyHeight = KEYBOARD_HEIGHT * 0.6;
                ctx.fillRect(x - blackKeyWidth / 2, keyboardY, blackKeyWidth, blackKeyHeight);
            }
        }
    };

    // Draw falling notes
    const drawFallingNotes = (ctx, currentTime) => {
        const notes = getAllNotes();
        const beatsPerSecond = (song?.tempo || 120) / 60;
        const lookAheadTime = 4; // Show notes 4 seconds ahead

        notes.forEach(note => {
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
            const height = Math.max(endY - startY, 5); // Minimum height of 5px

            // Skip if note is above viewport
            if (endY < 0) return;

            // Determine color based on hand
            let color = COLORS.rightHand;
            if (note.hand === 'left') {
                color = COLORS.leftHand;
            }

            // Draw note rectangle
            const noteWidth = isBlackKey(note.pitch) ? WHITE_KEY_WIDTH * 0.6 : WHITE_KEY_WIDTH - 2;
            const noteX = isBlackKey(note.pitch) ? x - noteWidth / 2 : x + 1;

            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(noteX, startY, noteWidth, height);
            ctx.globalAlpha = 1.0;

            // Draw border
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(noteX, startY, noteWidth, height);
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
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT - KEYBOARD_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - KEYBOARD_HEIGHT);
        ctx.stroke();

    }, [currentTime, activeNotes, song]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying) return;

        const animate = () => {
            if (!startTimeRef.current) {
                startTimeRef.current = performance.now();
            }

            const elapsed = (performance.now() - startTimeRef.current) / 1000 * playbackSpeed;
            setCurrentTime(elapsed);

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, playbackSpeed]);

    // Render on state changes
    useEffect(() => {
        render();
    }, [render]);

    // Play/Pause controls
    const handlePlayPause = () => {
        if (isPlaying) {
            setIsPlaying(false);
            startTimeRef.current = null;
        } else {
            setIsPlaying(true);
            startTimeRef.current = performance.now() - (currentTime / playbackSpeed) * 1000;
        }
    };

    const handleReset = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        startTimeRef.current = null;
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
            <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: 'var(--text-primary)'
            }}>
                Mode Synthesia - {song.title}
            </h2>

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
                border: '1px solid var(--border-color)'
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

                {/* Speed Control */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginLeft: '1rem'
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
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: COLORS.rightHand,
                        borderRadius: '4px'
                    }}></div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Main droite (MD)
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: COLORS.leftHand,
                        borderRadius: '4px'
                    }}></div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Main gauche (MG)
                    </span>
                </div>
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
                    <li>Les notes bleues sont pour la main droite, les violettes pour la main gauche</li>
                    <li>Ajustez la vitesse de lecture selon votre niveau</li>
                    <li>La ligne blanche indique le moment où il faut jouer la note</li>
                </ul>
            </div>
        </div>
    );
}
