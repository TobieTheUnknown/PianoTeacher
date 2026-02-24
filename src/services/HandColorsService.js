/**
 * 🎹 Hand Colors Service
 *
 * Gestion centralisée des couleurs des mains (MG/MD)
 * - Stockage persistant dans localStorage
 * - Couleurs accessibles partout dans l'app
 * - Changement à la volée
 */

const STORAGE_KEY = 'piano-teacher-hand-colors';

// Couleurs par défaut: MG = bleu, MD = rose/rouge
const DEFAULT_COLORS = {
    leftHand: {
        primary: '#3b82f6',      // Bleu - couleur principale
        light: '#60a5fa',        // Bleu clair - touches blanches
        dark: '#2563eb',         // Bleu foncé - touches noires
        selected: '#93c5fd',     // Bleu très clair - sélectionné
    },
    rightHand: {
        primary: '#f43f5e',      // Rose/Rouge - couleur principale
        light: '#fb7185',        // Rose clair - touches blanches
        dark: '#e11d48',         // Rose foncé - touches noires
        selected: '#fda4af',     // Rose très clair - sélectionné
    },
    scaleHighlight: {
        inScale: 'rgba(251, 191, 36, 0.15)',     // Ambre/Or doux
        outOfScale: 'rgba(30, 30, 40, 0.25)',    // Gris foncé
    }
};

// Presets de couleurs
const COLOR_PRESETS = {
    'default': {
        name: 'Classique (Bleu/Rose)',
        leftHand: { primary: '#3b82f6', light: '#60a5fa', dark: '#2563eb', selected: '#93c5fd' },
        rightHand: { primary: '#f43f5e', light: '#fb7185', dark: '#e11d48', selected: '#fda4af' },
    },
    'synthesia': {
        name: 'Synthesia (Vert/Bleu)',
        leftHand: { primary: '#22c55e', light: '#4ade80', dark: '#16a34a', selected: '#86efac' },
        rightHand: { primary: '#3b82f6', light: '#60a5fa', dark: '#2563eb', selected: '#93c5fd' },
    },
    'warm': {
        name: 'Chaleureux (Orange/Violet)',
        leftHand: { primary: '#f97316', light: '#fb923c', dark: '#ea580c', selected: '#fdba74' },
        rightHand: { primary: '#a855f7', light: '#c084fc', dark: '#9333ea', selected: '#d8b4fe' },
    },
    'ocean': {
        name: 'Océan (Cyan/Indigo)',
        leftHand: { primary: '#06b6d4', light: '#22d3ee', dark: '#0891b2', selected: '#67e8f9' },
        rightHand: { primary: '#6366f1', light: '#818cf8', dark: '#4f46e5', selected: '#a5b4fc' },
    },
};

// Presets pour le highlighting de la gamme
const SCALE_HIGHLIGHT_PRESETS = {
    'amber': {
        name: 'Ambre/Or',
        inScale: 'rgba(251, 191, 36, 0.15)',
        outOfScale: 'rgba(30, 30, 40, 0.25)',
    },
    'cyan': {
        name: 'Cyan',
        inScale: 'rgba(34, 211, 238, 0.12)',
        outOfScale: 'rgba(30, 30, 40, 0.25)',
    },
    'purple': {
        name: 'Violet',
        inScale: 'rgba(168, 85, 247, 0.12)',
        outOfScale: 'rgba(30, 30, 40, 0.25)',
    },
    'green': {
        name: 'Vert',
        inScale: 'rgba(34, 197, 94, 0.12)',
        outOfScale: 'rgba(30, 30, 40, 0.25)',
    },
    'white': {
        name: 'Blanc subtil',
        inScale: 'rgba(255, 255, 255, 0.08)',
        outOfScale: 'rgba(30, 30, 40, 0.25)',
    },
};

class HandColorsService {
    constructor() {
        this.colors = this.loadColors();
        this.listeners = new Set();
    }

    /**
     * Charge les couleurs depuis localStorage ou utilise les valeurs par défaut
     */
    loadColors() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge avec les défauts pour gérer les nouvelles propriétés
                return {
                    leftHand: { ...DEFAULT_COLORS.leftHand, ...parsed.leftHand },
                    rightHand: { ...DEFAULT_COLORS.rightHand, ...parsed.rightHand },
                    scaleHighlight: { ...DEFAULT_COLORS.scaleHighlight, ...parsed.scaleHighlight },
                };
            }
        } catch (error) {
            console.error('Erreur lors du chargement des couleurs:', error);
        }
        return { ...DEFAULT_COLORS };
    }

    /**
     * Sauvegarde les couleurs dans localStorage
     */
    saveColors() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.colors));
            this.notifyListeners();
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des couleurs:', error);
        }
    }

    /**
     * Récupère toutes les couleurs
     */
    getColors() {
        return this.colors;
    }

    /**
     * Récupère les couleurs d'une main
     * @param {'left' | 'right'} hand
     */
    getHandColors(hand) {
        return hand === 'left' ? this.colors.leftHand : this.colors.rightHand;
    }

    /**
     * Récupère les couleurs de highlighting de la gamme
     */
    getScaleHighlightColors() {
        return this.colors.scaleHighlight;
    }

    /**
     * Met à jour les couleurs d'une main
     * @param {'left' | 'right'} hand
     * @param {object} colors
     */
    setHandColors(hand, colors) {
        if (hand === 'left') {
            this.colors.leftHand = { ...this.colors.leftHand, ...colors };
        } else {
            this.colors.rightHand = { ...this.colors.rightHand, ...colors };
        }
        this.saveColors();
    }

    /**
     * Met à jour les couleurs de highlighting de la gamme
     * @param {object} colors
     */
    setScaleHighlightColors(colors) {
        this.colors.scaleHighlight = { ...this.colors.scaleHighlight, ...colors };
        this.saveColors();
    }

    /**
     * Applique un preset de couleurs
     * @param {string} presetName
     */
    applyPreset(presetName) {
        const preset = COLOR_PRESETS[presetName];
        if (preset) {
            this.colors.leftHand = { ...preset.leftHand };
            this.colors.rightHand = { ...preset.rightHand };
            this.saveColors();
            return true;
        }
        return false;
    }

    /**
     * Applique un preset de highlighting de gamme
     * @param {string} presetName
     */
    applyScaleHighlightPreset(presetName) {
        const preset = SCALE_HIGHLIGHT_PRESETS[presetName];
        if (preset) {
            this.colors.scaleHighlight = { ...preset };
            this.saveColors();
            return true;
        }
        return false;
    }

    /**
     * Récupère la liste des presets disponibles
     */
    getPresets() {
        return COLOR_PRESETS;
    }

    /**
     * Récupère la liste des presets de highlighting
     */
    getScaleHighlightPresets() {
        return SCALE_HIGHLIGHT_PRESETS;
    }

    /**
     * Réinitialise aux couleurs par défaut
     */
    resetToDefault() {
        this.colors = { ...DEFAULT_COLORS };
        this.saveColors();
    }

    /**
     * Échange les couleurs des deux mains
     */
    swapHands() {
        const temp = { ...this.colors.leftHand };
        this.colors.leftHand = { ...this.colors.rightHand };
        this.colors.rightHand = temp;
        this.saveColors();
    }

    /**
     * Ajoute un listener pour les changements de couleurs
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notifie tous les listeners d'un changement
     */
    notifyListeners() {
        this.listeners.forEach(callback => callback(this.colors));
    }

    /**
     * Récupère la couleur appropriée pour une note selon la main
     * @param {'left' | 'right'} hand
     * @param {boolean} isBlackKey
     * @param {boolean} isSelected
     */
    getNoteColor(hand, isBlackKey = false, isSelected = false) {
        const handColors = this.getHandColors(hand);
        if (isSelected) return handColors.selected;
        if (isBlackKey) return handColors.dark;
        return handColors.light;
    }

    /**
     * Récupère la couleur pour le piano roll (basée sur trackName)
     * @param {string} trackName - 'melody' (MD) ou 'chords' (MG)
     * @param {boolean} isSelected
     */
    getPianoRollNoteColor(trackName, isSelected = false) {
        // melody = main droite, chords = main gauche
        const hand = trackName === 'melody' ? 'right' : 'left';
        const handColors = this.getHandColors(hand);
        return isSelected ? handColors.selected : handColors.primary;
    }
}

// Instance singleton
const handColorsService = new HandColorsService();

// Exposer globalement pour debug
if (typeof window !== 'undefined') {
    window.HandColors = handColorsService;
}

export default handColorsService;
export { COLOR_PRESETS, SCALE_HIGHLIGHT_PRESETS };
