/**
 * 🎨 Piano Teacher Theme Engine
 *
 * Système complet de gestion de thèmes
 * - Import/Export de thèmes JSON
 * - Sauvegarde automatique dans localStorage
 * - Bibliothèque de thèmes prédéfinis
 * - Application dynamique de variables CSS
 */

class ThemeEngine {
    constructor() {
        this.STORAGE_KEY = 'piano-teacher-theme';
        this.currentTheme = null;
        this.defaultTheme = null; // Lazy-loaded
    }

    /**
     * Récupère le thème par défaut depuis les variables CSS actuelles
     * Lazily computed to avoid calling getComputedStyle before CSS is loaded
     */
    getDefaultTheme() {
        if (this.defaultTheme) return this.defaultTheme;

        try {
            const root = document.documentElement;
            const style = getComputedStyle(root);

            this.defaultTheme = {
                name: 'Piano Teacher Default',
                description: 'Thème sombre premium par défaut',
                author: 'Piano Teacher',
                version: '1.0.0',
                theme: {
                    // Backgrounds
                    'bg-primary': style.getPropertyValue('--bg-primary').trim() || '#0a0a0a',
                    'bg-secondary': style.getPropertyValue('--bg-secondary').trim() || '#141414',
                    'bg-tertiary': style.getPropertyValue('--bg-tertiary').trim() || '#1a1a1a',
                    'bg-elevated': style.getPropertyValue('--bg-elevated').trim() || '#1f1f1f',
                    'bg-card': style.getPropertyValue('--bg-card').trim() || '#171717',

                    // Text Colors
                    'text-primary': style.getPropertyValue('--text-primary').trim() || '#f5f5f5',
                    'text-secondary': style.getPropertyValue('--text-secondary').trim() || '#a3a3a3',
                    'text-tertiary': style.getPropertyValue('--text-tertiary').trim() || '#737373',
                    'text-muted': style.getPropertyValue('--text-muted').trim() || '#525252',
                    'text-accent': style.getPropertyValue('--text-accent').trim() || '#e5e5e5',

                    // Accent Colors
                    'accent-primary': style.getPropertyValue('--accent-primary').trim() || '#f5f5f5',
                    'accent-secondary': style.getPropertyValue('--accent-secondary').trim() || '#a3a3a3',
                    'accent-tertiary': style.getPropertyValue('--accent-tertiary').trim() || '',
                    'accent-hover': style.getPropertyValue('--accent-hover').trim() || '#ffffff',
                    'accent-success': style.getPropertyValue('--accent-success').trim() || '#22c55e',
                    'accent-danger': style.getPropertyValue('--accent-danger').trim() || '#ef4444',
                    'accent-warning': style.getPropertyValue('--accent-warning').trim() || '#f59e0b',
                    'accent-info': style.getPropertyValue('--accent-info').trim() || '#3b82f6',

                    // Glass Morphism
                    'glass-bg': style.getPropertyValue('--glass-bg').trim() || '',
                    'glass-bg-strong': style.getPropertyValue('--glass-bg-strong').trim() || '',
                    'glass-border': style.getPropertyValue('--glass-border').trim() || '',
                    'glass-border-strong': style.getPropertyValue('--glass-border-strong').trim() || '',

                    // Borders
                    'border-color': style.getPropertyValue('--border-color').trim() || '#262626',
                    'border-light': style.getPropertyValue('--border-light').trim() || '#1f1f1f',
                    'border-lighter': style.getPropertyValue('--border-lighter').trim() || '',
                    'border-accent': style.getPropertyValue('--border-accent').trim() || '#f5f5f5',
                    'border-accent-strong': style.getPropertyValue('--border-accent-strong').trim() || '',
                }
            };
        } catch (err) {
            console.debug('ThemeEngine: getComputedStyle not available yet, using hardcoded defaults');
            this.defaultTheme = {
                name: 'Piano Teacher Default',
                description: 'Thème sombre premium par défaut',
                author: 'Piano Teacher',
                version: '1.0.0',
                theme: {}
            };
        }

        return this.defaultTheme;
    }

    /**
     * Applique un thème (variables CSS uniquement, pas les gradients/ombres)
     */
    applyTheme(theme) {
        const root = document.documentElement;

        Object.entries(theme).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
        });

        this.currentTheme = theme;
        this.saveToLocalStorage(theme);

        console.log('✅ Thème appliqué avec succès !');
        return true;
    }

    /**
     * Réinitialise au thème par défaut
     */
    resetToDefault() {
        const defaults = this.getDefaultTheme();
        this.applyTheme(defaults.theme);
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🔄 Thème réinitialisé au défaut');
    }

    /**
     * Charge un thème depuis localStorage au démarrage
     */
    loadSavedTheme() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const theme = JSON.parse(saved);
                this.applyTheme(theme);
                console.log('📂 Thème chargé depuis localStorage');
                return true;
            }
        } catch (error) {
            console.error('❌ Erreur lors du chargement du thème:', error);
        }
        return false;
    }

    /**
     * Sauvegarde le thème actuel dans localStorage
     */
    saveToLocalStorage(theme) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(theme));
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde du thème:', error);
        }
    }

    /**
     * Exporte le thème actuel vers un fichier JSON
     */
    exportTheme(themeName = 'Custom Theme') {
        const themeData = {
            name: themeName,
            description: 'Thème exporté depuis Piano Teacher',
            author: 'Custom',
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            theme: this.currentTheme || this.getDefaultTheme().theme
        };

        const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${themeName.toLowerCase().replace(/\s+/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('📥 Thème exporté:', themeName);
    }

    /**
     * Importe un thème depuis un fichier JSON
     */
    async importTheme(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const themeData = JSON.parse(e.target.result);

                    if (!themeData.theme) {
                        reject(new Error('Format de thème invalide'));
                        return;
                    }

                    this.applyTheme(themeData.theme);
                    console.log('📤 Thème importé:', themeData.name);
                    resolve(themeData);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
            reader.readAsText(file);
        });
    }

    /**
     * Charge un thème depuis une URL
     */
    async loadThemeFromURL(url) {
        try {
            const response = await fetch(url);
            const themeData = await response.json();

            if (!themeData.theme) {
                throw new Error('Format de thème invalide');
            }

            this.applyTheme(themeData.theme);
            console.log('🌐 Thème chargé depuis URL:', themeData.name);
            return themeData;
        } catch (error) {
            console.error('❌ Erreur lors du chargement du thème:', error);
            throw error;
        }
    }

    /**
     * Récupère une variable CSS du thème actuel
     */
    getVariable(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    }

    /**
     * Modifie une variable CSS spécifique
     */
    setVariable(name, value) {
        document.documentElement.style.setProperty(`--${name}`, value);

        if (this.currentTheme) {
            this.currentTheme[name] = value;
            this.saveToLocalStorage(this.currentTheme);
        }
    }

    /**
     * Bibliothèque de thèmes prédéfinis
     */
    getPresetThemes() {
        return {
            'midnight-blue': {
                name: 'Midnight Blue',
                description: 'Bleu profond élégant et mystérieux',
                author: 'Piano Teacher',
                version: '1.0.0',
                theme: {
                    'bg-primary': '#0a0e1a',
                    'bg-secondary': '#0f1421',
                    'bg-tertiary': '#141a2b',
                    'bg-elevated': '#1a2438',
                    'bg-card': '#162032',
                    'text-primary': '#f0f4ff',
                    'text-secondary': '#c5d1ed',
                    'text-tertiary': '#8fa3cc',
                    'text-muted': '#6b7fa3',
                    'text-accent': '#6b8cff',
                    'accent-primary': '#5b7fff',
                    'accent-secondary': '#4169e1',
                    'accent-tertiary': '#1e90ff',
                    'accent-hover': '#4a6fdb',
                    'accent-success': '#20c997',
                    'accent-danger': '#ff6b7a',
                    'accent-warning': '#ffc107',
                    'accent-info': '#17a2b8',
                    'glass-bg': 'rgba(255, 255, 255, 0.03)',
                    'glass-bg-strong': 'rgba(255, 255, 255, 0.06)',
                    'glass-border': 'rgba(91, 127, 255, 0.15)',
                    'glass-border-strong': 'rgba(91, 127, 255, 0.25)',
                    'border-color': '#1a2438',
                    'border-light': '#2a3854',
                    'border-lighter': '#3a4864',
                    'border-accent': 'rgba(91, 127, 255, 0.3)',
                    'border-accent-strong': 'rgba(91, 127, 255, 0.5)',
                }
            },
            'forest-green': {
                name: 'Forest Green',
                description: 'Vert naturel apaisant et serein',
                author: 'Piano Teacher',
                version: '1.0.0',
                theme: {
                    'bg-primary': '#0a1410',
                    'bg-secondary': '#0f1a16',
                    'bg-tertiary': '#14241d',
                    'bg-elevated': '#1a3028',
                    'bg-card': '#162a22',
                    'text-primary': '#f0fff5',
                    'text-secondary': '#c5edd8',
                    'text-tertiary': '#8fcca8',
                    'text-muted': '#6ba387',
                    'text-accent': '#5fcc8f',
                    'accent-primary': '#4ecb7f',
                    'accent-secondary': '#3cb371',
                    'accent-tertiary': '#2e8b57',
                    'accent-hover': '#42b36e',
                    'accent-success': '#34d399',
                    'accent-danger': '#ff6b7a',
                    'accent-warning': '#f4b860',
                    'accent-info': '#4fc9da',
                    'glass-bg': 'rgba(255, 255, 255, 0.03)',
                    'glass-bg-strong': 'rgba(255, 255, 255, 0.06)',
                    'glass-border': 'rgba(78, 203, 127, 0.15)',
                    'glass-border-strong': 'rgba(78, 203, 127, 0.25)',
                    'border-color': '#1a3028',
                    'border-light': '#2a4038',
                    'border-lighter': '#3a5048',
                    'border-accent': 'rgba(78, 203, 127, 0.3)',
                    'border-accent-strong': 'rgba(78, 203, 127, 0.5)',
                }
            },
            'rose-gold': {
                name: 'Rose Gold',
                description: 'Rose doré chaleureux et élégant',
                author: 'Piano Teacher',
                version: '1.0.0',
                theme: {
                    'bg-primary': '#1a0e12',
                    'bg-secondary': '#211419',
                    'bg-tertiary': '#2b1a21',
                    'bg-elevated': '#382430',
                    'bg-card': '#322028',
                    'text-primary': '#fff0f5',
                    'text-secondary': '#edd8e0',
                    'text-tertiary': '#ccb3bc',
                    'text-muted': '#a38793',
                    'text-accent': '#ff9fbf',
                    'accent-primary': '#e88ab0',
                    'accent-secondary': '#d4739f',
                    'accent-tertiary': '#c2608e',
                    'accent-hover': '#db7fa5',
                    'accent-success': '#34d399',
                    'accent-danger': '#ff6b7a',
                    'accent-warning': '#ffc870',
                    'accent-info': '#8fb4ff',
                    'glass-bg': 'rgba(255, 255, 255, 0.03)',
                    'glass-bg-strong': 'rgba(255, 255, 255, 0.06)',
                    'glass-border': 'rgba(232, 138, 176, 0.15)',
                    'glass-border-strong': 'rgba(232, 138, 176, 0.25)',
                    'border-color': '#382430',
                    'border-light': '#483440',
                    'border-lighter': '#584450',
                    'border-accent': 'rgba(232, 138, 176, 0.3)',
                    'border-accent-strong': 'rgba(232, 138, 176, 0.5)',
                }
            }
        };
    }

    /**
     * Applique un thème prédéfini par son nom
     */
    applyPreset(presetName) {
        const presets = this.getPresetThemes();
        const preset = presets[presetName];

        if (!preset) {
            console.error('❌ Thème prédéfini introuvable:', presetName);
            return false;
        }

        this.applyTheme(preset.theme);
        console.log(`✨ Thème "${preset.name}" appliqué`);
        return true;
    }

    /**
     * Liste tous les thèmes prédéfinis disponibles
     */
    listPresets() {
        const presets = this.getPresetThemes();
        console.log('📚 Thèmes prédéfinis disponibles:');
        Object.entries(presets).forEach(([key, theme]) => {
            console.log(`  - ${key}: ${theme.name} - ${theme.description}`);
        });
        return Object.keys(presets);
    }

    /**
     * Initialisation automatique
     */
    init() {
        // Charger le thème sauvegardé ou utiliser le défaut
        const loaded = this.loadSavedTheme();

        if (!loaded) {
            this.currentTheme = this.getDefaultTheme().theme;
        }

        console.log('🎨 Theme Engine initialisé');
        console.log('💡 Tapez ThemeEngine.help() pour voir les commandes disponibles');
    }

    /**
     * Aide - Liste toutes les commandes disponibles
     */
    help() {
        console.log(`
🎨 Piano Teacher Theme Engine - Commandes Disponibles
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 THÈMES PRÉDÉFINIS:
  ThemeEngine.listPresets()                    - Liste tous les thèmes disponibles
  ThemeEngine.applyPreset('midnight-blue')     - Applique un thème prédéfini
  ThemeEngine.applyPreset('forest-green')      - Thème vert naturel
  ThemeEngine.applyPreset('rose-gold')         - Thème rose doré

🔧 PERSONNALISATION:
  ThemeEngine.setVariable('accent-primary', '#ff6b9d')  - Modifie une couleur
  ThemeEngine.getVariable('bg-primary')                 - Récupère une valeur

💾 IMPORT/EXPORT:
  ThemeEngine.exportTheme('Mon Thème')         - Exporte le thème actuel en JSON
  ThemeEngine.importTheme(file)                - Importe depuis un fichier
  ThemeEngine.loadThemeFromURL('/themes/midnight-blue.json')  - Charge depuis URL

🔄 GESTION:
  ThemeEngine.resetToDefault()                 - Retour au thème par défaut
  ThemeEngine.currentTheme                     - Voir le thème actuel

💡 EXEMPLE RAPIDE:
  // Charger un thème depuis un fichier
  fetch('/themes/midnight-blue.json')
    .then(r => r.json())
    .then(data => ThemeEngine.applyTheme(data.theme));

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
    }
}

// Créer et exporter une instance unique
const themeEngine = new ThemeEngine();

// Exposer globalement pour la console
if (typeof window !== 'undefined') {
    window.ThemeEngine = themeEngine;
}

export default themeEngine;
