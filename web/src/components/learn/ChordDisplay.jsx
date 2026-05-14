import React from 'react';
import { STYLES } from './learnStyles';

// ── Sub-views ────────────────────────────────────────────────────────────────

function ArpeggioChordView({ measure, motifInfo, detectedChord, expandedChordReps, onToggleChordRep, showDetails, displayNoteName, keySignature, isMobile }) {
    const reps = motifInfo?.repetitions || 1;
    const chords = motifInfo?.chords || [detectedChord];
    const totalNotes = measure.chordGroups.length;
    const notesPerCycle = Math.ceil(totalNotes / reps);

    if (isMobile) {
        const groups = [];
        let i = 0;
        while (i < reps) {
            const chord = chords[i] || detectedChord;
            let count = 1;
            while (i + count < reps && (chords[i + count] || detectedChord).displayName === chord.displayName) {
                count++;
            }
            groups.push({ chord, count, startIdx: i });
            i += count;
        }

        return (
            <div>
                {groups.map((group, gIdx) => {
                    const { chord, count, startIdx } = group;
                    const isExpanded = expandedChordReps.has(startIdx) || showDetails;
                    const seenPitches = new Set();
                    const uniqueGroups = [];
                    for (let r = 0; r < count; r++) {
                        const repIdx = startIdx + r;
                        const cycleStart = repIdx * notesPerCycle;
                        const cycleEnd = Math.min(cycleStart + notesPerCycle, totalNotes);
                        measure.chordGroups.slice(cycleStart, cycleEnd).forEach(cg => {
                            const pitch = cg.notes[0].pitch;
                            if (!seenPitches.has(pitch)) {
                                seenPitches.add(pitch);
                                uniqueGroups.push(cg);
                            }
                        });
                    }

                    return (
                        <div key={gIdx} style={{ marginBottom: '0.15rem' }}>
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleChordRep(measure.number, startIdx);
                                }}
                                style={STYLES.chordBadge}
                                title="Cliquer pour voir les notes"
                            >
                                {chord.displayName}
                                {count > 1 && (
                                    <span style={{ fontSize: '0.6em', marginLeft: '0.25rem', opacity: 0.75 }}>x{count}</span>
                                )}
                            </span>
                            {isExpanded && (
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.15rem',
                                    alignItems: 'center',
                                    marginTop: '0.1rem',
                                    marginLeft: '0.2rem'
                                }}>
                                    {uniqueGroups.map((chordGroup, idx) => (
                                        <span key={idx} style={{
                                            ...STYLES.noteBadgeSmall,
                                            border: '1px solid var(--color-pink-border)',
                                        }}>
                                            {displayNoteName(chordGroup.notes[0].pitch, keySignature)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div>
            {Array.from({ length: reps }).map((_, repIdx) => {
                const isExpanded = expandedChordReps.has(repIdx) || showDetails;
                const cycleStart = repIdx * notesPerCycle;
                const cycleEnd = Math.min(cycleStart + notesPerCycle, totalNotes);
                const cycleGroups = measure.chordGroups.slice(cycleStart, cycleEnd);
                const cycleChord = chords[repIdx] || detectedChord;

                return (
                    <div key={repIdx} style={{ marginBottom: '0.15rem' }}>
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleChordRep(measure.number, repIdx);
                            }}
                            style={STYLES.chordBadge}
                            title="Cliquer pour voir les notes"
                        >
                            {cycleChord.displayName}
                        </span>
                        {isExpanded && (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.15rem',
                                alignItems: 'center',
                                marginTop: '0.1rem',
                                marginLeft: '0.2rem'
                            }}>
                                {cycleGroups.map((chordGroup, idx) => (
                                    <span key={idx} style={{
                                        ...STYLES.noteBadgeSmall,
                                        border: '1px solid var(--color-pink-border)',
                                    }}>
                                        {displayNoteName(chordGroup.notes[0].pitch, keySignature)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ArpeggioSequenceView({ chordGroups, displayNoteName, keySignature }) {
    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.2rem',
            alignItems: 'center'
        }}>
            {chordGroups.map((chordGroup, idx) => {
                const noteName = displayNoteName(chordGroup.notes[0].pitch, keySignature);
                const isFirst = idx === 0;
                return (
                    <span key={idx} style={{
                        ...STYLES.noteBadge,
                        border: isFirst ? '2px solid var(--color-pink)' : '1px solid var(--color-pink-border)',
                        fontWeight: isFirst ? 'bold' : 'normal',
                        color: isFirst ? 'var(--color-pink-bright)' : 'var(--text-primary)',
                    }}>
                        {noteName}
                    </span>
                );
            })}
        </div>
    );
}

function SimultaneousChordsView({ chordGroups, showDetails, displayNoteName, keySignature }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {chordGroups.map((chordGroup, idx) => {
                const chordName = displayNoteName(chordGroup.notes[0].pitch, keySignature);
                return (
                    <div key={idx}>
                        <div style={{
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: 'var(--color-pink-bright)'
                        }}>
                            {chordName}
                        </div>
                        {showDetails && (
                            <div style={{
                                fontSize: '0.6rem',
                                color: 'var(--text-secondary)',
                                marginTop: '0.1rem',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.15rem'
                            }}>
                                {chordGroup.notes.map((n, i) => (
                                    <span key={i} style={{
                                        ...STYLES.noteBadgeSmall,
                                        border: '1px solid var(--color-pink-border)',
                                    }}>
                                        {displayNoteName(n.pitch, keySignature)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Main ChordDisplay ────────────────────────────────────────────────────────

export const ChordDisplay = React.memo(function ChordDisplay({ measure, keySignature, showDetails, displayNoteName, expandedChordReps, onToggleChordRep, isMobile }) {
    const { isArpeggio, detectedChord, motifInfo, chordGroups, hasChord } = measure;

    return (
        <div style={{ marginBottom: '0.4rem', paddingRight: '1.75rem' }}>
            <div style={STYLES.sectionLabel}>
                {isArpeggio && detectedChord && motifInfo?.repetitions > 1 ? (
                    <>Accords (arpège de {chordGroups.length} notes, {motifInfo.repetitions}x{motifInfo.notesPerCycle})</>
                ) : isArpeggio && detectedChord ? (
                    <>Accord (arpège de {chordGroups.length} notes)</>
                ) : isArpeggio ? (
                    <>Arpège ({chordGroups.length} notes)</>
                ) : (
                    <>Accords {chordGroups.length > 1 && `(${chordGroups.length})`}</>
                )}
            </div>

            {hasChord ? (
                isArpeggio && detectedChord ? (
                    <ArpeggioChordView
                        measure={measure}
                        motifInfo={motifInfo}
                        detectedChord={detectedChord}
                        expandedChordReps={expandedChordReps}
                        onToggleChordRep={onToggleChordRep}
                        showDetails={showDetails}
                        displayNoteName={displayNoteName}
                        keySignature={keySignature}
                        isMobile={isMobile}
                    />
                ) : isArpeggio ? (
                    <ArpeggioSequenceView
                        chordGroups={chordGroups}
                        displayNoteName={displayNoteName}
                        keySignature={keySignature}
                    />
                ) : (
                    <SimultaneousChordsView
                        chordGroups={chordGroups}
                        showDetails={showDetails}
                        displayNoteName={displayNoteName}
                        keySignature={keySignature}
                    />
                )
            ) : (
                <div style={{
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: 'var(--text-muted)'
                }}>
                    -
                </div>
            )}
        </div>
    );
});
