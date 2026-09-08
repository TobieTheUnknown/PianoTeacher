import { getMidiNumber } from '../models/song.js';

/**
 * Lossless segmentation of ordered note-on groups into consecutive repetitions.
 * Compare sounding pitches (including octaves), never chord guesses or timing:
 * expressive timing stays in the source notes; only the written sequence folds.
 * Minimise written note groups plus repetition markers. No notes are discarded.
 */
export function segmentRepeatedMotifs(groups) {
    const ordered = [...groups].sort((a, b) => a.startTime - b.startTime);
    const keys = ordered.map(g => g.notes.map(n => getMidiNumber(n.pitch)).sort((a, b) => a - b).join(','));
    const n = keys.length;
    const best = new Array(n + 1);
    best[n] = { cost: 0, rows: 0 };
    for (let i = n - 1; i >= 0; i--) {
        best[i] = { cost: 1 + best[i + 1].cost, rows: 1 + best[i + 1].rows, length: 1, reps: 1, end: i + 1 };
        for (let length = 1; length * 2 <= n - i; length++) {
            for (let reps = 2; i + length * reps <= n; reps++) {
                const nextStart = i + (reps - 1) * length;
                let equal = true;
                for (let k = 0; k < length; k++) {
                    if (keys[i + k] !== keys[nextStart + k]) { equal = false; break; }
                }
                if (!equal) break;
                const end = i + length * reps;
                const cost = length + 1 + best[end].cost;
                const rows = 1 + best[end].rows;
                if (cost < best[i].cost || (cost === best[i].cost && rows <= best[i].rows)) {
                    best[i] = { cost, rows, length, reps, end };
                }
            }
        }
    }
    const segments = [];
    for (let i = 0; i < n;) {
        const { length, reps, end } = best[i];
        const previous = segments.at(-1);
        if (reps === 1 && previous?.repetitions === 1) {
            previous.groups.push(ordered[i]);
            previous.eventCount++;
        } else {
            segments.push({ groups: ordered.slice(i, i + length), repetitions: reps, startIndex: i, eventCount: end - i });
        }
        i = end;
    }
    return segments;
}
