# Release v3.2.5

## Nouveautés

### Éditeur Piano Roll — Outils Dessiner / Sélection
- Ajout d'un bouton bascule **✏️ Dessiner** (par défaut) et **↖ Sélection** dans la barre d'outils.
- En mode Dessiner, un clic sur la grille vide ajoute ou supprime une note immédiatement.
- En mode Sélection, un clic-glissé sur la grille vide trace un rectangle de sélection.
- Résolution du bug qui rendait l'ajout de notes impossible en mode plein écran (le rectangle de sélection était toujours déclenché, bloquant `onGridClick`).

### Clavier Synthesia — Correctifs visuels
- **Touches noires** : hauteur réduite de 50 % → 42 % de la hauteur du clavier, laissant un espace visible net entre le bas des touches noires et le bas des touches blanches.
- **Mobile portrait** : le ratio hauteur du clavier est désormais adaptatif (12 % en portrait vs 18.75 % en paysage/desktop), évitant un clavier disproportionné sur un écran 390×844.

### SongEditor mobile
- Le bouton « Ajouter une phrase » du header Piano Roll est masqué sur mobile (inutile et encombrant). Le bouton « Créer une phrase » dans l'état vide reste accessible.

## Fichiers modifiés
- `src/components/editor/canvas/PianoRollCanvas.jsx`
- `src/components/editor/PianoRollEditor.jsx`
- `src/components/editor/controls/Toolbar.jsx`
- `src/components/SynthesiaCanvas.jsx`
- `src/components/SongEditor.jsx`
- `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
