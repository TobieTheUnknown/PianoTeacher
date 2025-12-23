# 🎹 Piano Teacher

**Version 1.0.0**

Piano Teacher est une application web interactive d'apprentissage du piano qui transforme vos fichiers MIDI en outils pédagogiques visuels et interactifs.

![Piano Teacher Dashboard](docs/screenshots/library.png)

## ✨ Fonctionnalités

### 📚 Bibliothèque de Morceaux (Dashboard)
- Interface moderne avec **Glassmorphism** et effets de surbrillance
- Gestion complète : créer, importer, et supprimer des morceaux
- Affichage des métadonnées (tonalité, tempo, nombre de mesures)
- Persistance locale sécurisée

### ✏️ Éditeur (Piano Roll)
- **Import MIDI intelligent** : Conversion automatique des fichiers `.mid` en séquences de notes
- **Séparation MG/MD** : Algorithme de séparation automatique basé sur le pitch pour isoler la main gauche et la main droite
- **Édition de phrases** : Découpage du morceau en sections d'apprentissage (Intro, Refrain, etc.)
- **Interaction temps réel** : Visualisation claire sur une grille de piano roll professionnelle

![Éditeur](docs/screenshots/editor_new.png)

### 📖 Apprentissage (Vue d'Ensemble)
- **Progression visuelle** : Vue mosaïque de toutes les mesures du morceau
- **Analyse harmonique** : Détection des accords et de la complexité mélodique par mesure
- **Filtrage par main** : Choisissez de travailler la Main Gauche, la Main Droite ou les deux
- **Surlignage intelligent** : Marquez les mesures à retravailler, sauvegardé automatiquement
- **Affichage et lecture par mesure** : Cliquez sur n'importe quelle mesure pour l'écouter individuellement et l'étudier en détail

![Apprentissage Vue d'Ensemble](docs/screenshots/learning_new.png)

### 🎹 Mode Synthesia
- **Immersion totale** : Visualisation des notes tombantes vers un clavier virtuel
- **Code couleur dynamique** : Bleu pour la main droite, Rose pour la main gauche
- **Contrôle du tempo** : Ralentissez la lecture pour apprendre à votre rythme
- **Suivi de précision** : Statistiques en temps réel sur les notes jouées et manquées

![Mode Synthesia](docs/screenshots/synthesia.png)

## 🚀 Installation

### Prérequis

#### 1. Installer Node.js & NPM
Node.js est le moteur qui permet de faire tourner l'application. NPM (installé avec Node.js) gère les bibliothèques nécessaires.
- **Téléchargement** : Allez sur [nodejs.org](https://nodejs.org/) et téléchargez la version **LTS** (recommandée).
- **Vérification** : Ouvrez un terminal et tapez `node -v` pour confirmer l'installation.

#### 2. Installer Git
Git est nécessaire pour télécharger ("cloner") le code du projet.
- **Windows** : Téléchargez et installez [git-scm.com](https://git-scm.com/).
- **macOS** : Tapez `git --version` dans votre terminal. Si non présent, le Launchpad vous proposera de l'installer.
- **Linux** : Utilisez votre gestionnaire de paquets (ex: `sudo apt install git`).

### Installation locale

```bash
# Cloner le repository
git clone https://github.com/TobieTheUnknown/Piano.git
cd Piano

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### Build de production

```bash
# Créer le build
npm run build

# Prévisualiser le build
npm run preview
```

## 📖 Utilisation

### 1. Créer un nouveau morceau
1. Cliquez sur "➕ Nouveau Morceau" dans la bibliothèque
2. Entrez le titre, l'artiste, la tonalité et le tempo
3. Importez un fichier MIDI ou créez manuellement vos phrases

### 2. Importer un fichier MIDI
1. Dans l'éditeur, cliquez sur "📁 Importer MIDI"
2. Sélectionnez votre fichier `.mid`
3. L'application détecte automatiquement :
   - La tonalité
   - Le tempo
   - Les notes de mélodie (main droite)
   - Les accords (main gauche)

### 3. Organiser en phrases
1. Ajoutez des sections : Intro, Couplet, Refrain, etc.
2. Chaque phrase affiche ses mesures avec mélodie et accords
3. Modifiez, ajoutez ou supprimez des notes selon vos besoins

### 4. Pratiquer
- **Apprentissage** : Mode détaillé pour travailler mesure par mesure avec lecture audio
- **Live Learning** : Vue d'ensemble pour planifier votre pratique et identifier les passages difficiles

## 🏗️ Architecture du Projet

```
Piano/
├── public/               # Fichiers statiques
│   └── midi/            # Fichiers MIDI d'exemple
├── src/
│   ├── components/      # Composants React
│   │   ├── Layout.jsx           # Structure principale
│   │   ├── SongLibrary.jsx      # Bibliothèque
│   │   ├── SongEditor.jsx       # Éditeur
│   │   ├── SongViewer.jsx       # Vue Apprentissage
│   │   └── LiveLearning.jsx     # Vue Live Learning
│   ├── models/          # Modèles de données
│   │   └── song.js              # Structure Song/Phrase/Note
│   ├── services/        # Services métier
│   │   ├── MidiService.js       # Parser MIDI
│   │   ├── StorageService.js    # Persistance localStorage
│   │   └── audioEngine.js       # Lecture audio (Tone.js)
│   ├── useSong.js       # Hook custom de gestion d'état
│   ├── App.jsx          # Composant racine
│   ├── main.jsx         # Point d'entrée
│   └── index.css        # Styles globaux
├── package.json
├── vite.config.js
└── README.md
```

## 🛠️ Technologies Utilisées

### Frontend
- **React 19** - Framework UI
- **Vite** - Build tool et dev server

### Audio & MIDI
- **Tone.js** - Synthèse audio et lecture
- **@tonejs/midi** - Parser de fichiers MIDI

### Stockage
- **LocalStorage API** - Persistance navigateur

### Styling
- **CSS moderne** - Variables CSS, Grid, Flexbox
- **Design responsive** - Adapté desktop et mobile

## 🎨 Fonctionnalités Techniques

### Parsing MIDI Intelligent
- Détection automatique de la tonalité par analyse des altérations
- Séparation intelligente main gauche/main droite basée sur le pitch
- Correction de précision flottante pour les notes aux frontières de mesures
- Support des fichiers MIDI multipistes

### Gestion d'État Robuste
- Hook personnalisé `useSong` pour centraliser la logique
- Sauvegarde automatique après chaque modification
- Gestion des IDs uniques avec crypto.randomUUID()
- Validation des données avant persistance

### Performance
- Rendu optimisé avec React
- Lazy loading des composants
- Build optimisé avec Vite
- Synthèse audio efficace avec Tone.js

## 🐛 Corrections Notables (v1.0)

### Fix des Notes aux Frontières de Mesures
**Problème** : Les notes tombant exactement sur les temps 4.0, 8.0, etc. apparaissaient dans la mauvaise mesure en raison d'erreurs de précision flottante.

**Solution** :
- Arrondi à 3 décimales dans `MidiService.js` lors du parsing
- Utilisation d'un epsilon (0.001) pour les comparaisons de temps dans `SongViewer.jsx`
- Tests avec plusieurs fichiers MIDI pour validation

### Persistance des Highlights
Les mesures surlignées dans Live Learning sont maintenant sauvegardées et restaurées lors du rechargement du morceau.

### Affichage Multi-Accords
Correction de l'affichage pour montrer TOUS les accords d'une mesure, pas seulement le premier.

## 📝 Roadmap Future

### Fonctionnalités Envisagées
- [ ] Export en PDF de partitions
- [ ] Métronome intégré avec accent sur le temps fort
- [ ] Mode entraînement avec répétition de boucles
- [x] Ralentissement/accélération du tempo
- [ ] Enregistrement et playback des performances
- [ ] Partage de morceaux via URL
- [ ] Support clavier MIDI physique (Connectivité directe)
- [ ] Annotations et doigtés
- [x] Statistiques de pratique (Précision Synthesia)

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

### Guidelines
- Suivre les conventions de code existantes
- Ajouter des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation si nécessaire
- S'assurer que le build passe (`npm run build`)

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👤 Auteur

**TobieTheUnknown**
- GitHub: [@TobieTheUnknown](https://github.com/TobieTheUnknown)

## 🙏 Remerciements

- [Tone.js](https://tonejs.github.io/) - Pour la synthèse audio
- [@tonejs/midi](https://github.com/Tonejs/Midi) - Pour le parsing MIDI
- [React](https://react.dev/) - Pour le framework UI
- [Vite](https://vitejs.dev/) - Pour l'expérience de développement
- [Jotabe](https://www.twitch.tv/jotabemusique) - Pour l'envie de m'y mettre et les cours de piano

---

**Note** : Cette application fonctionne entièrement dans le navigateur. Aucune donnée n'est envoyée vers un serveur externe. Toutes vos données sont stockées localement sur votre appareil.

🎵 **Bon apprentissage du piano !** 🎹
