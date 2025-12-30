import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { getFrenchNoteName } from '../models/song';
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

    useEffect(() => {
        // MIDI event handlers
        const handleNoteOn = async (event) => {
            const { note, velocity } = event;

            console.log('MIDI noteOn event received:', event);

            // Validate note value
            if (typeof note !== 'number' || isNaN(note) || note < 0 || note > 127) {
                console.error('Invalid MIDI note value:', note, 'Full event:', event);
                return;
            }

            // Initialize audio on first MIDI event if needed (requires user interaction)
            if (!audioInitialized.current && !isInitializing.current) {
                isInitializing.current = true;
                try {
                    console.log('Initializing MIDI audio on first MIDI event...');
                    await audioEngine.initialize();
                    audioInitialized.current = true;
                    console.log('Global MIDI Audio initialized successfully');
                } catch (error) {
                    console.error('Failed to initialize MIDI audio:', error);
                    isInitializing.current = false;
                    return;
                }
            }

            // Wait for initialization to complete if in progress
            if (isInitializing.current && !audioInitialized.current) {
                // Skip this event, will work on next one
                return;
            }

            // Play audio with volume from settings
            if (audioInitialized.current && audioEngine.sampler) {
                // Ensure audio context is running
                if (Tone.context.state !== 'running') {
                    console.log('Starting Tone audio context...');
                    await Tone.start();
                }

                const midiSettings = midiInputService.getSettings();
                const midiVolume = (midiSettings.midiVolume || 70) / 100;

                console.log(`Playing MIDI note ${note} (${getFrenchNoteName(note)}) at volume ${midiVolume}, context state: ${Tone.context.state}`);

                try {
                    audioEngine.sampler.triggerAttack(
                        getFrenchNoteName(note),
                        Tone.now(),
                        velocity / 127 * midiVolume
                    );
                } catch (error) {
                    console.error('Error playing MIDI note:', error);
                }
            } else {
                console.warn('Cannot play MIDI note: audio not initialized or sampler not loaded', {
                    audioInitialized: audioInitialized.current,
                    samplerExists: !!audioEngine.sampler
                });
            }
        };

        const handleNoteOff = (event) => {
            const { note } = event;

            // Release audio
            if (audioInitialized.current && audioEngine.sampler) {
                audioEngine.sampler.triggerRelease(getFrenchNoteName(note), Tone.now());
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
