const SCORES_KEY = 'piano_teacher_scores';

/**
 * ScoreService - Gestion des scores et statistiques d'apprentissage
 */
export const ScoreService = {
    /**
     * Récupère tous les scores
     */
    getAllScores: () => {
        try {
            const scores = localStorage.getItem(SCORES_KEY);
            return scores ? JSON.parse(scores) : {};
        } catch (error) {
            console.error('Error loading scores:', error);
            return {};
        }
    },

    /**
     * Récupère les scores pour un morceau spécifique
     * @param {string} songId - ID du morceau
     * @returns {Array} Tableau des sessions de jeu
     */
    getSongScores: (songId) => {
        const allScores = ScoreService.getAllScores();
        return allScores[songId] || [];
    },

    /**
     * Sauvegarde un nouveau score pour un morceau
     * @param {string} songId - ID du morceau
     * @param {Object} scoreData - Données du score
     */
    saveScore: (songId, scoreData) => {
        try {
            const allScores = ScoreService.getAllScores();

            if (!allScores[songId]) {
                allScores[songId] = [];
            }

            // Ajouter le nouveau score avec timestamp
            const newScore = {
                ...scoreData,
                timestamp: new Date().toISOString(),
                id: `${songId}_${Date.now()}`
            };

            allScores[songId].push(newScore);

            // Limiter à 50 scores par morceau pour éviter de surcharger le localStorage
            if (allScores[songId].length > 50) {
                allScores[songId] = allScores[songId].slice(-50);
            }

            localStorage.setItem(SCORES_KEY, JSON.stringify(allScores));
            return newScore;
        } catch (error) {
            console.error('Error saving score:', error);
            return null;
        }
    },

    /**
     * Calcule les statistiques globales pour un morceau
     * @param {string} songId - ID du morceau
     */
    getSongStatistics: (songId) => {
        const scores = ScoreService.getSongScores(songId);

        if (scores.length === 0) {
            return {
                totalSessions: 0,
                averageAccuracy: 0,
                bestAccuracy: 0,
                totalNotesPlayed: 0,
                totalCorrectNotes: 0,
                totalMissedNotes: 0,
                totalWrongNotes: 0,
                averageSpeed: 1.0,
                completionRate: 0
            };
        }

        const totalSessions = scores.length;
        const accuracies = scores.map(s => s.accuracy || 0);
        const averageAccuracy = accuracies.reduce((a, b) => a + b, 0) / totalSessions;
        const bestAccuracy = Math.max(...accuracies);

        const totalNotesPlayed = scores.reduce((sum, s) => sum + (s.totalNotes || 0), 0);
        const totalCorrectNotes = scores.reduce((sum, s) => sum + (s.correctNotes || 0), 0);
        const totalMissedNotes = scores.reduce((sum, s) => sum + (s.missedNotes || 0), 0);
        const totalWrongNotes = scores.reduce((sum, s) => sum + (s.wrongNotes || 0), 0);

        const speeds = scores.map(s => s.playbackSpeed || 1.0);
        const averageSpeed = speeds.reduce((a, b) => a + b, 0) / totalSessions;

        const completedSessions = scores.filter(s => s.completed).length;
        const completionRate = (completedSessions / totalSessions) * 100;

        return {
            totalSessions,
            averageAccuracy: Math.round(averageAccuracy * 100) / 100,
            bestAccuracy: Math.round(bestAccuracy * 100) / 100,
            totalNotesPlayed,
            totalCorrectNotes,
            totalMissedNotes,
            totalWrongNotes,
            averageSpeed: Math.round(averageSpeed * 100) / 100,
            completionRate: Math.round(completionRate * 100) / 100
        };
    },

    /**
     * Supprime tous les scores pour un morceau
     * @param {string} songId - ID du morceau
     */
    deleteSongScores: (songId) => {
        try {
            const allScores = ScoreService.getAllScores();
            delete allScores[songId];
            localStorage.setItem(SCORES_KEY, JSON.stringify(allScores));
            return true;
        } catch (error) {
            console.error('Error deleting scores:', error);
            return false;
        }
    },

    /**
     * Exporte tous les scores en JSON
     */
    exportScores: () => {
        const scores = ScoreService.getAllScores();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scores));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `scores_piano_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    /**
     * Sauvegarde un score pour une phrase spécifique
     * @param {string} songId - ID du morceau
     * @param {number} phraseIndex - Index de la phrase
     * @param {Object} scoreData - Données du score
     */
    savePhraseScore: (songId, phraseIndex, scoreData) => {
        try {
            const key = `${SCORES_KEY}_phrases`;
            const allPhraseScores = JSON.parse(localStorage.getItem(key) || '{}');
            const phraseKey = `${songId}_phrase_${phraseIndex}`;
            if (!allPhraseScores[phraseKey]) allPhraseScores[phraseKey] = [];
            allPhraseScores[phraseKey].push({
                ...scoreData,
                timestamp: new Date().toISOString(),
            });
            // Keep last 20 per phrase
            if (allPhraseScores[phraseKey].length > 20) {
                allPhraseScores[phraseKey] = allPhraseScores[phraseKey].slice(-20);
            }
            localStorage.setItem(key, JSON.stringify(allPhraseScores));
        } catch (error) {
            console.error('Error saving phrase score:', error);
        }
    },

    /**
     * Récupère les statistiques pour une phrase spécifique
     * @param {string} songId - ID du morceau
     * @param {number} phraseIndex - Index de la phrase
     */
    getPhraseStatistics: (songId, phraseIndex) => {
        try {
            const key = `${SCORES_KEY}_phrases`;
            const allPhraseScores = JSON.parse(localStorage.getItem(key) || '{}');
            const phraseKey = `${songId}_phrase_${phraseIndex}`;
            const scores = allPhraseScores[phraseKey] || [];
            if (scores.length === 0) return null;
            const accuracies = scores.map(s => s.accuracy || 0);
            const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / scores.length;
            return {
                averageAccuracy: Math.round(avgAccuracy * 100) / 100,
                bestAccuracy: Math.max(...accuracies),
                sessions: scores.length,
            };
        } catch (error) {
            console.error('Error getting phrase statistics:', error);
            return null;
        }
    },

    /**
     * Récupère les statistiques de toutes les phrases d'un morceau
     * @param {string} songId - ID du morceau
     * @param {number} phraseCount - Nombre total de phrases
     * @returns {Array} Tableau des statistiques par phrase
     */
    getAllPhraseStats: (songId, phraseCount) => {
        const stats = [];
        for (let i = 0; i < phraseCount; i++) {
            stats.push(ScoreService.getPhraseStatistics(songId, i));
        }
        return stats;
    },
};
