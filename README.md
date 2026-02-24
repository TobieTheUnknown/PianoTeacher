# 🎹 Piano Teacher

<p align="center">
  <img src="docs/screenshots/banner.png" alt="Piano Teacher Banner" width="800px">
</p>

**Piano Teacher** est une application web et desktop interactive conçue pour transformer l'apprentissage du piano. En transformant vos fichiers MIDI en outils pédagogiques visuels, elle vous permet de maîtriser vos morceaux préférés mesure par mesure, avec une précision professionnelle.

---

## ✨ Fonctionnalités Clés

### 📚 Bibliothèque Intelligente (Dashboard)
Gérez votre répertoire avec style. L'interface **Glassmorphism** affiche instantanément les métadonnées cruciales de vos morceaux : tonalité, tempo, et complexité.
> ![Library](docs/screenshots/library_v2.png)

### ✏️ Éditeur de Partition (Piano Roll)
Importez vos fichiers `.mid` et laissez l'algorithme faire le travail.
- **Séparation MG/MD** : Identification automatique de la main gauche et de la main droite.
- **Découpage en Phrases** : Organisez votre morceau en sections logiques (Intro, Refrain, Pont).
- **Édition Intuitive** : Ajustez les notes directement sur la grille.
> ![Editor](docs/screenshots/editor_v2.png)

### 🎙️ Enregistrement MIDI (Nouveau v2.0)
Créez vos propres compositions directement depuis votre clavier MIDI.
- **Enregistrement en Temps Réel** : Capturez vos performances avec précision.
- **Pré-décompte Configurable** : 1 ou 2 mesures de préparation avant l'enregistrement.
- **Quantification Automatique** : Alignement des notes sur la grille (noire ou croche).
- **Visualisation Live** : Voyez vos notes apparaître en temps réel pendant l'enregistrement.

### 🎛️ Éditeur Avancé (Piano Roll Amélioré v2.0)
Un environnement d'édition complet pour peaufiner vos compositions.
- **Sélection Multiple** : Rectangle de sélection et Ctrl+clic pour éditer plusieurs notes.
- **Copier/Coller/Dupliquer** : Raccourcis clavier complets (Ctrl+C, Ctrl+V, Ctrl+D).
- **Métronome Intégré** : Subdivision noire ou croche avec contrôle visuel.
- **Redimensionnement Timeline** : Ajustez la longueur des phrases par glisser-déposer.
- **Lecture par Phrase** : Lecture isolée avec arrêt automatique en fin de phrase.

### 📖 Apprentissage par Mesure (Vue d'Ensemble)
Ne soyez plus submergé par la complexité. Travaillez chaque mesure individuellement.
- **Analyse Harmonique** : Détection automatique des accords.
- **Focus Mains Libres** : Choisissez de travailler uniquement la main gauche, la droite, ou les deux.
- **Progression Visuelle** : Marquez vos mesures "en cours" ou "maîtrisées".
> ![Learning](docs/screenshots/learning_v2.png)

### 🎮 Mode Synthesia Interactif
Plongez dans l'action avec une visualisation moderne des notes tombantes.
- **Code Couleur Dynamique** : Rose pour la main gauche, bleu pour la main droite.
- **Gestion du Tempo** : Apprenez à votre rythme en ralentissant la lecture.
- **Statistiques de Performance** : Suivez votre précision en temps réel.
> ![Synthesia](docs/screenshots/synthesia_v2.png)

### 📝 Export de Partitions (Nouveau v2.1)
Transformez vos morceaux en partitions musicales professionnelles.
- **Formats SVG et PNG** : Exportez vos partitions dans les formats les plus courants.
- **Annotations en Français** : Affichez les noms de notes en notation française (Do, Ré, Mi, etc.).
- **Flexibilité** : Exportez une phrase spécifique ou tout le morceau.
- **Choix des Portées** : Exportez la mélodie seule, les accords seuls, ou les deux.
- **Prévisualisation** : Visualisez la partition avant de l'exporter.
> 📄 Voir la [documentation complète](docs/SHEET_MUSIC_EXPORT.md) pour plus de détails.

---

## 🚀 Installation & Lancement

### 📥 Téléchargement Exécutable
La solution la plus simple pour Windows, macOS et Linux.
👉 **[Télécharger la dernière version](https://github.com/TobieTheUnknown/Piano/releases/latest)**

### 🛠️ Installation depuis les sources
Pour les développeurs et passionnés :

```bash
# 1. Cloner le projet
git clone https://github.com/TobieTheUnknown/Piano.git
cd Piano

# 2. Installer les dépendances
npm install

# 3. Lancer en local
npm run dev
```
L'application sera disponible sur `http://localhost:5173`.

---

## 🏗️ Architecture Technique

- **Frontend** : [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Audio Engine** : [Tone.js](https://tonejs.github.io/) pour la synthèse sonore haute fidélité.
- **MIDI Parsing** : [@tonejs/midi](https://github.com/Tonejs/Midi) avec algorithme propriétaire de détection de tonalité.
- **Sheet Music Rendering** : [VexFlow](https://www.vexflow.com/) pour le rendu de notation musicale.
- **Desktop Wrapper** : [Tauri](https://tauri.app/) pour des performances natives légères.
- **Persistence** : LocalStorage API pour une confidentialité totale (aucune donnée ne quitte votre machine).

---

## 🗺️ Roadmap

### v2.0
- [x] Support des claviers MIDI USB (Web MIDI API).
- [x] Enregistrement MIDI en temps réel avec pré-décompte.
- [x] Éditeur avancé avec sélection multiple et raccourcis clavier.
- [x] Métronome intégré avec subdivision configurable.
- [x] Interface utilisateur optimisée et compacte.

### v2.1 (Actuelle)
- [x] Export de partitions en SVG et PNG.
- [x] Annotations en français (Do, Ré, Mi).
- [x] Prévisualisation des partitions avant export.

### Prochaines versions
- [ ] Export de partitions en format PDF multi-pages.
- [ ] Support des accords simultanés dans les partitions.
- [ ] Import direct depuis YouTube (Audio-to-MIDI).

---

## 🤝 Contribuer
Les Pull Requests sont les bienvenues ! N'hésitez pas à ouvrir une Issue pour discuter de nouvelles fonctionnalités.

---

## 👤 Auteur
**TobieTheUnknown**  
- GitHub : [@TobieTheUnknown](https://github.com/TobieTheUnknown)

---

## Remerciements
- **Jotabe** pour ses cours de piano et son enthousiasme : [@Jotabe](https://www.twitch.tv/jotabemusique)
<p align="center">
  Fait avec ❤️ pour les passionnés de musique. 🎵
</p>
