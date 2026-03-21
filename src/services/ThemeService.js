/**
 * 🎨 Theme Service
 *
 * Service unifié pour gérer le thème de l'application.
 * Remplace ThemeEngine + HandColorsService.
 * 2 thèmes : Dark (default) et Light.
 * Toutes les couleurs (mains, UI, accents) sont gérées via CSS variables.
 */

const STORAGE_KEY = 'piano-teacher-theme';

const THEMES = {
    dark: {
        name: 'Sombre',
        css: {
            '--bg-primary': '#0a0a0a',
            '--bg-secondary': '#141414',
            '--bg-tertiary': '#1a1a1a',
            '--bg-elevated': '#1f1f1f',
            '--bg-card': '#171717',
            '--bg-hover': '#252525',
            '--text-primary': '#f5f5f5',
            '--text-secondary': '#a3a3a3',
            '--text-tertiary': '#737373',
            '--text-muted': '#525252',
            '--text-accent': '#e5e5e5',
            '--accent-primary': '#f5f5f5',
            '--accent-secondary': '#a3a3a3',
            '--accent-hover': '#ffffff',
            '--accent-success': '#22c55e',
            '--accent-danger': '#ef4444',
            '--accent-warning': '#f59e0b',
            '--accent-info': '#3b82f6',
            '--border-color': '#262626',
            '--border-light': '#1f1f1f',
            '--border-medium': '#404040',
            '--border-dark': '#525252',
            '--border-accent': '#f5f5f5',
            '--hand-left': '#6a9ff5',
            '--hand-left-light': '#8bb8fa',
            '--hand-left-dark': '#4a80d8',
            '--hand-left-selected': '#a8cbfd',
            '--hand-right': '#e8707e',
            '--hand-right-light': '#f09098',
            '--hand-right-dark': '#c85060',
            '--hand-right-selected': '#f5b0b8',
            '--hand-both': '#4ec9a0',
            '--scale-in': 'rgba(251, 191, 36, 0.15)',
            '--scale-out': 'rgba(30, 30, 40, 0.25)',
        },
    },
    light: {
        name: 'Clair',
        css: {
            '--bg-primary': '#f8f8f8',
            '--bg-secondary': '#ffffff',
            '--bg-tertiary': '#f0f0f0',
            '--bg-elevated': '#ffffff',
            '--bg-card': '#ffffff',
            '--bg-hover': '#e8e8e8',
            '--text-primary': '#1a1a1a',
            '--text-secondary': '#525252',
            '--text-tertiary': '#737373',
            '--text-muted': '#a3a3a3',
            '--text-accent': '#262626',
            '--accent-primary': '#1a1a1a',
            '--accent-secondary': '#525252',
            '--accent-hover': '#000000',
            '--accent-success': '#16a34a',
            '--accent-danger': '#dc2626',
            '--accent-warning': '#d97706',
            '--accent-info': '#2563eb',
            '--border-color': '#e5e5e5',
            '--border-light': '#f0f0f0',
            '--border-medium': '#d4d4d4',
            '--border-dark': '#a3a3a3',
            '--border-accent': '#1a1a1a',
            '--hand-left': '#4a80d8',
            '--hand-left-light': '#6a9ff5',
            '--hand-left-dark': '#3568b8',
            '--hand-left-selected': '#8bb8fa',
            '--hand-right': '#c85060',
            '--hand-right-light': '#e07080',
            '--hand-right-dark': '#a84050',
            '--hand-right-selected': '#f09098',
            '--hand-both': '#3aaa80',
            '--scale-in': 'rgba(217, 119, 6, 0.12)',
            '--scale-out': 'rgba(200, 200, 210, 0.2)',
        },
    },
    midnight: {
        name: 'Bleu Nuit',
        css: {
            '--bg-primary': '#0a0e1a',
            '--bg-secondary': '#111827',
            '--bg-tertiary': '#1e293b',
            '--bg-elevated': '#1e293b',
            '--bg-card': '#151d2e',
            '--bg-hover': '#283548',
            '--text-primary': '#e2e8f0',
            '--text-secondary': '#94a3b8',
            '--text-tertiary': '#64748b',
            '--text-muted': '#475569',
            '--text-accent': '#cbd5e1',
            '--accent-primary': '#e2e8f0',
            '--accent-secondary': '#94a3b8',
            '--accent-hover': '#f1f5f9',
            '--accent-success': '#22c55e',
            '--accent-danger': '#ef4444',
            '--accent-warning': '#f59e0b',
            '--accent-info': '#38bdf8',
            '--border-color': '#1e293b',
            '--border-light': '#1e293b',
            '--border-medium': '#334155',
            '--border-dark': '#475569',
            '--border-accent': '#e2e8f0',
            '--hand-left': '#40b8c8',
            '--hand-left-light': '#60d0e0',
            '--hand-left-dark': '#2898a8',
            '--hand-left-selected': '#80e0f0',
            '--hand-right': '#e08840',
            '--hand-right-light': '#f0a060',
            '--hand-right-dark': '#c07030',
            '--hand-right-selected': '#f0c080',
            '--hand-both': '#4ec9a0',
            '--scale-in': 'rgba(56, 189, 248, 0.12)',
            '--scale-out': 'rgba(30, 41, 59, 0.3)',
        },
    },
    forest: {
        name: 'Forêt',
        css: {
            '--bg-primary': '#0a120a',
            '--bg-secondary': '#111f11',
            '--bg-tertiary': '#1a2e1a',
            '--bg-elevated': '#1f2e1f',
            '--bg-card': '#152015',
            '--bg-hover': '#253525',
            '--text-primary': '#e8f0e8',
            '--text-secondary': '#9cb09c',
            '--text-tertiary': '#6b8a6b',
            '--text-muted': '#4a6a4a',
            '--text-accent': '#d0e0d0',
            '--accent-primary': '#e8f0e8',
            '--accent-secondary': '#9cb09c',
            '--accent-hover': '#f0f8f0',
            '--accent-success': '#22c55e',
            '--accent-danger': '#ef4444',
            '--accent-warning': '#f59e0b',
            '--accent-info': '#3b82f6',
            '--border-color': '#1e3a1e',
            '--border-light': '#1a2e1a',
            '--border-medium': '#2d4a2d',
            '--border-dark': '#4a6a4a',
            '--border-accent': '#e8f0e8',
            '--hand-left': '#50b870',
            '--hand-left-light': '#70d090',
            '--hand-left-dark': '#38a058',
            '--hand-left-selected': '#90e8b0',
            '--hand-right': '#9870d0',
            '--hand-right-light': '#b090e0',
            '--hand-right-dark': '#7850b0',
            '--hand-right-selected': '#c8b0f0',
            '--hand-both': '#40b8c8',
            '--scale-in': 'rgba(34, 197, 94, 0.12)',
            '--scale-out': 'rgba(26, 46, 26, 0.3)',
        },
    },
    rosegold: {
        name: 'Rose Doré',
        css: {
            '--bg-primary': '#120a0a',
            '--bg-secondary': '#1f1214',
            '--bg-tertiary': '#2e1a1e',
            '--bg-elevated': '#2e1f22',
            '--bg-card': '#201518',
            '--bg-hover': '#3a252a',
            '--text-primary': '#f0e8ea',
            '--text-secondary': '#b09ca0',
            '--text-tertiary': '#8a6b72',
            '--text-muted': '#6a4a52',
            '--text-accent': '#e0d0d5',
            '--accent-primary': '#f0e8ea',
            '--accent-secondary': '#b09ca0',
            '--accent-hover': '#f8f0f2',
            '--accent-success': '#22c55e',
            '--accent-danger': '#ef4444',
            '--accent-warning': '#f59e0b',
            '--accent-info': '#3b82f6',
            '--border-color': '#3a1e24',
            '--border-light': '#2e1a1e',
            '--border-medium': '#4a2d34',
            '--border-dark': '#6a4a52',
            '--border-accent': '#f0e8ea',
            '--hand-left': '#7880d8',
            '--hand-left-light': '#9098e8',
            '--hand-left-dark': '#5860c0',
            '--hand-left-selected': '#b0b8f8',
            '--hand-right': '#d88098',
            '--hand-right-light': '#e8a0b0',
            '--hand-right-dark': '#c06878',
            '--hand-right-selected': '#f0c0d0',
            '--hand-both': '#4ec9a0',
            '--scale-in': 'rgba(244, 114, 182, 0.12)',
            '--scale-out': 'rgba(46, 26, 30, 0.3)',
        },
    },
    ocean: {
        name: 'Océan',
        css: {
            '--bg-primary': '#0a1218',
            '--bg-secondary': '#101e28',
            '--bg-tertiary': '#182838',
            '--bg-elevated': '#1c3040',
            '--bg-card': '#142028',
            '--bg-hover': '#203848',
            '--text-primary': '#e0eef5',
            '--text-secondary': '#90b0c8',
            '--text-tertiary': '#607888',
            '--text-muted': '#405868',
            '--text-accent': '#c0d8e8',
            '--accent-primary': '#e0eef5',
            '--accent-secondary': '#90b0c8',
            '--accent-hover': '#f0f8ff',
            '--accent-success': '#22c55e',
            '--accent-danger': '#ef4444',
            '--accent-warning': '#f59e0b',
            '--accent-info': '#38bdf8',
            '--border-color': '#1e3040',
            '--border-light': '#182838',
            '--border-medium': '#2d4858',
            '--border-dark': '#406070',
            '--border-accent': '#e0eef5',
            '--hand-left': '#48b8c0',
            '--hand-left-light': '#68d0d8',
            '--hand-left-dark': '#30a0a8',
            '--hand-left-selected': '#88e8f0',
            '--hand-right': '#d89050',
            '--hand-right-light': '#e8a868',
            '--hand-right-dark': '#c07838',
            '--hand-right-selected': '#f0c888',
            '--hand-both': '#50b870',
            '--scale-in': 'rgba(72, 184, 192, 0.12)',
            '--scale-out': 'rgba(24, 40, 56, 0.3)',
        },
    },
    twilight: {
        name: 'Crépuscule',
        css: {
            '--bg-primary': '#10081a',
            '--bg-secondary': '#1a1028',
            '--bg-tertiary': '#281838',
            '--bg-elevated': '#2a1e3a',
            '--bg-card': '#1e1228',
            '--bg-hover': '#382848',
            '--text-primary': '#e8e0f0',
            '--text-secondary': '#a898b8',
            '--text-tertiary': '#786888',
            '--text-muted': '#584868',
            '--text-accent': '#d8d0e0',
            '--accent-primary': '#e8e0f0',
            '--accent-secondary': '#a898b8',
            '--accent-hover': '#f5f0fa',
            '--accent-success': '#22c55e',
            '--accent-danger': '#ef4444',
            '--accent-warning': '#f59e0b',
            '--accent-info': '#a78bfa',
            '--border-color': '#281838',
            '--border-light': '#201430',
            '--border-medium': '#382848',
            '--border-dark': '#584868',
            '--border-accent': '#e8e0f0',
            '--hand-left': '#9080c8',
            '--hand-left-light': '#a898d8',
            '--hand-left-dark': '#7868b0',
            '--hand-left-selected': '#c0b0e8',
            '--hand-right': '#d8a060',
            '--hand-right-light': '#e8b878',
            '--hand-right-dark': '#c08848',
            '--hand-right-selected': '#f0d098',
            '--hand-both': '#4ec9a0',
            '--scale-in': 'rgba(144, 128, 200, 0.12)',
            '--scale-out': 'rgba(40, 24, 56, 0.3)',
        },
    },
};

class ThemeService {
    constructor() {
        this._currentTheme = 'forest';
        this._listeners = [];
    }

    init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && THEMES[saved]) {
            this._currentTheme = saved;
        }
        this._applyCSS();
    }

    getThemeName() {
        return this._currentTheme;
    }

    getThemes() {
        return Object.entries(THEMES).map(([key, val]) => ({
            key,
            name: val.name,
            handLeft: val.css['--hand-left'],
            handRight: val.css['--hand-right'],
        }));
    }

    setTheme(name) {
        if (!THEMES[name]) return;
        this._currentTheme = name;
        localStorage.setItem(STORAGE_KEY, name);
        this._applyCSS();
        this._notifyListeners();
    }

    toggleTheme() {
        const keys = Object.keys(THEMES);
        const idx = keys.indexOf(this._currentTheme);
        const next = keys[(idx + 1) % keys.length];
        this.setTheme(next);
    }

    isDark() {
        return this._currentTheme !== 'light';
    }

    // Compatibility API for components that used HandColorsService
    getHandColors(hand) {
        const theme = THEMES[this._currentTheme];
        const prefix = hand === 'left' ? '--hand-left' : '--hand-right';
        return {
            primary: theme.css[prefix],
            light: theme.css[`${prefix}-light`],
            dark: theme.css[`${prefix}-dark`],
            selected: theme.css[`${prefix}-selected`],
        };
    }

    getColors() {
        const theme = THEMES[this._currentTheme];
        return {
            leftHand: this.getHandColors('left'),
            rightHand: this.getHandColors('right'),
            scaleHighlight: {
                inScale: theme.css['--scale-in'],
                outOfScale: theme.css['--scale-out'],
            },
        };
    }

    // For canvas rendering that can't use CSS variables
    getNoteColor(hand, isBlackKey, isSelected) {
        const colors = this.getHandColors(hand === 'left' ? 'left' : 'right');
        if (isSelected) return colors.selected;
        return isBlackKey ? colors.dark : colors.light;
    }

    getPianoRollNoteColor(trackName, isSelected) {
        const hand = trackName === 'melody' ? 'right' : 'left';
        return this.getNoteColor(hand, false, isSelected);
    }

    getScaleHighlightColors() {
        const theme = THEMES[this._currentTheme];
        return {
            inScale: theme.css['--scale-in'],
            outOfScale: theme.css['--scale-out'],
        };
    }

    addListener(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(l => l !== callback);
        };
    }

    _notifyListeners() {
        this._listeners.forEach(cb => cb(this._currentTheme));
    }

    _applyCSS() {
        const theme = THEMES[this._currentTheme];
        const root = document.documentElement;
        Object.entries(theme.css).forEach(([prop, value]) => {
            root.style.setProperty(prop, value);
        });
    }
}

const themeService = new ThemeService();

// Expose for debugging
if (typeof window !== 'undefined') {
    window.ThemeService = themeService;
}

export default themeService;
