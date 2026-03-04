import { useEffect, useRef } from 'react';
import { getNoteNameFromMidi } from '../models/song';
import { midiInputService } from '../services/MidiInputService';
import { audioEngine } from '../services/AudioEngine';

/**
 * Global MIDI Audio Hook
 *
 * This hook provides audio playback for MIDI input globally across the app.
 * Should be used at the App level to ensure MIDI always produces sound.
 */
export function useMidiAudio() {
    const audioInitialized = useRef(false);
    const isInitializing = useRef(false);
    const toneRef = useRef(null);

    useEffect(() => {
        // MIDI event handlers
        const handleNoteOn = async (event) => {
            const { note, velocity } = event;

            if (typeof note !== 'number' || isNaN(note) || note < 0 || note > 127) {
                console.error('Invalid MIDI note value:', note);
                return;
            }

            // Initialize audio on first MIDI event if needed (requires user interaction)
            if (!audioInitialized.current && !isInitializing.current) {
                isInitializing.current = true;
                try {
                    await audioEngine.initialize();
                    toneRef.current = audioEngine.getTone();
                    audioInitialized.current = true;
                } catch (error) {
                    console.error('Failed to initialize MIDI audio:', error);
                    isInitializing.current = false;
                    return;
                }
            }

            if (isInitializing.current && !audioInitialized.current) {
                return;
            }

            const Tone = toneRef.current;
            if (audioInitialized.current && audioEngine.sampler && Tone) {
                if (Tone.context.state !== 'running') {
                    await Tone.start();
                }

                const midiSettings = midiInputService.getSettings();
                const midiVolume = (midiSettings.midiVolume || 70) / 100;
                const noteName = getNoteNameFromMidi(note);

                try {
                    audioEngine.sampler.triggerAttack(
                        noteName,
                        Tone.now(),
                        velocity / 127 * midiVolume
                    );
                } catch (error) {
                    console.error('Error playing MIDI note:', error);
                }
            }
        };

        const handleNoteOff = (event) => {
            const { note } = event;
            const Tone = toneRef.current;

            if (audioInitialized.current && audioEngine.sampler && Tone) {
                const noteName = getNoteNameFromMidi(note);
                audioEngine.sampler.triggerRelease(noteName, Tone.now());
            }
        };

        // Register MIDI listeners
        midiInputService.addEventListener('noteOn', handleNoteOn);
        midiInputService.addEventListener('noteOff', handleNoteOff);

        return () => {
            midiInputService.removeEventListener('noteOn', handleNoteOn);
            midiInputService.removeEventListener('noteOff', handleNoteOff);
        };
    }, []);
}
