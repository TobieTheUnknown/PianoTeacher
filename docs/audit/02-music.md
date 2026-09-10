# Données et logique musicale — logique fondamentale vérifiée

## Invariants constatés dans le code

`NoteEvent.startTime` et `duration` sont en **noires**, localement à la phrase (`ticks / PPQ`). `Phrase.length` est en mesures. La durée d'une mesure vaut `numerator * 4 / denominator`. Le commentaire « 4 units per measure » dans les cartes est faux pour les imports non 4/4. Ne pas convertir arbitrairement les anciennes sauvegardes : elles ne portent pas de version d'unité.

## Défauts démontrés au début de l'audit

- MIDI web : longueur plafonnée à 64 ; décalage de l'anacrouse ; monocanal assigné entièrement à une main ; armure MIDI ignorée au profit d'une estimation ; variations de tempo et métrique non conservées.
- MIDI Android : seules les deux premières pistes musicales sont conservées ; séparation de phrases arrondie à la mesure la plus proche ; durées et découpage reposent sur le numérateur ; note-on indexé par pitch sans canal ; métadonnées finales écrasent les initiales.
- `useSong.js` : scission et fusion supposent 4/4.
- `measureUtils.js` : mesure fixée à 4 ; séparation des mains basée sur un clavier limité C1–B5 (les notes hors plage valent -1 et se retrouvent à droite).
- Export MIDI : dénominateur/chiffrage absents ; API Tauri `writeBinaryFile` de v1 alors que le projet dépend de v2.
- `getMidiNumber` et copie privée dans `chordDetection` : octave -1 et notes E#/Cb/B#/Fb mal traitées.
- `useScaleContext` : A# mineur absent, tables de notes et normalisation dupliquées.
- `identifyChord` : triade incluse dans un accord de septième inversé choisie avant un accord exact sur une autre fondamentale.
- `qualifyArpeggioMeasure` : seuil absolu 0,06 noire sur chaque écart/durée ; un jeu rubato peut empêcher tout badge. `detectArpeggioMotifs` ignore le rythme et les octaves pour ×N.
- `LiveLearning.jsx` : analyse des rôles et règles de répétition enfouies dans le composant (vers 660–890) ; asymétrie main droite (reps forcé à 1) / gauche ; exige deux mesures voisines même si une mesure contient plusieurs répétitions.
- `sheetMusic.js` : armures à sept altérations absentes ; placement uniquement chromatique sharp/flat, donc E#/Cb mal placés ; chaque touche noire reçoit une altération après la note, sans mémoire de mesure ni bécarres ; notes traversant la barre non liées ; ligatures sans métrique composée.

## Navigation ciblée

1. Modèle et import : `models/song.js`, `services/MidiService.js`, `services/StorageService.js` ; Android `data/model/Song.kt`, `data/parser/MidiParser.kt`, `SongJsonParser.kt`.
2. Gammes/noms : `models/song.js`, `hooks/useScaleContext.js`, Android `utils/MusicUtils.kt`.
3. Accords et motifs : `utils/chordDetection.js` (fonctions publiques), Android `utils/ArpeggioDetection.kt`.
4. Cartes : `utils/measureUtils.js` → analyse `LiveLearning.jsx` → `MeasureCard` ; ne lire l'UI qu'après tests purs.
5. Gravure : `slicePhraseIntoMeasures`, `keySignatureAccidentalCount`, `renderMeasure` dans `utils/sheetMusic.js` → `SheetMusicLearning.jsx` ; Android renderer dans `LearningScreen.kt`.

## Scénarios de référence

4/4, 3/4, 6/8 ; première note après silence ; >64 mesures ; trois pistes ; séparation hors C1–B5 ; Do mineur et son relatif ; Fa# majeur (Mi#), Dob majeur ; septième inversée ; ostinato réel vs même ensemble de notes dans un autre ordre ; jeu expressif vs changement rythmique ; note tenue au-delà d'une barre.

## Lot de corrections engagé

- Tests purs : noms MIDI, octaves enharmoniques, A# mineur, accord de septième inversé, métrique 6/8, import MIDI réel de 71 mesures avec anacrouse/armure, répétitions MD/MG.
- `analyzeSong.js` contient maintenant l'analyse des cartes auparavant imbriquée dans React. `repeatedMotifs.js` et Android `RepeatedMotifs.kt` segmentent la séquence sans exiger un unique motif pour toute la mesure.
- Exemple utilisateur ajouté comme régression : **do mi fa ×3 puis mi fa ×2**. Les séquences non répétées et les changements d'octave sont conservés ; le timing expressif reste inchangé dans les notes originales.
- Armures : sept altérations, orthographe/position diatonique, mémoire des altérations par octave et mesure et bécarres. Tests purs ajoutés ; scénario Sol majeur / bécarre / retour au dièse vérifié dans le navigateur.
- Android : conserve toutes les pistes musicales, évite arrondi de durée vers le bas, conserve l'orthographe de la tonalité ; tests ajoutés.
- Relecture Astra : import Android des armures explicites, notes identiques superposées sur plusieurs canaux et silence initial corrigés ; détection statistique des tonalités rendue identique sur les deux plateformes.
- Import/export web : les métadonnées tardives ne réécrivent plus le début du morceau ; les notes très courtes, positions de phrases, métrique et armure survivent à un aller-retour MIDI.
- Accords : la même priorité fondamentale/basse est utilisée par les deux chemins ; une triade avec Fa ajouté n'invente plus un Maj7 sans Si. Les accords incomplets restent réservés aux badges explicitement probables.
- Mesures et édition : tolérance ramenée à une erreur numérique, scission seulement sur une barre, fusion sans perte du silence terminal et séparateurs de mains transférés.
- Ligatures : groupes par pulsation réelle, dont 3+3 en 6/8. Le web découpe maintenant une note tenue sur plusieurs mesures et affiche ses liaisons.
- Android découpe maintenant aussi les notes tenues en fragments d'affichage liés, sans modifier les événements employés par la lecture.
- Voix et silences : web et Android regroupent sur une même hampe uniquement les notes de même départ **et** même durée. Les lignes simultanées de durées différentes gardent leurs voix, leurs hampes et leurs ligatures. Les silences initiaux et internes sont calculés par voix puis découpés sur les pulsations, dont 3+3 en 6/8 ; un reliquat expressif impossible à noter exactement n'est pas arrondi vers une durée fausse.
- Rendu : les silences utilisent des formes vectorielles locales plutôt que des glyphes Unicode dépendants de la police. Le banc visuel couvre une basse tenue, une mélodie mobile et des silences sur les deux portées.
- Point non clos : le modèle ne représente encore qu'un tempo et un chiffrage globaux ; les changements internes de tempo/métrique nécessitent une évolution de données avant le rendu.

## Persistance — deuxième lot

- Web : les écritures et fusions utilisent une lecture stricte. Un JSON illisible ne devient plus une bibliothèque vide à écraser. Le chargement d'affichage conserve son traitement d'erreur ; une restauration explicitement demandée reste possible.
- Les anciennes mains à plat sont déplacées vers `tracks`, sans mutation de l'objet original.
- Android : `SongDao.saveScore` conserve `lastPlayedAt` et `masteredPhrases` dans une transaction. Import d'une bibliothèque également transactionnel ; flux d'asset fermé avec `use` et titre de document lu via `OpenableColumns`.
- `SongJsonParser` normalise les tonalités compactes et les notes nommées, génère les IDs absents et refuse notes/durées/métriques invalides avant écriture. Deux régressions JVM couvrent import ancien et rejet des données invalides.
