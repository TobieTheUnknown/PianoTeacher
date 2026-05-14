import React, { useMemo } from 'react';
import { STYLES } from './learnStyles';

export const TimelineBar = React.memo(function TimelineBar({ measure, displayNoteName, keySignature }) {
    const { soloMelodyNotes, soloChordNotes, simultaneousTimes } = useMemo(() => {
        const areSimultaneous = (time1, time2) => Math.abs(time1 - time2) < 0.15;
        const simTimes = new Set();

        measure.melody.forEach(melodyNote => {
            measure.chords.forEach(chordNote => {
                if (areSimultaneous(melodyNote.startTime, chordNote.startTime)) {
                    simTimes.add(melodyNote.startTime);
                }
            });
        });

        const simTimesArr = Array.from(simTimes);
        return {
            soloMelodyNotes: measure.melody.filter(n =>
                !simTimesArr.some(t => areSimultaneous(n.startTime, t))
            ),
            soloChordNotes: measure.chords.filter(n =>
                !simTimesArr.some(t => areSimultaneous(n.startTime, t))
            ),
            simultaneousTimes: simTimesArr,
        };
    }, [measure.melody, measure.chords]);

    return (
        <div style={STYLES.timelineBar}>
            {soloMelodyNotes.map(n => (
                <div key={`melody-${n.id}`} style={{
                    ...STYLES.timelineDotBase,
                    left: `${((n.startTime % 4) / 4) * 100}%`,
                    top: '-3px',
                    backgroundColor: 'var(--color-cyan)',
                }} title={`Main droite: ${displayNoteName(n.pitch, keySignature)}`} />
            ))}
            {soloChordNotes.map(n => (
                <div key={`chord-${n.id}`} style={{
                    ...STYLES.timelineDotBase,
                    left: `${((n.startTime % 4) / 4) * 100}%`,
                    bottom: '-3px',
                    backgroundColor: 'var(--color-pink)',
                }} title={`Main gauche: ${displayNoteName(n.pitch, keySignature)}`} />
            ))}
            {simultaneousTimes.map((time, idx) => (
                <div key={`both-${idx}`} style={{
                    ...STYLES.timelineDotBase,
                    left: `${((time % 4) / 4) * 100}%`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: 'var(--color-emerald)',
                }} title="2 mains ensemble" />
            ))}
        </div>
    );
});
