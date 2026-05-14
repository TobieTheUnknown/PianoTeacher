# 🎨 Theme Engine - Démarrage Rapide (2 minutes)

Guide ultra-rapide pour personnaliser Piano Teacher en 30 secondes !

## ⚡ Démarrage en 30 Secondes

### 1. Ouvrir la Console
Appuyez sur `F12` ou `Ctrl+Shift+I` pour ouvrir la console du navigateur.

### 2. Essayer un Thème Prédéfini

```javascript
// Bleu mystérieux 🌙
ThemeEngine.applyPreset('midnight-blue')

// Vert naturel 🌲
ThemeEngine.applyPreset('forest-green')

// Rose doré 🌹
ThemeEngine.applyPreset('rose-gold')
```

✨ **C'est fait !** Le thème est appliqué et sauvegardé automatiquement.

---

## 🚀 Commandes Essentielles

```javascript
// Voir tous les thèmes disponibles
ThemeEngine.listPresets()

// Charger un thème depuis un fichier JSON
fetch('/themes/midnight-blue.json')
  .then(r => r.json())
  .then(data => ThemeEngine.applyTheme(data.theme))

// Modifier une couleur spécifique
ThemeEngine.setVariable('accent-primary', '#ff6b9d')

// Exporter votre thème actuel
ThemeEngine.exportTheme('Mon Super Thème')

// Retour au thème par défaut
ThemeEngine.resetToDefault()

// Afficher l'aide complète
ThemeEngine.help()
```

---

## 🎯 Comment Créer un Thème Rapidement

### Méthode 1 : Modifier le Thème Actuel
```javascript
// Changer la couleur principale
ThemeEngine.setVariable('accent-primary', '#ff1493')

// Changer le fond principal
ThemeEngine.setVariable('bg-primary', '#1a0a20')

// Exporter votre création
ThemeEngine.exportTheme('Mon Thème Perso')
```

### Méthode 2 : À partir d'un Thème Existant
```javascript
// 1. Charger un thème de base
ThemeEngine.applyPreset('midnight-blue')

// 2. Le tweaker
ThemeEngine.setVariable('accent-primary', '#00ff00')
ThemeEngine.setVariable('text-accent', '#00cc00')

// 3. Exporter
ThemeEngine.exportTheme('Midnight Green')
```

---

## 📥 Import/Export

### Exporter
```javascript
ThemeEngine.exportTheme('Mon Thème')
// ➜ Télécharge "mon-theme.json"
```

### Importer
```javascript
// Depuis un fichier local
const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.accept = '.json'
fileInput.onchange = (e) => ThemeEngine.importTheme(e.target.files[0])
fileInput.click()

// Depuis une URL
ThemeEngine.loadThemeFromURL('/themes/custom-theme.json')
```

---

## 🎨 Variables CSS Principales

```javascript
// Fonds
'bg-primary'      // Fond principal de l'app
'bg-secondary'    // Fond secondaire
'bg-card'         // Fond des cartes

// Textes
'text-primary'    // Texte principal
'text-secondary'  // Texte secondaire

// Accents
'accent-primary'   // Couleur d'accent principale
'accent-secondary' // Couleur d'accent secondaire
'accent-success'   // Vert pour succès
'accent-danger'    // Rouge pour erreur
'accent-warning'   // Jaune pour avertissement

// Bordures
'border-color'     // Couleur de bordure
'border-light'     // Bordure claire
'border-accent'    // Bordure accentuée
```

---

## 💡 Exemples Rapides

### Thème Violet Profond
```javascript
ThemeEngine.applyPreset('midnight-blue')
ThemeEngine.setVariable('accent-primary', '#9d4edd')
ThemeEngine.setVariable('accent-secondary', '#7b2cbf')
ThemeEngine.setVariable('accent-tertiary', '#5a189a')
ThemeEngine.exportTheme('Deep Purple')
```

### Thème Orange Sunset
```javascript
ThemeEngine.setVariable('accent-primary', '#ff6b35')
ThemeEngine.setVariable('accent-secondary', '#f7931e')
ThemeEngine.setVariable('text-accent', '#ffaa5e')
ThemeEngine.exportTheme('Orange Sunset')
```

### Thème Cyan Moderne
```javascript
ThemeEngine.setVariable('accent-primary', '#00d9ff')
ThemeEngine.setVariable('accent-secondary', '#00b8d4')
ThemeEngine.setVariable('text-accent', '#4dd0e1')
ThemeEngine.exportTheme('Modern Cyan')
```

---

## 🔧 Troubleshooting

**Le thème ne s'applique pas ?**
```javascript
// Vérifier si ThemeEngine est chargé
console.log(ThemeEngine)

// Réinitialiser
ThemeEngine.resetToDefault()
```

**Impossible de revenir en arrière ?**
```javascript
// Toujours sauvegarder avant de modifier
ThemeEngine.exportTheme('Backup')

// Puis réinitialiser
ThemeEngine.resetToDefault()
```

---

## 📚 Pour Aller Plus Loin

Consultez **THEMES.md** pour :
- Documentation complète des 100+ variables CSS
- Exemples de thèmes complexes
- Guide de design avancé
- Théorie des couleurs
- Contraste et accessibilité

---

**Amusez-vous bien ! 🎹✨**
