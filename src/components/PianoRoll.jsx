import React, { useState, useRef, useEffect } from 'react';
import { getPianoRollKeys, getFrenchNoteName } from '../models/song';
import { audioEngine } from '../services/AudioEngine';

const CELL_WIDTH = 40; // px per beat
const CELL_HEIGHT = 24; // px per note

export function PianoRoll({ phrase, trackName, onAddNote, onRemoveNote }) {
    const [keys] = useState(() => getPianoRollKeys(3, 5)); // C3 to B5
    const scrollRef = useRef(null);

    const handleGridClick = (pitch, beatIndex) => {
        // Check if note exists at this position
        const existingNote = phrase.tracks[trackName].find(
            n => n.pitch === pitch && Math.abs(n.startTime - beatIndex) < 0.1
        );

        if (existingNote) {
            onRemoveNote(phrase.id, trackName, existingNote.id);
        } else {
            onAddNote(phrase.id, trackName, pitch, beatIndex, 1); // Default duration 1 beat
            audioEngine.playNote(pitch);
        }
    };

    return (
        <div className="piano-roll" style={{
            display: 'flex',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            height: '400px',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary)'
        }}>
            {/* Piano Keys (Y-axis) */}
            <div style={{
                width: '80px',
                overflowY: 'hidden',
                borderRight: '1px solid var(--border-color)',
                backgroundColor: 'white',
                color: 'black',
                flexShrink: 0
            }}>
                <div style={{ transform: `translateY(-${scrollRef.current?.scrollTop || 0}px)` }}>
                    {keys.map(pitch => {
                        const isBlack = pitch.includes('#');
                        return (
                            <div key={pitch} style={{
                                height: `${CELL_HEIGHT}px`,
                                backgroundColor: isBlack ? '#333' : 'white',
                                color: isBlack ? 'white' : 'black',
                                borderBottom: '1px solid #eee',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: '0.5rem',
                                boxSizing: 'border-box'
                            }}>
                                {getFrenchNoteName(pitch)}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Grid (Content) */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    position: 'relative',
                    backgroundColor: 'var(--bg-tertiary)'
                }}
                onScroll={(e) => {
                    // Sync scroll if we had separate headers, but here we just need to handle internal scroll
                }}
            >
                <div style={{
                    width: `${phrase.length * 4 * CELL_WIDTH}px`, // 4 beats per measure
                    height: `${keys.length * CELL_HEIGHT}px`,
                    position: 'relative'
                }}>
                    {/* Grid Lines */}
                    {Array.from({ length: phrase.length * 4 }).map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            left: `${i * CELL_WIDTH}px`,
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            backgroundColor: i % 4 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'
                        }} />
                    ))}
                    {keys.map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: `${i * CELL_HEIGHT}px`,
                            height: '1px',
                            backgroundColor: 'rgba(255,255,255,0.05)'
                        }} />
                    ))}

                    {/* Notes */}
                    {phrase.tracks[trackName].map(note => {
                        const keyIndex = keys.indexOf(note.pitch);
                        if (keyIndex === -1) return null; // Note out of range

                        return (
                            <div
                                key={note.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveNote(phrase.id, trackName, note.id);
                                }}
                                style={{
                                    position: 'absolute',
                                    left: `${note.startTime * CELL_WIDTH}px`,
                                    top: `${keyIndex * CELL_HEIGHT}px`,
                                    width: `${note.duration * CELL_WIDTH - 1}px`,
                                    height: `${CELL_HEIGHT - 1}px`,
                                    backgroundColor: trackName === 'melody' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    zIndex: 10
                                }}
                            />
                        );
                    })}

                    {/* Click Area Overlay */}
                    {keys.map((pitch, yIndex) => (
                        Array.from({ length: phrase.length * 4 }).map((_, xIndex) => (
                            <div
                                key={`${pitch}-${xIndex}`}
                                onClick={() => handleGridClick(pitch, xIndex)}
                                style={{
                                    position: 'absolute',
                                    left: `${xIndex * CELL_WIDTH}px`,
                                    top: `${yIndex * CELL_HEIGHT}px`,
                                    width: `${CELL_WIDTH}px`,
                                    height: `${CELL_HEIGHT}px`,
                                    zIndex: 5
                                }}
                            />
                        ))
                    ))}
                </div>
            </div>
        </div>
    );
}
