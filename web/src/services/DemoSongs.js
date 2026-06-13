/**
 * Demo songs preloader — fills an EMPTY library with the bundled corpus so the
 * hosted web version isn't a blank page on first visit.
 *
 * Only runs when: the library has zero songs AND the one-shot flag is absent
 * (so a user who deletes everything on purpose isn't re-flooded).
 */

import { StorageService } from './StorageService';

const DEMO_FLAG = 'piano-teacher-demos-loaded';

const DEMOS = [
    { file: 'DepartureTwitch.mid', title: 'Departure' },
    { file: 'OtherPromiseTwitch.mid', title: 'Other Promise — Kingdom Hearts' },
    { file: 'HalleluahTwitch.mid', title: 'Halleluah' },
    { file: 'LaputaTwitch.mid', title: 'Laputa — Le Château dans le Ciel' },
];

export async function preloadDemoSongsIfEmpty() {
    try {
        if (localStorage.getItem(DEMO_FLAG)) return false;
        const existing = StorageService.getSongs();
        if (existing && existing.length > 0) {
            localStorage.setItem(DEMO_FLAG, '1');
            return false;
        }

        const { parseMidiFile } = await import('./MidiService');
        const base = import.meta.env.BASE_URL + 'demo/';
        let loaded = 0;
        for (const demo of DEMOS) {
            try {
                const res = await fetch(base + demo.file);
                if (!res.ok) continue;
                const blob = await res.blob();
                const file = new File([blob], demo.file, { type: 'audio/midi' });
                const song = await parseMidiFile(file);
                song.title = demo.title;
                StorageService.saveSong(song);
                loaded++;
            } catch (e) {
                console.warn('[DemoSongs] failed to preload', demo.file, e);
            }
        }
        localStorage.setItem(DEMO_FLAG, '1');
        return loaded > 0;
    } catch (e) {
        console.warn('[DemoSongs] preload skipped:', e);
        return false;
    }
}
