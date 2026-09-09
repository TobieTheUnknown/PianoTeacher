# Vérifications et point de reprise — 9 septembre 2026

## Résultats réellement observés

- `npm --prefix web test` : **34 tests réussis**, aucun échec. Musique, motifs, gravure pure, MIDI aller-retour, migration et protection des sauvegardes, cycle audio simulé, cohérence MIDI navigateur/Tauri.
- `npm --prefix web run lint` : passé. Avertissement de fraîcheur de la base `baseline-browser-mapping` ; ne pas le confondre avec une erreur ESLint.
- `npm --prefix web run build:pages` : passé, base `/PianoTeacher/app/`. Build normal également passé lors du premier lot ; ne remplace pas un test Tauri natif.
- `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ANDROID_HOME=/Users/TobieRaggi/Library/Android/sdk android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug` : passé. **16 tests JVM**, C++ arm64/x86_64 compilé, APK debug produit.
- Pixel 8 Pro (`37201FDJG0000L`, `husky_beta`) : `adb install -r` réussi, donc données applicatives conservées. L'activité `com.tobietheunknown.pianoteacher/.MainActivity` a démarré à froid en **1,688 s**, puis est restée `RESUMED`, visible et `reportedDrawn=true` après un second lancement contrôlé.
- Journal audio du Pixel : flux Oboe ouvert à **48 kHz**, burst de **96 frames**, puis **30/30 samples chargés** et sampler déclaré prêt. Aucun crash `AndroidRuntime` observé pendant le démarrage et les 20 secondes suivantes.
- `cargo check` dans `web/src-tauri` : passé après retrait de la cible Android Tauri obsolète.
- `npm audit fix` : Vite 7.3.6 et ses dépendances transitives corrigés ; npm a rapporté **0 vulnérabilité** immédiatement après mise à jour.
- Navigateur intégré, Vite sur `http://127.0.0.1:8322` : chargement de la bibliothèque de démonstration et ouverture du Coach.
- Cas visuel `web/test/visual.html` : les deux mains affichent **Do Mi Fa ×3**, puis **Mi Fa ×2**.
- Cas `web/test/visual.html?sheet` : Sol majeur, Fa♯ / Fa♮ / Fa♮ / Fa♯ ; armure, bécarre initial, absence de bécarre répété et retour du dièse vérifiés visuellement.
- Bouton du banc visuel : **contexte running ; samples true ; signal 0.1148** mesuré après une note. Preuve du signal logiciel dans ce navigateur, pas d'une écoute sur les appareils cibles.

Les bancs visuels sont servis en développement et ne font pas partie du bundle de production.

## Non vérifié / non terminé

- Aucun push, déploiement Pages ni changement de réglage du dépôt GitHub.
- Pas encore d'écoute manuelle ni d'essai avec clavier USB/BLE, pédale physique ou changement de sortie audio sur le Pixel.
- Pas de compilation/installation Tauri macOS/Windows/Linux dans ce lot.
- Préservation des métadonnées Room assurée par transaction dans le code ; pas encore de test instrumenté de base Android.
- Gravure complète : silences et voix de durées différentes restent ouverts. Les liaisons web/Android et ligatures 6/8 ont un test pur.
- Moteur natif : mutex Oboe et récupération de route à examiner. SoundPool limite les 64 flux demandés à 32 sur le Pixel ; vérifier si cette demande peut être réduite sans gêner sustain et répétitions rapides.
- Premier rendu de `GrandStaffCanvas` : le journal a signalé 54 frames sautées pendant la compilation Compose initiale. Mesurer un lancement de production avant d'en tirer une conclusion, puis profiler si le délai reste perceptible.
- Import MIDI : les changements internes de tempo/métrique ne sont toujours pas représentés par le modèle global.
- Réglages Android : MIDI USB/BLE désormais raccordés au cycle de vie ; audio global et options d'affichage restent à vérifier chez leurs consommateurs.
- L'éditeur, les hooks LivePlay et le détail des thèmes/CSS ne sont pas encore entièrement audités.
- Le contrôle `npm audit` ultérieur a rencontré une coupure DNS du bac à sable ; le résultat réussi de `npm audit fix` reste la dernière mesure disponible.

## Reprise ciblée

1. Lire `README.md`, puis la fiche du domaine choisi ; utiliser les deux index pour trouver les symboles sans relire l'UI entière.
2. Reprendre à l'étape 5 : terminer les liaisons/silences/voix Android et vérifier la gravure sur des partitions réelles.
3. Fermer ensuite audio natif, édition et LivePlay, puis faire la synthèse design.
4. Relancer uniquement les vérifications affectées par les nouvelles modifications.

Branche locale : `codex/progressive-audit`. Intégration de `origin/codex/ui-onboarding` déjà réalisée. `main` et `origin/gh-pages` n'ont pas été remplacées.
