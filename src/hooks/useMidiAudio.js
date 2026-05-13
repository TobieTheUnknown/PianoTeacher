import { useEffect, useRef } from 'react';
import { getNoteNameFromMidi } from '../models/song';
import { midiInputService } from '../services/MidiInputService';
import { audioEngine } from '../services/AudioEngine';

/**
 * Global MIDI Audio Hook
 *
 * Plays audio for MIDI input across the whole app. Mounted once near the
 * App root (AppMobile / AppDesktop).
 *
 * Cold-start strategy: preload the sampler at mount (downloads MP3s while
 * the UI is rendering). The AudioContext stays suspended until any user
 * gesture (click/touch/keydown) — at that point we resume. MIDI events
 * arriving before samples are ready are queued and flushed on load, so the
 * very first key press makes sound instead of being silently dropped.
 *
 * Sustain pedal (CC64): while held, noteOffs are deferred until the pedal
 * is released, matching acoustic piano behavior.
 */
export function useMidiAudio() {
    const toneRef = useRef(null);
    const pendingEvents = useRef([]); // queue of {type:'on'|'off', note, velocity?}
    const pedalEngaged = useRef(false);
    const heldByPedal = useRef(new Set()); // MIDI notes waiting for pedal release

    useEffect(() => {
        // Capture toneRef as soon as Tone is loaded (preload imports the module).
        const flushPending = () => {
            const Tone = toneRef.current;
            if (!Tone || !audioEngine.sampler) return;
            const now = Tone.now();
            while (pendingEvents.current.length > 0) {
                const ev = pendingEvents.current.shift();
                try {
                    const name = getNoteNameFromMidi(ev.note);
                    if (ev.type === 'on') {
                        audioEngine.sampler.triggerAttack(name, now, ev.velocity);
                    } else {
                        audioEngine.sampler.triggerRelease(name, now);
                    }
                } catch (err) {
                    console.error('[useMidiAudio] flush error:', err);
                }
            }
        };

        // Kick off the sample download immediately. Resolves when MP3s are decoded.
        audioEngine.preload().then(() => {
            toneRef.current = audioEngine.getTone();
            flushPending();
        }).catch((err) => {
            console.error('[useMidiAudio] preload failed:', err);
        });

        // Resume the AudioContext on the first real user gesture. Browsers
        // require a user-initiated event; once unlocked it stays running.
        const resumeContext = () => {
            audioEngine.start().catch((err) => {
                console.error('[useMidiAudio] start failed:', err);
            });
        };
        const gestureEvents = ['pointerdown', 'touchstart', 'keydown'];
        gestureEvents.forEach((evt) => {
            window.addEventListener(evt, resumeContext, { passive: true });
        });

        const handleNoteOn = async (event) => {
            const { note, velocity } = event;

            if (typeof note !== 'number' || isNaN(note) || note < 0 || note > 127) {
                console.error('Invalid MIDI note value:', note);
                return;
            }

            const midiSettings = midiInputService.getSettings();
            const midiVolume = (midiSettings.midiVolume || 70) / 100;
            const adjustedVel = (velocity / 127) * midiVolume;

            // If a previous noteOff for this pitch is still deferred by the
            // pedal, drop it from the held set — the new attack supersedes it.
            heldByPedal.current.delete(note);

            // Samples still loading → queue and bail.
            if (!audioEngine.samplerLoaded) {
                if (pendingEvents.current.length < 64) {
                    pendingEvents.current.push({ type: 'on', note, velocity: adjustedVel });
                }
                return;
            }

            const Tone = toneRef.current;
            if (!Tone || !audioEngine.sampler) return;

            // Resume context if the gesture listener was registered after
            // a non-gesture path resumed it (defensive — usually a no-op).
            if (Tone.context.state !== 'running') {
                try { await Tone.start(); } catch (_) {}
            }

            try {
                audioEngine.sampler.triggerAttack(
                    getNoteNameFromMidi(note),
                    Tone.now(),
                    adjustedVel
                );
            } catch (err) {
                console.error('Error playing MIDI note:', err);
            }
        };

        const handleNoteOff = (event) => {
            const { note } = event;

            // While the pedal is down, hold the release until the pedal lifts.
            if (pedalEngaged.current) {
                heldByPedal.current.add(note);
                return;
            }

            if (!audioEngine.samplerLoaded) {
                if (pendingEvents.current.length < 64) {
                    pendingEvents.current.push({ type: 'off', note });
                }
                return;
            }

            const Tone = toneRef.current;
            if (!Tone || !audioEngine.sampler) return;
            try {
                audioEngine.sampler.triggerRelease(
                    getNoteNameFromMidi(note),
                    Tone.now()
                );
            } catch (err) {
                console.error('Error releasing MIDI note:', err);
            }
        };

        const handleSustainPedal = (event) => {
            // CC64 value: 0–63 = released, 64–127 = pressed (MIDI 1.0 spec).
            const ccValue = event.velocity ?? event.value ?? 0;
            const engaged = ccValue >= 64;
            const wasEngaged = pedalEngaged.current;
            pedalEngaged.current = engaged;

            // On pedal lift, release every note whose noteOff we deferred.
            if (wasEngaged && !engaged) {
                const Tone = toneRef.current;
                if (!Tone || !audioEngine.sampler) {
                    heldByPedal.current.clear();
                    return;
                }
                const now = Tone.now();
                heldByPedal.current.forEach((midi) => {
                    try {
                        audioEngine.sampler.triggerRelease(getNoteNameFromMidi(midi), now);
                    } catch (_) {}
                });
                heldByPedal.current.clear();
            }
        };

        midiInputService.addEventListener('noteOn', handleNoteOn);
        midiInputService.addEventListener('noteOff', handleNoteOff);
        midiInputService.addEventListener('sustainPedal', handleSustainPedal);

        return () => {
            midiInputService.removeEventListener('noteOn', handleNoteOn);
            midiInputService.removeEventListener('noteOff', handleNoteOff);
            midiInputService.removeEventListener('sustainPedal', handleSustainPedal);
            gestureEvents.forEach((evt) => {
                window.removeEventListener(evt, resumeContext);
            });
        };
    }, []);
}
