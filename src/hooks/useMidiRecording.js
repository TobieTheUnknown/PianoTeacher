import { useState, useRef, useCallback, useEffect } from 'react';
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
    const metronomeSoundRef = useRef(null);
    const preRollIntervalRef = useRef(null);
    const metronomeIntervalRef = useRef(null);

    // Calculate beat duration in milliseconds
    const beatDuration = (60 / tempo) * 1000;
    const phraseLengthBeats = phraseLength * 4; // Assume 4 beats per measure

    // Quantize time to nearest grid point
    const quantize = useCallback((timeInBeats) => {
        return Math.round(timeInBeats / quantization) * quantization;
    }, [quantization]);

    // Play metronome click
    const playMetronomeClick = useCallback((isDownbeat = false) => {
        // Use audio engine to play a simple metronome sound
        // Higher pitch for downbeat, lower for other beats
        const pitch = isDownbeat ? 76 : 72; // E5 for downbeat, C5 for others
        audioEngine.playNote(pitch, 0.1, 0.05); // Short duration, low velocity
    }, []);

    // Handle MIDI note on
    const handleNoteOn = useCallback((event) => {
        if (!isRecording || isPreRoll) return;

        const currentTime = performance.now();
        const elapsedTime = (currentTime - startTimeRef.current) / 1000; // seconds
        const timeInBeats = (elapsedTime * tempo) / 60;

        // Don't record notes beyond phrase length
        if (timeInBeats >= phraseLengthBeats) {
            return;
        }

        activeNotesRef.current.set(event.note, {
            startTime: timeInBeats,
            velocity: event.velocity
        });

        // Play the note for audio feedback
        audioEngine.playNote(event.note, event.velocity / 127);
    }, [isRecording, isPreRoll, tempo, phraseLengthBeats]);

    // Handle MIDI note off
    const handleNoteOff = useCallback((event) => {
        if (!isRecording || isPreRoll) return;

        const noteData = activeNotesRef.current.get(event.note);
        if (!noteData) return;

        const currentTime = performance.now();
        const elapsedTime = (currentTime - startTimeRef.current) / 1000; // seconds
        const timeInBeats = (elapsedTime * tempo) / 60;

        const duration = timeInBeats - noteData.startTime;

        // Quantize start time and duration
        const quantizedStartTime = quantize(noteData.startTime);
        const quantizedDuration = Math.max(quantization, quantize(duration));

        // Create note event
        const note = createNoteEvent(event.note, quantizedStartTime, quantizedDuration);

        // Add to recorded notes
        setRecordedNotes(prev => [...prev, note]);

        // Remove from active notes
        activeNotesRef.current.delete(event.note);
    }, [isRecording, isPreRoll, tempo, quantize, quantization]);

    // Start pre-roll countdown
    const startPreRoll = useCallback((preRollBars = 1) => {
        setIsPreRoll(true);
        setPreRollCount(preRollBars * 4); // 4 beats per bar

        let count = preRollBars * 4;

        preRollIntervalRef.current = setInterval(() => {
            // Play metronome for pre-roll
            playMetronomeClick(count % 4 === 0);

            count--;
            setPreRollCount(count);

            if (count <= 0) {
                clearInterval(preRollIntervalRef.current);
                setIsPreRoll(false);
                // Start actual recording
                actuallyStartRecording();
            }
        }, beatDuration);
    }, [beatDuration, playMetronomeClick]);

    // Actually start recording (after pre-roll)
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

        // Add MIDI listeners
        midiInputService.addEventListener('noteOn', handleNoteOn);
        midiInputService.addEventListener('noteOff', handleNoteOff);
    }, [beatDuration, phraseLengthBeats, playMetronomeClick, handleNoteOn, handleNoteOff]);

    // Start recording with pre-roll
    const startRecording = useCallback((withPreRoll = true, preRollBars = 1) => {
        if (withPreRoll) {
            startPreRoll(preRollBars);
        } else {
            actuallyStartRecording();
        }
    }, [startPreRoll, actuallyStartRecording]);

    // Stop recording
    const stopRecording = useCallback(() => {
        setIsRecording(false);
        setIsPreRoll(false);

        // Clear intervals
        if (preRollIntervalRef.current) {
            clearInterval(preRollIntervalRef.current);
        }
        if (metronomeIntervalRef.current) {
            clearInterval(metronomeIntervalRef.current);
        }

        // Remove MIDI listeners
        midiInputService.removeEventListener('noteOn', handleNoteOn);
        midiInputService.removeEventListener('noteOff', handleNoteOff);

        // Finalize any active notes (in case user didn't release them)
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

        activeNotesRef.current.clear();
    }, [tempo, quantize, quantization, handleNoteOn, handleNoteOff]);

    // Clear recorded notes
    const clearRecordedNotes = useCallback(() => {
        setRecordedNotes([]);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isRecording) {
                stopRecording();
            }
        };
    }, [isRecording, stopRecording]);

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
