import React from 'react';
import { STYLES } from './learnStyles';

export const TipCard = React.memo(function TipCard({ icon, text }) {
    return (
        <div style={STYLES.tipCard}>
            <span style={{ fontSize: '1.25rem' }}>{icon}</span>
            <span style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>{text}</span>
        </div>
    );
});
