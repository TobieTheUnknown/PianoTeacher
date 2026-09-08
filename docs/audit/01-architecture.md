# Architecture et branches

## Périmètre confirmé

- **Web et GitHub Pages** : une même application React, produite depuis les mêmes sources. `landing/` reste la vitrine ; l'application est hébergée sous `/PianoTeacher/app/`.
- **Desktop** : enveloppe Tauri de l'application React.
- **Android natif** : application Kotlin/Compose autonome, à conserver distincte. Cohérence des résultats musicaux et des fonctionnalités à vérifier, pas de remplacement par une WebView.
- `web/src-tauri/tauri.android.conf.json` et la coquille React mobile constituent une autre voie historique ; vérifier les usages avant tout retrait.

## Git

Au départ : `main` propre à `879257e`. Branche distante `codex/ui-onboarding` à `2f89992`, descendante directe de main avec quatre commits. Elle apporte onboarding, espace partition, suppression de statistiques et réparation de l'édition compacte. Intégration sur `codex/progressive-audit`, main conservée.
`origin/gh-pages` contient uniquement `.nojekyll`, `app/` et la vitrine compilée : branche de sortie, pas une branche de code à fusionner.

## Points d'entrée et chemins de lecture

| Domaine | Web/desktop | Android natif |
|---|---|---|
| Démarrage | `web/src/main.jsx` → `AppDesktop.jsx` responsive | `MainActivity.kt` → `ui/AppNavHost.kt` |
| Modèle | `web/src/models/song.js` | `data/model/Song.kt` |
| MIDI fichier | `services/MidiService.js` | `data/parser/MidiParser.kt` |
| Gammes/accords/motifs | `utils/chordDetection.js`, `hooks/useScaleContext.js` | `utils/MusicUtils.kt`, `utils/ArpeggioDetection.kt` |
| Mesures/partition | `utils/measureUtils.js`, `utils/sheetMusic.js` | `ui/learning/LearningScreen.kt`, `utils/MusicUtils.kt` |
| Son | `services/AudioEngine.js` (Tone.js) | `audio/AudioEngine.kt`, `SamplerEngine.kt`, `main/cpp/audio_engine.cpp` (Oboe) |
| MIDI périphérique | `services/MidiInputService.js`, `src-tauri/src/midi.rs` | `midi/MidiManager.kt` |
| Persistance | `services/StorageService.js` | `data/repository/` |
| Éditeur | `components/editor/`, `SongEditor.jsx` | `ui/editor/` |
| Habillage | `styles/tokens.css`, composants et CSS modules | `ui/theme/`, `ui/common/` |

Les chemins Android ci-dessus sont relatifs à `android/app/src/main/kotlin/com/tobietheunknown/pianoteacher/`, sauf `main/cpp/` relatif à `android/app/src/`.

## Constats initiaux, à traiter

- Les morceaux de démonstration sont servis depuis `web/public/demo/` ; le README a été corrigé.
- Deux workflows Android ; pas de workflow Pages dans main au départ.
- Release Android emploie `gradle` système plutôt que le wrapper, et un nom d'artefact différent de celui promis par la vitrine.
- Deux configurations Vite répètent les chunks ; la base de chemin Pages n'est pas définie par défaut.
