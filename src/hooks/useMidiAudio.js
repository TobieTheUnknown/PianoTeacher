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

    useEffect(() => {
        // Initialize audio engine
        const initAudio = async () => {
            if (!audioInitialized.current) {
                await audioEngine.initialize();
                audioInitialized.current = true;
                console.log('Global MIDI Audio initialized');
            }
        };
        initAudio();

        // MIDI event handlers
        const handleNoteOn = (event) => {
            const { note, velocity } = event;

            // Play audio with volume from settings
            if (audioInitialized.current && audioEngine.sampler) {
                const midiSettings = midiInputService.getSettings();
                const midiVolume = (midiSettings.midiVolume || 70) / 100;

                audioEngine.sampler.triggerAttack(
                    getFrenchNoteName(note),
                    Tone.now(),
                    velocity / 127 * midiVolume
                );
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
