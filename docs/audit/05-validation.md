# Vérifications et point de reprise — 10 septembre 2026

## Résultats réellement observés

- `npm --prefix web test` : **41 tests réussis**, aucun échec. Musique, motifs, gravure pure, voix et silences, MIDI aller-retour, migration et protection des sauvegardes, cycle audio simulé, cohérence MIDI navigateur/Tauri.
- `npm --prefix web run lint` : passé. Avertissement de fraîcheur de la base `baseline-browser-mapping` ; ne pas le confondre avec une erreur ESLint.
- `npm --prefix web run build:pages` : passé, base `/PianoTeacher/app/`. Build normal également passé lors du premier lot ; ne remplace pas un test Tauri natif.
- `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ANDROID_HOME=/Users/TobieRaggi/Library/Android/sdk android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug` : passé après l'intégration audio/UI/gravure. **52 tests JVM**, C++ arm64/x86_64 compilé, APK debug produit. Huit tests couvrent focus refusé/perdu, arrière-plan, reprise explicite, libération différée et interruption d'un transport ; sept couvrent voix, hampes, ligatures et silences.
- Compatibilité Android 16 Ko : Oboe 1.10.0, DataStore 1.2.1 et Graphics Path 1.1.0. `zipalign -c -P 16 -v 4` valide l'APK ; `llvm-readelf -l` donne `Align 0x4000` pour les cinq bibliothèques arm64 (`libc++`, DataStore, Oboe, PianoTeacher et Graphics Path).
- Onze tests ciblent la timeline audio : jitter, note traversant une mesure, occurrences de même pitch, attente MIDI sans accompagnement, seek/cancel, scrub bidirectionnel et préécoute des deux mains. Dix tests couvrent la prochaine date des rappels selon jours, heure, minute et fuseau.
- Pixel 8 Pro (`37201FDJG0000L`, `husky_beta`) : `adb install -r` réussi, donc données applicatives conservées. L'activité `com.tobietheunknown.pianoteacher/.MainActivity` a démarré à froid en **1,688 s**, puis est restée `RESUMED`, visible et `reportedDrawn=true` après un second lancement contrôlé.
- Journal audio du Pixel : flux Oboe ouvert à **48 kHz**, burst de **96 frames**, puis **30/30 samples chargés** et sampler déclaré prêt. Aucun crash `AndroidRuntime` observé pendant le démarrage et les 20 secondes suivantes.
- Nouvelle APK audio/timeline installée avec `adb install -r` : succès, données conservées, activité visible, `topResumedActivity` et `reportedDrawn=true`. Le journal confirme **Audio ready=true, backend=Oboe, 30/30 samples** sans crash au démarrage.
- APK focus/UI réinstallée avec `adb install -r` sur le même Pixel. Le lancement n'ouvre aucun flux audio ; un appui sur Lecture demande le focus et ouvre Oboe. Après accueil Android, retour dans PianoTeacher puis nouvel appui sur Lecture, le journal montre une nouvelle ouverture Oboe à 48 kHz/96 frames sans second chargement des 30 samples. La production sonore reste à confirmer à l'oreille avec une autre application réellement en lecture.
- Contrôle visuel portrait sur le Pixel : dock d'onglets visible dans Live, absence de bande vide entre transport et onglets du Coach, cartes de chaque rangée alignées, et motifs répétés des cartes encadrés avec le même composant pour les deux mains. Le multiplicateur `×N` est désormais placé hors de la chip encadrée sur web et Android ; ce dernier ajustement attend la reconnexion du Pixel pour sa capture finale.
- L'inset du Coach est maintenant réparti par responsabilité : barre d'état en haut dans l'écran, barre de navigation en bas dans le dock. Compilation et 52 tests JVM passent ; contrôle visuel matériel à reprendre avec le Pixel connecté.
- Introduction contrôlée sur le Pixel jusqu'à l'écran de rappel : jours multiples, heure, durée et demande système de permission sont visibles et utilisables dans le format portrait.
- `cargo check` dans `web/src-tauri` : passé après retrait de la cible Android Tauri obsolète.
- `npm audit fix` : Vite 7.3.6 et ses dépendances transitives corrigés ; npm a rapporté **0 vulnérabilité** immédiatement après mise à jour.
- Navigateur intégré, Vite sur `http://127.0.0.1:8322` : chargement de la bibliothèque de démonstration et ouverture du Coach.
- Cas visuel `web/test/visual.html` : les deux mains affichent **Do Mi Fa ×3**, puis **Mi Fa ×2**.
- Cas `web/test/visual.html?sheet` : Sol majeur, Fa♯ / Fa♮ / Fa♮ / Fa♯ ; armure, bécarre initial, absence de bécarre répété et retour du dièse vérifiés visuellement.
- Cas `web/test/visual.html?voices` : basse tenue et mélodie mobile séparées en voix, silences vectoriels visibles, aucune case de caractère manquant.
- Bouton du banc visuel : **contexte running ; samples true ; signal 0.1148** mesuré après une note. Preuve du signal logiciel dans ce navigateur, pas d'une écoute sur les appareils cibles.

Les bancs visuels sont servis en développement et ne font pas partie du bundle de production.

## Non vérifié / non terminé

- `e4fe67b` a été poussé sur `codex/progressive-audit` puis sur `main`. GitHub Pages utilise désormais le workflow Web unifié ; compilation et déploiement réussis, landing et `/PianoTeacher/app/` répondent HTTP 200.
- Pas encore d'écoute manuelle ni d'essai avec clavier USB/BLE, pédale physique ou changement de sortie audio sur le Pixel.
- Pas de compilation/installation Tauri macOS/Windows/Linux dans ce lot.
- Préservation des métadonnées Room assurée par transaction dans le code ; pas encore de test instrumenté de base Android.
- Gravure : les voix de durées différentes, silences, liaisons et ligatures 6/8 ont des tests purs. Les tuplets et changements internes de métrique/tempo restent hors du modèle courant.
- Moteur natif : mutex Oboe à examiner. La récupération de route/focus est couverte par tests purs mais reste à écouter sur le Pixel. Le repli SoundPool demande maintenant les 32 flux acceptés par Android.
- Premier rendu de `GrandStaffCanvas` : le journal a signalé 54 frames sautées pendant la compilation Compose initiale. Mesurer un lancement de production avant d'en tirer une conclusion, puis profiler si le délai reste perceptible.
- Import MIDI : les changements internes de tempo/métrique ne sont toujours pas représentés par le modèle global.
- Réglages Android : MIDI USB/BLE est raccordé au cycle de vie ; l'audio global coupe réellement la session, le niveau de métronome atteint Partition/Coach et l'affichage des touches attendues pilote Live.
- Le détail des thèmes/CSS web n'est pas encore entièrement audité.
- Le contrôle `npm audit` ultérieur a rencontré une coupure DNS du bac à sable ; le résultat réussi de `npm audit fix` reste la dernière mesure disponible.

## Reprise ciblée

1. Lire `README.md`, puis la fiche du domaine choisi ; utiliser les deux index pour trouver les symboles sans relire l'UI entière.
2. Reconnecter le Pixel, installer l'APK 16 Ko avec `adb install -r`, confirmer l'absence du dialogue de compatibilité et le `×N` hors chip, puis écouter transitions de mesures, accords simultanés, notes répétées, boucle, scrub Live et reprise après une autre application audio.
3. Reprendre ensuite le détail des thèmes/CSS et l'audit des interactions Éditeur/Live.
4. Relancer uniquement les vérifications affectées par les nouvelles modifications.

Branche locale : `codex/progressive-audit`. Intégration de `origin/codex/ui-onboarding` déjà réalisée. `main` pointe sur le checkpoint ; l'ancienne branche générée `origin/gh-pages` n'est plus la source de publication.
