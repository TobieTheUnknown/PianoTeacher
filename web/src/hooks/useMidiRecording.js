import { quarterNotesPerMeasure } from '../utils/timing.js';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { midiInputService } from '../services/MidiInputService';
import { createNoteEvent } from '../models/song';
import { midiRecordingBeat, finalizedMidiTiming } from '../utils/midiTiming.js';

/**
 * Hook for recording MIDI input with quantization
 *
 * Features:
 * - Real-time MIDI recording with timing
 * - Quantization based on grid (1/4, 1/8, 1/16)
 * - High-resolution recording (64 ticks/sec) when snapToGrid is false
 * - Metronome during recording
 * - Pre-roll countdown
 * - Auto-stop on phrase length
 */
export function useMidiRecording(tempo = 120, phraseLength = 4, quantization = 0.25, snapToGrid = true, onNoteRecorded = null, onActiveNotesChange = null, onPreRollComplete = null, timeSignature = null) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPreRoll, setIsPreRoll] = useState(false);
    const [preRollCount, setPreRollCount] = useState(0);
    const [recordedNotes, setRecordedNotes] = useState([]);
    const [activeNotes, setActiveNotes] = useState([]); // Notes currently being held

    const startTimeRef = useRef(null);
    const activeNotesRef = useRef(new Map()); // pitch -> { startTime, velocity }
    const preRollIntervalRef = useRef(null);
    const metronomeIntervalRef = useRef(null);
    const isRecordingRef = useRef(false); // Ref to avoid stale closures
    const isPreRollRef = useRef(false);

    // Memoize calculated values to prevent unnecessary callback recreations
    const beatDuration = useMemo(() => (60 / tempo) * 1000, [tempo]);
    const measureBeats = quarterNotesPerMeasure(timeSignature);
    const phraseLengthBeats = phraseLength * measureBeats;

    // Keep refs in sync with state
    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        isPreRollRef.current = isPreRoll;
    }, [isPreRoll]);

    // Quantize time to nearest grid point (stable reference)
    const quantize = useCallback((timeInBeats) => {
        if (!snapToGrid) {
            // High-resolution: 64 ticks per second
            // Convert beats to seconds, round to 1/64 second, convert back
            const seconds = (timeInBeats * 60) / tempo;
            const ticksPerSecond = 64;
            const roundedSeconds = Math.round(seconds * ticksPerSecond) / ticksPerSecond;
            return (roundedSeconds * tempo) / 60;
        }
        return Math.round(timeInBeats / quantization) * quantization;
    }, [quantization, snapToGrid, tempo]);

    // Create stable event handlers using refs
    const handleNoteOnRef = useRef();
    const handleNoteOffRef = useRef();

    // Update handler implementations
    useEffect(() => {
        handleNoteOnRef.current = (event) => {
            if (!isRecordingRef.current || isPreRollRef.current) return;

            const timeInBeats = midiRecordingBeat(event.timestamp, startTimeRef.current, tempo);

            if (timeInBeats >= phraseLengthBeats) {
                return;
            }

            activeNotesRef.current.set(event.note, {
                startTime: timeInBeats,
                velocity: event.velocity
            });

            // Update active notes display for real-time stretching
            const activeNotesArray = Array.from(activeNotesRef.current.entries()).map(([pitch, data]) => ({
                pitch,
                startTime: data.startTime,
                velocity: data.velocity,
                id: `active-${pitch}`
            }));
            setActiveNotes(activeNotesArray);

            if (onActiveNotesChange) {
                onActiveNotesChange(activeNotesArray);
            }

            // The global useMidiAudio hook owns MIDI monitoring (including sustain).
        };

        handleNoteOffRef.current = (event) => {
            if (!isRecordingRef.current || isPreRollRef.current) return;

            const noteData = activeNotesRef.current.get(event.note);
            if (!noteData) return;

            const timeInBeats = midiRecordingBeat(event.timestamp, startTimeRef.current, tempo);
            const timing = finalizedMidiTiming(noteData.startTime, timeInBeats, phraseLengthBeats, quantize, quantization);
            if (!timing) return;
            const note = createNoteEvent(event.note, timing.startTime, timing.duration);

            setRecordedNotes(prev => [...prev, note]);
            activeNotesRef.current.delete(event.note);

            // Update active notes display after removing note
            const activeNotesArray = Array.from(activeNotesRef.current.entries()).map(([pitch, data]) => ({
                pitch,
                startTime: data.startTime,
                velocity: data.velocity,
                id: `active-${pitch}`
            }));
            setActiveNotes(activeNotesArray);

            if (onActiveNotesChange) {
                onActiveNotesChange(activeNotesArray);
            }

            // Call real-time callback if provided
            if (onNoteRecorded) {
                onNoteRecorded(note);
            }
        };
    }, [tempo, phraseLengthBeats, quantize, quantization, onNoteRecorded, onActiveNotesChange]);

    // Stable wrapper functions for event listeners
    const handleNoteOnWrapper = useCallback((event) => {
        handleNoteOnRef.current?.(event);
    }, []);

    const handleNoteOffWrapper = useCallback((event) => {
        handleNoteOffRef.current?.(event);
    }, []);

    // Stop recording (stable reference using refs)
    const stopRecording = useCallback(() => {
        isRecordingRef.current = false;
        isPreRollRef.current = false;
        setIsRecording(false);
        setIsPreRoll(false);

        // Clear intervals
        if (preRollIntervalRef.current) {
            clearInterval(preRollIntervalRef.current);
            preRollIntervalRef.current = null;
        }
        if (metronomeIntervalRef.current) {
            clearInterval(metronomeIntervalRef.current);
            metronomeIntervalRef.current = null;
        }

        // Remove MIDI listeners (stable references)
        midiInputService.removeEventListener('noteOn', handleNoteOnWrapper);
        midiInputService.removeEventListener('noteOff', handleNoteOffWrapper);

        // Finalize any active notes
        if (startTimeRef.current !== null) {
            // Manual/automatic stop is a transport boundary, not a MIDI release.
            const timeInBeats = midiRecordingBeat(performance.now(), startTimeRef.current, tempo);

            const finalizedNotes = [];
            activeNotesRef.current.forEach((noteData, pitch) => {
                const timing = finalizedMidiTiming(noteData.startTime, timeInBeats, phraseLengthBeats, quantize, quantization);
                if (timing) finalizedNotes.push(createNoteEvent(pitch, timing.startTime, timing.duration));
            });

            if (finalizedNotes.length > 0) {
                setRecordedNotes(prev => [...prev, ...finalizedNotes]);
            }
        }

        activeNotesRef.current.clear();
    }, [tempo, phraseLengthBeats, quantize, quantization, handleNoteOnWrapper, handleNoteOffWrapper]);

    // Actually start recording (stable reference using refs)
    const actuallyStartRecording = useCallback(() => {
        startTimeRef.current = performance.now();
        isRecordingRef.current = true;
        isPreRollRef.current = false;
        setIsRecording(true);
        setRecordedNotes([]);
        activeNotesRef.current.clear();

        // Notify that pre-roll is complete and recording is starting
        if (onPreRollComplete) {
            onPreRollComplete();
        }

        // NO metronome interval here - AudioEngine handles it
        // Just track beat count for auto-stop
        let beatCount = 0;
        metronomeIntervalRef.current = setInterval(() => {
            beatCount++;

            // Auto-stop at phrase length
            if (beatCount >= phraseLengthBeats) {
                stopRecording();
            }
        }, beatDuration);

        // Add MIDI listeners (stable references)
        midiInputService.addEventListener('noteOn', handleNoteOnWrapper);
        midiInputService.addEventListener('noteOff', handleNoteOffWrapper);
    }, [beatDuration, phraseLengthBeats, handleNoteOnWrapper, handleNoteOffWrapper, stopRecording, onPreRollComplete]);

    // Start pre-roll countdown (stable reference)
    const startPreRoll = useCallback((preRollBars = 1) => {
        setIsPreRoll(true);
        setPreRollCount(preRollBars * measureBeats);

        let count = preRollBars * measureBeats;

        // NO metronome clicks here - AudioEngine handles it
        // Just count down
        preRollIntervalRef.current = setInterval(() => {
            count--;
            setPreRollCount(count);

            if (count <= 0) {
                clearInterval(preRollIntervalRef.current);
                preRollIntervalRef.current = null;
                setIsPreRoll(false);
                // Start actual recording
                actuallyStartRecording();
            }
        }, beatDuration);
    }, [beatDuration, actuallyStartRecording, measureBeats]);

    // Start recording with pre-roll
    const startRecording = useCallback((withPreRoll = true, preRollBars = 1) => {
        if (withPreRoll) {
            startPreRoll(preRollBars);
        } else {
            actuallyStartRecording();
        }
    }, [startPreRoll, actuallyStartRecording]);

    // Clear recorded notes
    const clearRecordedNotes = useCallback(() => {
        setRecordedNotes([]);
    }, []);

    // Cleanup on unmount ONLY
    useEffect(() => {
        return () => {
            // Clear intervals
            if (preRollIntervalRef.current) {
                clearInterval(preRollIntervalRef.current);
            }
            if (metronomeIntervalRef.current) {
                clearInterval(metronomeIntervalRef.current);
            }
            // Remove listeners
            midiInputService.removeEventListener('noteOn', handleNoteOnWrapper);
            midiInputService.removeEventListener('noteOff', handleNoteOffWrapper);
        };
    }, [handleNoteOnWrapper, handleNoteOffWrapper]);

    return {
        isRecording,
        isPreRoll,
        preRollCount,
        recordedNotes,
        activeNotes,
        startRecording,
        stopRecording,
        clearRecordedNotes
    };
}
