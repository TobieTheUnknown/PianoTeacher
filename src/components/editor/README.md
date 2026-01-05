# Éditeur Avancé - Piano App

Éditeur de piano roll enrichi avec des fonctionnalités professionnelles pour la composition musicale.

## 🚀 Fonctionnalités

### 🎹 Enregistrement MIDI
- **Enregistrement en temps réel** : Capturez vos performances MIDI directement depuis un clavier externe
- **Compte à rebours** : Pre-roll configurable (1-4 mesures) pour vous préparer
- **Quantization automatique** : Alignement précis sur la grille rythmique (1/4, 1/8, 1/16, 1/32)
- **Métronome intégré** : Click audio pendant l'enregistrement pour garder le tempo
- **Auto-stop** : L'enregistrement s'arrête automatiquement à la fin de la phrase

### ✂️ Sélection et Manipulation de Notes
- **Sélection simple** : Cliquez sur une note pour la sélectionner
- **Multi-sélection** : Maintenez Ctrl/Cmd pour sélectionner plusieurs notes
- **Sélection rectangle** : Glissez sur une zone vide pour sélectionner toutes les notes dans la zone
- **Déplacement groupé** : Toutes les notes sélectionnées se déplacent ensemble
- **Redimensionnement** : Ajustez la durée de toutes les notes sélectionnées simultanément

### 📋 Opérations Clipboard
- **Copier** (Ctrl+C) : Copie les notes sélectionnées dans le presse-papiers
- **Couper** (Ctrl+X) : Coupe les notes sélectionnées
- **Coller** (Ctrl+V) : Colle les notes depuis le presse-papiers
- **Dupliquer** (Ctrl+D) : Duplique les notes sélectionnées à la mesure suivante
- **Sélectionner tout** (Ctrl+A) : Sélectionne toutes les notes de la phrase
- **Supprimer** (Delete/Backspace) : Supprime les notes sélectionnées

### 🎨 Aides à la Composition
- **Surbrillance de gamme** : Les touches de la gamme sont mises en évidence visuellement
- **Indicateur de gamme** : Voir immédiatement quelles notes appartiennent à la tonalité
- **Grille rythmique** : Visualisation claire des temps et mesures
- **Magnétisme** : Snap-to-grid optionnel pour un alignement précis

### 🔧 Outils d'Édition
- **Zoom dynamique** : De 50% à 300% pour une vision précise ou d'ensemble
- **Grille configurable** : Choisissez la résolution rythmique (1/4, 1/8, 1/16, 1/32)
- **Scroll fluide** : Navigation fluide dans la phrase
- **Mode plein écran** : Concentrez-vous sur l'édition sans distraction

## 📁 Architecture

```
src/components/editor/
├── AdvancedPianoRoll.jsx    # Composant principal (lazy-loaded)
├── MidiRecorder.jsx          # Interface d'enregistrement MIDI
└── README.md                 # Documentation

src/hooks/
├── useMidiRecording.js       # Logique d'enregistrement MIDI
├── useNoteSelection.js       # Gestion de la sélection de notes
├── useScaleContext.js        # Analyse de gamme et tonalité
└── useEditorHistory.js       # Undo/Redo (préparé pour futur)
```

## 🎯 Utilisation

### Activer l'éditeur avancé
1. Dans l'éditeur de morceau, allez à une phrase
2. Cliquez sur le bouton "⤢ Plein écran"
3. L'éditeur avancé se charge automatiquement

### Enregistrer des notes MIDI
1. Connectez votre clavier MIDI via les paramètres
2. Dans l'éditeur avancé, configurez :
   - Quantification (précision rythmique)
   - Compte à rebours (optionnel)
3. Cliquez sur "● Enregistrer"
4. Jouez votre performance
5. Cliquez sur "■ Arrêter" quand terminé

### Éditer des notes
1. **Ajouter** : Cliquez sur une case vide
2. **Supprimer** : Cliquez sur une note existante
3. **Déplacer** : Glissez une note
4. **Redimensionner** : Glissez le bord droit d'une note
5. **Sélection multiple** : Maintenez Ctrl et cliquez, ou glissez une zone

### Raccourcis clavier
| Raccourci | Action |
|-----------|--------|
| **Ctrl+A** | Tout sélectionner |
| **Ctrl+C** | Copier |
| **Ctrl+X** | Couper |
| **Ctrl+V** | Coller |
| **Ctrl+D** | Dupliquer |
| **Delete** | Supprimer |
| **Échap** | Fermer / Désélectionner |

## ⚡ Optimisations

### Lazy Loading
L'éditeur avancé n'est chargé que lorsqu'on active le mode plein écran, réduisant ainsi :
- Temps de chargement initial de la page
- Utilisation de la mémoire
- Impact sur les performances de Synthesia

### Performance
- Rendu optimisé avec React.memo (prévu)
- Debouncing des événements de drag
- Virtualisation du piano roll pour les grandes phrases (prévu)

## 🔮 Fonctionnalités Futures

Les hooks suivants sont déjà implémentés et prêts à être intégrés :

### Undo/Redo (useEditorHistory)
- Historique des actions avec Ctrl+Z / Ctrl+Y
- Limite configurable d'historique (50 actions par défaut)

### Vue Multi-Phrases
- Affichage continu de plusieurs phrases
- Navigation fluide entre phrases
- Édition sans quitter le mode fullscreen

### Humanisation
- Randomisation légère du timing
- Variation de vélocité pour un effet naturel

### Éditeur de Vélocité
- Visualisation graphique de la vélocité
- Édition par note ou par groupe

## 📝 Notes Techniques

### Quantization
La quantization fonctionne en arrondissant les timestamps au multiple le plus proche de la grille :
```javascript
quantizedTime = round(time / gridSize) * gridSize
```

### Snap to Grid
Appliqué lors de :
- Ajout de nouvelles notes
- Déplacement de notes
- Enregistrement MIDI

Peut être désactivé pour un contrôle manuel précis.

### Détection de Gamme
Utilise l'algorithme Krumhansl-Schmuckler pour détecter automatiquement la tonalité lors de l'import MIDI, puis surligne les notes correspondantes dans le piano roll.
