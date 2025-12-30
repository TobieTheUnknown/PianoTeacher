# 🎨 Piano Teacher - Guide Complet des Thèmes

Documentation complète du système de thèmes personnalisables de Piano Teacher.

## 📑 Table des Matières

1. [Introduction](#introduction)
2. [Démarrage Rapide](#démarrage-rapide)
3. [Variables CSS Disponibles](#variables-css-disponibles)
4. [Utilisation du ThemeEngine](#utilisation-du-themeengine)
5. [Créer un Thème](#créer-un-thème)
6. [Import/Export](#importexport)
7. [Thèmes Prédéfinis](#thèmes-prédéfinis)
8. [Conseils de Design](#conseils-de-design)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

Piano Teacher dispose d'un système de thèmes complet permettant de personnaliser entièrement l'apparence de l'application. Le **ThemeEngine** gère automatiquement :

- ✨ Application et sauvegarde de thèmes
- 💾 Persistance dans localStorage
- 📥 Import/Export de fichiers JSON
- 🎨 Bibliothèque de thèmes prédéfinis
- 🔧 Modification en temps réel

---

## Démarrage Rapide

### Installation
Le ThemeEngine est automatiquement chargé au démarrage de l'application.

### Utilisation Basique
Ouvrez la console du navigateur (`F12`) :

```javascript
// Lister les thèmes disponibles
ThemeEngine.listPresets()

// Appliquer un thème prédéfini
ThemeEngine.applyPreset('midnight-blue')

// Voir l'aide
ThemeEngine.help()
```

---

## Variables CSS Disponibles

### 🎨 Couleurs de Fond (Backgrounds)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `bg-primary` | Fond principal de l'application | `#050811` |
| `bg-secondary` | Fond secondaire, zones de contenu | `#0d1117` |
| `bg-tertiary` | Fond tertiaire, éléments imbriqués | `#161b22` |
| `bg-elevated` | Fond élevé, boutons, etc. | `#1f2937` |
| `bg-card` | Fond des cartes et sections | `#1a1f2e` |

**Utilisation :**
```javascript
ThemeEngine.setVariable('bg-primary', '#1a0a20')
```

---

### 📝 Couleurs de Texte

| Variable | Description | Exemple |
|----------|-------------|---------|
| `text-primary` | Texte principal, titres | `#f8fafc` |
| `text-secondary` | Texte secondaire | `#cbd5e1` |
| `text-tertiary` | Texte tertiaire, labels | `#94a3b8` |
| `text-muted` | Texte discret, placeholders | `#64748b` |
| `text-accent` | Texte accentué | `#818cf8` |

**Conseil :** Assurez un bon contraste avec le fond (ratio minimum 4.5:1).

---

### 🌟 Couleurs d'Accent

| Variable | Description | Usage |
|----------|-------------|-------|
| `accent-primary` | Accent principal | Boutons principaux, liens |
| `accent-secondary` | Accent secondaire | Actions secondaires |
| `accent-tertiary` | Accent tertiaire | Détails |
| `accent-hover` | État hover | Survol interactif |
| `accent-success` | Succès (vert) | Messages de réussite |
| `accent-danger` | Erreur (rouge) | Alertes, suppressions |
| `accent-warning` | Avertissement (jaune) | Warnings |
| `accent-info` | Information (bleu) | Messages info |

**Exemple de palette cohérente :**
```javascript
ThemeEngine.setVariable('accent-primary', '#ff6b9d')
ThemeEngine.setVariable('accent-secondary', '#ff85af')
ThemeEngine.setVariable('accent-hover', '#ff5287')
```

---

### 🪟 Glass Morphism

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `glass-bg` | Fond verre léger | `rgba(255, 255, 255, 0.03)` |
| `glass-bg-strong` | Fond verre fort | `rgba(255, 255, 255, 0.06)` |
| `glass-border` | Bordure verre légère | `rgba(255, 255, 255, 0.08)` |
| `glass-border-strong` | Bordure verre forte | `rgba(255, 255, 255, 0.12)` |

**Note :** Ces valeurs fonctionnent avec `backdrop-filter: blur()` en CSS.

---

### 🔲 Bordures

| Variable | Description | Exemple |
|----------|-------------|---------|
| `border-color` | Bordure standard | `#1f2937` |
| `border-light` | Bordure claire | `#374151` |
| `border-lighter` | Bordure plus claire | `#4b5563` |
| `border-accent` | Bordure accentuée | `rgba(167, 139, 250, 0.25)` |
| `border-accent-strong` | Bordure accent fort | `rgba(167, 139, 250, 0.4)` |

---

## Utilisation du ThemeEngine

### Commandes de Base

```javascript
// Afficher l'aide complète
ThemeEngine.help()

// Lister les thèmes prédéfinis
ThemeEngine.listPresets()
// Retourne: ['midnight-blue', 'forest-green', 'rose-gold']

// Appliquer un thème prédéfini
ThemeEngine.applyPreset('midnight-blue')

// Réinitialiser au thème par défaut
ThemeEngine.resetToDefault()
```

### Modification de Variables

```javascript
// Lire une variable
const primaryColor = ThemeEngine.getVariable('accent-primary')
console.log(primaryColor) // "#a78bfa"

// Modifier une variable
ThemeEngine.setVariable('accent-primary', '#ff6b9d')

// Modifier plusieurs variables
ThemeEngine.setVariable('bg-primary', '#1a0a20')
ThemeEngine.setVariable('accent-primary', '#ff6b9d')
ThemeEngine.setVariable('text-accent', '#ff85af')
```

### Application d'un Thème Complet

```javascript
const monTheme = {
  'bg-primary': '#0a0e1a',
  'bg-secondary': '#0f1421',
  'accent-primary': '#5b7fff',
  'text-primary': '#f0f4ff',
  // ... autres variables
}

ThemeEngine.applyTheme(monTheme)
```

---

## Créer un Thème

### Méthode 1 : Partir de Zéro

```javascript
// 1. Définir les couleurs principales
const monTheme = {
  // Fonds
  'bg-primary': '#0a0a0f',
  'bg-secondary': '#12121a',
  'bg-tertiary': '#1a1a25',
  'bg-elevated': '#22222f',
  'bg-card': '#1e1e2a',

  // Textes
  'text-primary': '#ffffff',
  'text-secondary': '#d0d0d0',
  'text-tertiary': '#a0a0a0',
  'text-muted': '#707070',
  'text-accent': '#8080ff',

  // Accents
  'accent-primary': '#6666ff',
  'accent-secondary': '#5555dd',
  'accent-tertiary': '#4444bb',
  'accent-hover': '#7777ff',
  'accent-success': '#22dd88',
  'accent-danger': '#ff4466',
  'accent-warning': '#ffaa44',
  'accent-info': '#44aaff',

  // Glass
  'glass-bg': 'rgba(255, 255, 255, 0.03)',
  'glass-bg-strong': 'rgba(255, 255, 255, 0.06)',
  'glass-border': 'rgba(102, 102, 255, 0.15)',
  'glass-border-strong': 'rgba(102, 102, 255, 0.25)',

  // Bordures
  'border-color': '#22222f',
  'border-light': '#32323f',
  'border-lighter': '#42424f',
  'border-accent': 'rgba(102, 102, 255, 0.3)',
  'border-accent-strong': 'rgba(102, 102, 255, 0.5)',
}

// 2. Appliquer
ThemeEngine.applyTheme(monTheme)

// 3. Exporter
ThemeEngine.exportTheme('Mon Thème Custom')
```

### Méthode 2 : Modifier un Existant

```javascript
// 1. Charger un thème de base
ThemeEngine.applyPreset('midnight-blue')

// 2. Tweaker les couleurs
ThemeEngine.setVariable('accent-primary', '#00ff88')
ThemeEngine.setVariable('accent-secondary', '#00dd77')
ThemeEngine.setVariable('text-accent', '#00ffaa')

// 3. Exporter
ThemeEngine.exportTheme('Midnight Emerald')
```

---

## Import/Export

### Exporter un Thème

```javascript
// Exporter le thème actuel
ThemeEngine.exportTheme('Mon Super Thème')
// ➜ Télécharge "mon-super-theme.json"
```

Le fichier JSON généré :
```json
{
  "name": "Mon Super Thème",
  "description": "Thème exporté depuis Piano Teacher",
  "author": "Custom",
  "version": "1.0.0",
  "createdAt": "2024-12-24T12:00:00.000Z",
  "theme": {
    "bg-primary": "#0a0e1a",
    "bg-secondary": "#0f1421",
    "accent-primary": "#5b7fff",
    ...
  }
}
```

### Importer un Thème

#### Depuis un Fichier Local
```javascript
// Créer un input file
const input = document.createElement('input')
input.type = 'file'
input.accept = '.json'
input.onchange = (e) => {
  ThemeEngine.importTheme(e.target.files[0])
}
input.click()
```

#### Depuis une URL
```javascript
// Charger depuis le dossier /themes
ThemeEngine.loadThemeFromURL('/themes/midnight-blue.json')

// Ou depuis n'importe quelle URL
fetch('https://example.com/my-theme.json')
  .then(r => r.json())
  .then(data => ThemeEngine.applyTheme(data.theme))
```

---

## Thèmes Prédéfinis

### 🌙 Midnight Blue
Bleu profond élégant et mystérieux.

```javascript
ThemeEngine.applyPreset('midnight-blue')
```

**Palette :**
- Primary: `#5b7fff` (Bleu royal)
- Success: `#20c997` (Vert menthe)
- Backgrounds: Tons de bleu très foncés

**Idéal pour :** Ambiance nocturne, concentration

---

### 🌲 Forest Green
Vert naturel apaisant et serein.

```javascript
ThemeEngine.applyPreset('forest-green')
```

**Palette :**
- Primary: `#4ecb7f` (Vert émeraude)
- Success: `#34d399` (Vert succès)
- Backgrounds: Tons de vert très foncés

**Idéal pour :** Détente, calme, nature

---

### 🌹 Rose Gold
Rose doré chaleureux et élégant.

```javascript
ThemeEngine.applyPreset('rose-gold')
```

**Palette :**
- Primary: `#e88ab0` (Rose doré)
- Accent: `#ff9fbf` (Rose clair)
- Backgrounds: Tons de rose très foncés

**Idéal pour :** Élégance, douceur, chaleur

---

## Conseils de Design

### 🎨 Théorie des Couleurs

#### Harmonies Recommandées

**Monochrome**
- Utilisez différentes nuances d'une même couleur
- Exemple : Bleu foncé → Bleu → Bleu clair

**Analogues**
- Couleurs adjacentes sur le cercle chromatique
- Exemple : Bleu → Bleu-vert → Vert

**Complémentaires**
- Couleurs opposées sur le cercle
- Exemple : Bleu ↔ Orange

**Triadique**
- 3 couleurs équidistantes
- Exemple : Rouge, Jaune, Bleu

### ✅ Contraste et Accessibilité

**Ratio de Contraste Minimum** (WCAG)
- Texte normal : **4.5:1**
- Texte large : **3:1**

**Vérifier le contraste :**
```javascript
// Utilisez un outil en ligne comme :
// https://webaim.org/resources/contrastchecker/
```

**Bonnes Pratiques :**
- `text-primary` doit avoir un bon contraste avec `bg-primary`
- `accent-primary` doit être lisible sur `bg-card`
- Testez avec des personnes dalton iennes

### 💡 Conseils Pratiques

1. **Hiérarchie Visuelle**
   - Utilisez `accent-primary` pour les actions principales
   - `accent-secondary` pour les actions secondaires
   - Ne surchargez pas d'accents différents

2. **Cohérence**
   - Gardez une palette limitée (3-5 couleurs principales)
   - Utilisez des nuances cohérentes

3. **Feedback Visuel**
   - `accent-success` : Vert pour confirmations
   - `accent-danger` : Rouge pour suppressions/erreurs
   - `accent-warning` : Jaune pour avertissements

4. **Espacement**
   - Les fonds (`bg-*`) doivent avoir une progression subtile
   - Ne pas sauter trop de luminosité entre les niveaux

---

## Troubleshooting

### Le thème ne s'applique pas

**Vérification :**
```javascript
// 1. Vérifier que ThemeEngine est chargé
console.log(ThemeEngine)

// 2. Vérifier la structure du thème
console.log(ThemeEngine.currentTheme)

// 3. Réinitialiser si nécessaire
ThemeEngine.resetToDefault()
```

### Les couleurs semblent incorrectes

**Causes possibles :**
- Format de couleur invalide (utilisez HEX ou RGB/RGBA)
- Valeurs RGBA mal formées

**Solution :**
```javascript
// ✅ Bon
ThemeEngine.setVariable('accent-primary', '#ff6b9d')
ThemeEngine.setVariable('glass-bg', 'rgba(255, 255, 255, 0.05)')

// ❌ Mauvais
ThemeEngine.setVariable('accent-primary', 'red')
ThemeEngine.setVariable('glass-bg', 'rgba(255,255,255,.05)') // espaces manquants
```

### Le thème ne se sauvegarde pas

**Vérifiez localStorage :**
```javascript
// Taille utilisée
const size = JSON.stringify(localStorage).length
console.log(`LocalStorage utilise ${size} octets`)

// Nettoyer si nécessaire
localStorage.clear()
ThemeEngine.init()
```

### Impossible de revenir en arrière

**Sauvegardez toujours avant de modifier :**
```javascript
// Avant toute modification importante
ThemeEngine.exportTheme('Backup')

// Puis modifiez
ThemeEngine.setVariable('accent-primary', '#ff0000')

// Si problème, réinitialisez
ThemeEngine.resetToDefault()
```

---

## Exemples de Thèmes Avancés

### Cyberpunk Neon
```javascript
const cyberpunk = {
  'bg-primary': '#0a0014',
  'bg-secondary': '#14001e',
  'bg-tertiary': '#1e0028',
  'bg-elevated': '#280032',
  'bg-card': '#22002a',
  'text-primary': '#f0f0ff',
  'text-secondary': '#d0d0ff',
  'text-tertiary': '#b0b0ff',
  'text-muted': '#9090cc',
  'text-accent': '#ff00ff',
  'accent-primary': '#ff00ff',
  'accent-secondary': '#cc00ff',
  'accent-tertiary': '#9900ff',
  'accent-hover': '#ff33ff',
  'accent-success': '#00ff99',
  'accent-danger': '#ff0066',
  'accent-warning': '#ffcc00',
  'accent-info': '#00ccff',
  'glass-bg': 'rgba(255, 0, 255, 0.05)',
  'glass-bg-strong': 'rgba(255, 0, 255, 0.1)',
  'glass-border': 'rgba(255, 0, 255, 0.2)',
  'glass-border-strong': 'rgba(255, 0, 255, 0.3)',
  'border-color': '#280032',
  'border-light': '#38004a',
  'border-lighter': '#48005c',
  'border-accent': 'rgba(255, 0, 255, 0.4)',
  'border-accent-strong': 'rgba(255, 0, 255, 0.6)',
}

ThemeEngine.applyTheme(cyberpunk)
ThemeEngine.exportTheme('Cyberpunk Neon')
```

### Ocean Deep
```javascript
const ocean = {
  'bg-primary': '#001a1a',
  'bg-secondary': '#002828',
  'bg-tertiary': '#003636',
  'bg-elevated': '#004444',
  'bg-card': '#003a3a',
  'text-primary': '#e6ffff',
  'text-secondary': '#b3f0f0',
  'text-tertiary': '#80e0e0',
  'text-muted': '#60b0b0',
  'text-accent': '#00d9ff',
  'accent-primary': '#00b8d4',
  'accent-secondary': '#0097a7',
  'accent-tertiary': '#00838f',
  'accent-hover': '#00cfe1',
  'accent-success': '#26c6da',
  'accent-danger': '#ff5252',
  'accent-warning': '#ffab40',
  'accent-info': '#448aff',
  'glass-bg': 'rgba(0, 216, 255, 0.05)',
  'glass-bg-strong': 'rgba(0, 216, 255, 0.1)',
  'glass-border': 'rgba(0, 184, 212, 0.2)',
  'glass-border-strong': 'rgba(0, 184, 212, 0.3)',
  'border-color': '#004444',
  'border-light': '#005555',
  'border-lighter': '#006666',
  'border-accent': 'rgba(0, 184, 212, 0.4)',
  'border-accent-strong': 'rgba(0, 184, 212, 0.6)',
}

ThemeEngine.applyTheme(ocean)
ThemeEngine.exportTheme('Ocean Deep')
```

---

## API Complète

### Méthodes Disponibles

```javascript
// Gestion de thèmes
ThemeEngine.applyTheme(theme)           // Applique un objet thème
ThemeEngine.applyPreset(name)           // Applique un preset
ThemeEngine.resetToDefault()            // Réinitialise
ThemeEngine.getPresetThemes()           // Récupère tous les presets
ThemeEngine.listPresets()               // Liste les noms

// Variables
ThemeEngine.getVariable(name)           // Lit une variable
ThemeEngine.setVariable(name, value)    // Modifie une variable

// Import/Export
ThemeEngine.exportTheme(name)           // Exporte en JSON
ThemeEngine.importTheme(file)           // Importe depuis fichier
ThemeEngine.loadThemeFromURL(url)       // Charge depuis URL

// Utilitaires
ThemeEngine.init()                      // Initialise au démarrage
ThemeEngine.help()                      // Affiche l'aide
ThemeEngine.getDefaultTheme()           // Récupère le thème par défaut
ThemeEngine.currentTheme                // Thème actuel (propriété)
```

---

## Ressources Additionnelles

### Outils de Couleurs

- [Coolors](https://coolors.co/) - Générateur de palettes
- [Adobe Color](https://color.adobe.com/) - Roue chromatique
- [Paletton](https://paletton.com/) - Schémas de couleurs
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Vérificateur de contraste

### Inspiration

- [Dribbble](https://dribbble.com/) - Designs UI
- [Behance](https://www.behance.net/) - Projets créatifs
- [UI Gradients](https://uigradients.com/) - Gradients CSS

---

**Fait avec 🎨 pour Piano Teacher**

Pour un guide rapide en 2 minutes, consultez **THEME_QUICK_START.md** !
