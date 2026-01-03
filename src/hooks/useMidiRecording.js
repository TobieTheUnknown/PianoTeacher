import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { midiInputService } from '../services/MidiInputService';
import { audioEngine } from '../services/AudioEngine';
import { createNoteEvent } from '../models/song';

/**
 * Hook for recording MIDI input with quantization
 *
 * Features:
 * - Real-time MIDI recording with timing
 * - Quantization based on grid (1/4, 1/8, 1/16)
 * - Metronome during recording
 * - Pre-roll countdown
 * - Auto-stop on phrase length
 */
export function useMidiRecording(tempo = 120, phraseLength = 4, quantization = 0.25) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPreRoll, setIsPreRoll] = useState(false);
    const [preRollCount, setPreRollCount] = useState(0);
    const [recordedNotes, setRecordedNotes] = useState([]);

    const startTimeRef = useRef(null);
    const activeNotesRef = useRef(new Map()); // pitch -> { startTime, velocity }
    const preRollIntervalRef = useRef(null);
    const metronomeIntervalRef = useRef(null);
    const isRecordingRef = useRef(false); // Ref to avoid stale closures
    const isPreRollRef = useRef(false);

    // Memoize calculated values to prevent unnecessary callback recreations
    const beatDuration = useMemo(() => (60 / tempo) * 1000, [tempo]);
    const phraseLengthBeats = useMemo(() => phraseLength * 4, [phraseLength]);

    // Keep refs in sync with state
    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
        isPreRollRef.current = isPreRoll;
    }, [isPreRoll]);

    // Quantize time to nearest grid point (stable reference)
    const quantize = useCallback((timeInBeats) => {
        return Math.round(timeInBeats / quantization) * quantization;
    }, [quantization]);

    // Play metronome click (stable reference)
    const playMetronomeClick = useCallback((isDownbeat = false) => {
        const pitch = isDownbeat ? 76 : 72; // E5 for downbeat, C5 for others
        audioEngine.playNote(pitch, 0.1, 0.05); // Short duration, low velocity
    }, []);

    // Create stable event handlers using refs
    const handleNoteOnRef = useRef();
    const handleNoteOffRef = useRef();

    // Update handler implementations
    useEffect(() => {
        handleNoteOnRef.current = (event) => {
            if (!isRecordingRef.current || isPreRollRef.current) return;

            const currentTime = performance.now();
            const elapsedTime = (currentTime - startTimeRef.current) / 1000;
            const timeInBeats = (elapsedTime * tempo) / 60;

            if (timeInBeats >= phraseLengthBeats) {
                return;
            }

            activeNotesRef.current.set(event.note, {
                startTime: timeInBeats,
                velocity: event.velocity
            });

            audioEngine.playNote(event.note, event.velocity / 127);
        };

        handleNoteOffRef.current = (event) => {
            if (!isRecordingRef.current || isPreRollRef.current) return;

            const noteData = activeNotesRef.current.get(event.note);
            if (!noteData) return;

            const currentTime = performance.now();
            const elapsedTime = (currentTime - startTimeRef.current) / 1000;
            const timeInBeats = (elapsedTime * tempo) / 60;

            const duration = timeInBeats - noteData.startTime;

            const quantizedStartTime = quantize(noteData.startTime);
            const quantizedDuration = Math.max(quantization, quantize(duration));

            const note = createNoteEvent(event.note, quantizedStartTime, quantizedDuration);

            setRecordedNotes(prev => [...prev, note]);
            activeNotesRef.current.delete(event.note);
        };
    }, [tempo, phraseLengthBeats, quantize, quantization]);

    // Stable wrapper functions for event listeners
    const handleNoteOnWrapper = useCallback((event) => {
        handleNoteOnRef.current?.(event);
    }, []);

    const handleNoteOffWrapper = useCallback((event) => {
        handleNoteOffRef.current?.(event);
    }, []);

    // Stop recording (stable reference using refs)
    const stopRecording = useCallback(() => {
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
        if (startTimeRef.current) {
            const currentTime = performance.now();
            const elapsedTime = (currentTime - startTimeRef.current) / 1000;
            const timeInBeats = (elapsedTime * tempo) / 60;

            const finalizedNotes = [];
            activeNotesRef.current.forEach((noteData, pitch) => {
                const duration = timeInBeats - noteData.startTime;
                const quantizedStartTime = quantize(noteData.startTime);
                const quantizedDuration = Math.max(quantization, quantize(duration));

                const note = createNoteEvent(pitch, quantizedStartTime, quantizedDuration);
                finalizedNotes.push(note);
            });

            if (finalizedNotes.length > 0) {
                setRecordedNotes(prev => [...prev, ...finalizedNotes]);
            }
        }

        activeNotesRef.current.clear();
    }, [tempo, quantize, quantization, handleNoteOnWrapper, handleNoteOffWrapper]);

    // Actually start recording (stable reference using refs)
    const actuallyStartRecording = useCallback(() => {
        startTimeRef.current = performance.now();
        setIsRecording(true);
        setRecordedNotes([]);
        activeNotesRef.current.clear();

        // Start metronome
        let beatCount = 0;
        metronomeIntervalRef.current = setInterval(() => {
            playMetronomeClick(beatCount % 4 === 0);
            beatCount++;

            // Auto-stop at phrase length
            if (beatCount >= phraseLengthBeats) {
                stopRecording();
            }
        }, beatDuration);

        // Add MIDI listeners (stable references)
        midiInputService.addEventListener('noteOn', handleNoteOnWrapper);
        midiInputService.addEventListener('noteOff', handleNoteOffWrapper);
    }, [beatDuration, phraseLengthBeats, playMetronomeClick, handleNoteOnWrapper, handleNoteOffWrapper, stopRecording]);

    // Start pre-roll countdown (stable reference)
    const startPreRoll = useCallback((preRollBars = 1) => {
        setIsPreRoll(true);
        setPreRollCount(preRollBars * 4);

        let count = preRollBars * 4;

        preRollIntervalRef.current = setInterval(() => {
            playMetronomeClick(count % 4 === 0);

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
    }, [beatDuration, playMetronomeClick, actuallyStartRecording]);

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
        startRecording,
        stopRecording,
        clearRecordedNotes
    };
}
