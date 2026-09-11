/** Web MIDI timestamps share performance.now(); invalid/epoch values use receipt time. */
export function normalizedMidiTimestamp(timestamp, receivedAt, compensation = 0) {
    const receipt = Number.isFinite(receivedAt) && receivedAt >= 0 ? receivedAt : 0;
    const raw = Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= receipt ? timestamp : receipt;
    const offset = Number.isFinite(compensation) ? Math.max(-100, Math.min(100, compensation)) : 0;
    return Math.max(0, raw + offset);
}

export function midiRecordingBeat(timestamp, recordingStart, tempo) {
    if (!Number.isFinite(timestamp) || !Number.isFinite(recordingStart) || !Number.isFinite(tempo) || tempo <= 0) return 0;
    return Math.max(0, (timestamp - recordingStart) * tempo / 60000);
}

/** Quantization and clipping must still leave a positive note inside the phrase. */
export function finalizedMidiTiming(startBeat, endBeat, phraseLength, quantize, minimumDuration) {
    if (![startBeat, endBeat, phraseLength, minimumDuration].every(Number.isFinite) || phraseLength <= 0 || minimumDuration <= 0) return null;
    const start = Math.max(0, startBeat);
    if (start >= phraseLength) return null;
    const end = Math.max(start, Math.min(phraseLength, endBeat));
    const quantizedStart = quantize(start);
    const quantizedDuration = quantize(end - start);
    if (!Number.isFinite(quantizedStart) || !Number.isFinite(quantizedDuration)) return null;
    const startTime = Math.max(0, Math.min(quantizedStart, Math.max(0, phraseLength - minimumDuration)));
    const duration = Math.min(phraseLength - startTime, Math.max(minimumDuration, quantizedDuration));
    return { startTime, duration };
}

/** Map a compensated event onto the audible song clock sampled at receipt. */
export function midiLiveTime(timestamp, nowMs, positionSec, running) {
    const position = Number.isFinite(positionSec) ? positionSec : 0;
    if (!running || !Number.isFinite(timestamp) || !Number.isFinite(nowMs)) return Math.max(0, position);
    return Math.max(0, position + (timestamp - nowMs) / 1000);
}

/** Search at event time, independently of the last rendered expected-note window. */
export function judgeMidiAttack(notes, pitch, timeSec, beatsPerSecond, handMode, statuses, tolerance = 0.302) {
    if (handMode === 'watch' || !Number.isFinite(timeSec) || !Number.isFinite(beatsPerSecond) || beatsPerSecond <= 0) return null;
    let best = null;
    for (const note of notes) {
        if (note.pitch !== pitch || (handMode !== 'both' && note.hand !== handMode)) continue;
        const status = statuses.get(note.id);
        // A frame may have marked this note missed before a delayed MIDI event
        // arrives; its corrected timestamp is authoritative for the judgment.
        if (status && status !== 'missed') continue;
        const difference = Math.abs(timeSec - note.startTime / beatsPerSecond);
        if (difference > tolerance || (best && difference >= best.difference)) continue;
        best = { note, difference, accuracy: difference <= 0.052 ? 'perfect' : difference <= 0.152 ? 'good' : 'ok' };
    }
    return best;
}
