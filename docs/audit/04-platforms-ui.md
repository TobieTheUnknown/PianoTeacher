# Plateformes et pistes UI — en cours

## Distinction maintenue

Android = Kotlin/Compose autonome. Desktop = React/Tauri. Web et Pages = le même front React avec une base d'assets adaptée. L'ancienne coque `AppMobile`, ses scripts Tauri Android/iOS et le pont JNI Android de `web/src-tauri` ont été retirés après vérification : ils doublaient l'application Android native et n'étaient utilisés par aucune CI de production. Le front React principal reste responsive.

## Idées à discuter après audit

- Donner priorité à la séquence jouée : plusieurs lignes de motifs répétés dans une mesure, comme `do mi fa ×3` puis `mi fa ×2`. Implémentation demandée par l'utilisateur, et non simple idée.
- Limiter le résumé par main à cette information ; déplacer les hypothèses harmoniques détaillées dans une vue explicative.
- Afficher majeur/mineur explicitement plutôt que seulement par la casse (Do/DO), ambiguë et difficile d'accès.
- Distinguer les notions : clef (sol/fa/ut), armure (tonalité), chiffrage (6/8), rubato (souplesse rythmique), motif/ostinato (répétition).
- Réduire les contrôles simultanés : lecture + vitesse + boucle au premier niveau ; réglages avancés dans un panneau.
- Une partition devrait garder les octaves et durées musicales fidèles ; proposer explicitement la vue simplifiée plutôt que changer automatiquement de clef/registre sans explication.
- Séparer une analyse probable (accord incomplet, tonalité estimée) d'une information explicite du fichier MIDI.

## Régressions de plateforme détectées

- `tauri.conf.json` attend le port 5173, Vite sert sur 8322.
- NDK de CI Android 27 différent du NDK 30 épinglé dans Gradle.
- Erreur Compose dans `BottomTabBar.kt` sur le receiver implicite `maxHeight` : corrigée, compilation passée.
- Unités de temps Android migrées de façon coordonnée vers des noires en Double ; compilation et tests passés. La distinction entre pulsations visuelles et unités MIDI reste à examiner.
- Les boutons précédent/suivant du dock Android pilotent maintenant la mesure focalisée et bornent correctement le début/la fin.
- Les versions web, Tauri et Android sont alignées ; `scripts/set-version.py` remplace l'ancien script de release qui modifiait les dépendances, créait un commit et un tag avec des notes figées.

## Retraits vérifiés

Graphe depuis `main.jsx` et recherche de références : suppression des anciens contrôles LivePlay, cartes/guides/barres learn, styles et barrel obsolètes, icône éditeur inutilisée, définitions locales non appelées de LiveLearning et ancienne cible mobile Tauri.

## Réglages et sauvegardes

Les interrupteurs MIDI Android ne pilotaient pas le scanner : ils écrivaient seulement les préférences. Le cycle de vie de MainActivity applique maintenant USB/BLE et le résultat des permissions. Les autres réglages demandent encore une vérification de leur utilisation effective. Les défauts de sauvegarde et les migrations sont détaillés dans `02-music.md`.
