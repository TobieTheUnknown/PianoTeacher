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

Deux autres préférences sans effet ont été raccordées : « Son activé » pilote le moteur partagé et « Touches attendues » masque réellement les touches suggérées de Live, y compris si le réglage change pendant que l'écran reste dans la pile. Le volume du métronome s'applique maintenant aussi à Partition/Coach, et la résonance est restaurée dès le lancement. L'ancienne préférence interne `handColorsEnabled`, sans contrôle ni consommateur, a été supprimée.

## Navigation, introduction et pratique Android

- Réglages reste accessible dans l'en-tête de la bibliothèque et a été retiré des onglets.
- Éditeur précède Partition dans la navigation ; un réglage permet de masquer cet onglet. Son ancien dock sans playback réel a été retiré : l'écran se concentre sur découper et fusionner les phrases.
- Les choix onboarding « cap » et « rythme » étaient seulement stockés puis réaffichés. Ce code a été retiré au profit d'explications concrètes sur la barre de transport, les mains, la boucle, le découpage/fusion et les gestes Live.
- Si l'utilisateur indique ne pas prévoir de clavier MIDI, Live démarre en écoute des deux mains ; Partition et Coach conservent aussi ce défaut.
- Live accepte un glissement à un doigt pour parcourir la piste avec préécoute ; la piste suit le doigt, donc descendre avance et monter recule. Dès qu'un second doigt participe, le déplacement temporel est gelé et seul le zoom est appliqué.
- Le dock d'onglets reste visible dans Live en portrait et disparaît en paysage. Coach applique l'inset de barre d'état en haut ; le dock reste seul responsable de l'inset de navigation en bas, sans bande vide intermédiaire.
- Les deux mains du Coach utilisent le même rendu de notes et les cartes d'une même rangée prennent la même hauteur.
- Dans Partition, le surlignage temporel de la première mesure commence après la clef et l'armure ; sa largeur musicale est identique aux mesures suivantes de la rangée.
- Les rappels de pratique locaux acceptent plusieurs jours, une heure et une durée. Ils se reprogramment après déclenchement, redémarrage, changement d'heure/fuseau et mise à jour ; Android peut décaler une alarme inexacte pour économiser la batterie.
