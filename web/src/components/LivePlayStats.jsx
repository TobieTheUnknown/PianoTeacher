import React, { memo } from 'react';
import styles from './LivePlayView.module.css';

/**
 * Composant pour afficher les statistiques de session et historiques
 * Mémorisé pour éviter les re-renders inutiles
 */
const LivePlayStats = memo(({
  sessionStats,
  songStats,
  showScores,
  onToggleScores,
  songTitle
}) => {
  const calculateAccuracy = () => {
    if (sessionStats.totalNotes === 0) return 0;
    return ((sessionStats.correctNotes / sessionStats.totalNotes) * 100).toFixed(1);
  };

  return (
    <>
      {/* Toggle Stats Button */}
      <button
        onClick={onToggleScores}
        className={styles.statsButton}
      >
        📊 {showScores ? 'Masquer' : 'Voir'} Statistiques
      </button>

      {/* Historical Statistics Panel */}
      {showScores && songStats && (
        <div className={styles.statsPanel}>
          <h3 className={styles.statsTitle}>
            📊 Statistiques - {songTitle}
          </h3>

          <div className={styles.statsGrid}>
            <StatCard label="Sessions jouées" value={songStats.totalSessions} />
            <StatCard label="Précision moyenne" value={`${songStats.averageAccuracy}%`} />
            <StatCard label="Meilleure précision" value={`${songStats.bestAccuracy}%`} />
            <StatCard label="Notes correctes" value={songStats.totalCorrectNotes} color="#22c55e" />
            <StatCard label="Notes manquées" value={songStats.totalMissedNotes} color="#f59e0b" />
            <StatCard label="Notes incorrectes" value={songStats.totalWrongNotes} color="#ef4444" />
            <StatCard label="Vitesse moyenne" value={`${songStats.averageSpeed}x`} />
            <StatCard label="Taux de complétion" value={`${songStats.completionRate}%`} />
          </div>
        </div>
      )}

      {/* Current Session Stats */}
      <div className={styles.sessionStats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            Précision
          </div>
          <div className={`${styles.statValue} ${styles.accuracy}`}>
            {calculateAccuracy()}%
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            ✨ Parfait
          </div>
          <div className={`${styles.statValue} ${styles.perfect}`}>
            {sessionStats.perfectNotes}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            ✓ Bien
          </div>
          <div className={`${styles.statValue} ${styles.good}`}>
            {sessionStats.goodNotes}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            ✗ Fausses
          </div>
          <div className={`${styles.statValue} ${styles.wrong}`}>
            {sessionStats.wrongNotes}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            ⊘ Manquées
          </div>
          <div className={`${styles.statValue} ${styles.missed}`}>
            {sessionStats.missedNotes}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            🔥 Max Combo
          </div>
          <div className={`${styles.statValue} ${sessionStats.maxCombo >= 10 ? styles.comboHigh : styles.combo}`}>
            {sessionStats.maxCombo}x
          </div>
        </div>
      </div>
    </>
  );
});

LivePlayStats.displayName = 'LivePlayStats';

/**
 * Helper component for individual stat cards
 */
function StatCard({ label, value, color }) {
  return (
    <div style={{
      padding: '1rem',
      background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        marginBottom: '0.5rem'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.5rem',
        fontWeight: '700',
        color: color || 'var(--text-primary)'
      }}>
        {value}
      </div>
    </div>
  );
}

export default LivePlayStats;
