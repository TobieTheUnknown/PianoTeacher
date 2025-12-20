import React, { useState } from 'react';
import { DEGREES, NOTES } from '../models/song';

export function PhraseBuilder({ phrase, index, onRemove, onAddEvent, onRemoveEvent }) {
    const [inputType, setInputType] = useState('chord'); // 'chord' | 'note'
    const [selectedValue, setSelectedValue] = useState(DEGREES[0]);

    const handleAdd = () => {
        onAddEvent(inputType, selectedValue);
    };

    return (
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                backgroundColor: 'var(--accent-secondary)'
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingLeft: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{phrase.name}</h3>
                <button
                    onClick={onRemove}
                    style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.9rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444'
                    }}
                >
                    Supprimer
                </button>
            </div>

            {/* Timeline / Events View */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                padding: '1rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                minHeight: '80px',
                alignItems: 'center'
            }}>
                {phrase.events.map((event, i) => (
                    <div key={event.id} style={{
                        flexShrink: 0,
                        backgroundColor: event.type === 'chord' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                        color: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        position: 'relative',
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                        onClick={() => onRemoveEvent(event.id)}
                        title="Cliquez pour supprimer"
                    >
                        <span style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>
                            {event.type === 'chord' ? 'Accord' : 'Note'}
                        </span>
                        <span style={{ fontWeight: 'bold' }}>{event.value}</span>
                    </div>
                ))}

                {phrase.events.length === 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Aucun événement...</span>
                )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
                <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Type</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => { setInputType('chord'); setSelectedValue(DEGREES[0]); }}
                            style={{
                                backgroundColor: inputType === 'chord' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: 'white'
                            }}
                        >
                            Accord
                        </button>
                        <button
                            onClick={() => { setInputType('note'); setSelectedValue(NOTES[0]); }}
                            style={{
                                backgroundColor: inputType === 'note' ? 'var(--accent-secondary)' : 'var(--bg-tertiary)',
                                color: 'white'
                            }}
                        >
                            Note
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Valeur</label>
                    <select
                        value={selectedValue}
                        onChange={(e) => setSelectedValue(e.target.value)}
                        style={{
                            padding: '0.6rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            minWidth: '100px'
                        }}
                    >
                        {(inputType === 'chord' ? DEGREES : NOTES).map(val => (
                            <option key={val} value={val}>{val}</option>
                        ))}
                    </select>
                </div>

                <button onClick={handleAdd}>
                    Ajouter
                </button>
            </div>
        </div>
    );
}
