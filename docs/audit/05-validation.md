# Vérifications et point de reprise — 11 septembre 2026

## Résultats réellement observés

- `npm --prefix web test` : **82 tests réussis**, aucun échec. Musique, motifs, gravure pure, voix et silences, MIDI aller-retour, migration et protection des sauvegardes, cycle audio simulé, cohérence MIDI navigateur/Tauri, cycle de connexion, calibration et horodatage MIDI, découpe en 6/8, projection des tenues et reprise audio après seek.
- `npm --prefix web run lint` : passé. Avertissement de fraîcheur de la base `baseline-browser-mapping` ; ne pas le confondre avec une erreur ESLint.
- `npm --prefix web run build:pages` : passé, base `/PianoTeacher/app/`. Build normal également passé lors du premier lot ; ne remplace pas un test Tauri natif.
- Après le passage accessibilité/styles : lint, les **46 tests Web** et le build Pages repassent. Recherche statique : aucun `transition: all` restant dans `web/src` et aucun `<label>` non associé dans `Settings.jsx` ou `SongEditor.jsx`.
- Navigateur intégré : Réglages et Import/Export de l'Éditeur reçoivent le focus à l'ouverture ; Tab entre dans leurs contrôles, Échap ferme, puis le focus revient au bouton déclencheur. Ce test a détecté puis permis de corriger une référence initialement placée sur le mauvais conteneur mobile.
- Après extraction de la fenêtre Import/Export, lint, les **46 tests Web** et le build Pages repassent. Le navigateur intégré confirme le focus initial du dialogue, son cycle clavier, sa fermeture par Échap et le retour au bouton d'ouverture ; l'arbre d'accessibilité ne contient plus qu'un contrôle par import de fichier.
- Après extraction du panneau de sauvegarde de bibliothèque, lint, les **46 tests Web** et le build Pages repassent. Dans le navigateur, l'onglet Biblio expose un seul contrôle d'import ; Échap ferme toujours Réglages et restitue le focus à son bouton d'ouverture.
- Le lot de cycle MIDI Web porte la suite à **58 tests** : connexions Tauri concurrentes, déconnexion pendant connexion ou initialisation, scan hors ordre, refus de permission retentable, stockage bloqué, valeurs corrompues, retrait et retour d'un périphérique. Lint, suite complète et build Pages passent.
- Le lot calibration porte la suite à **71 tests** : appariement temporel bijectif, battements manqués, doubles frappes, seuil minimal, bornage et annulation de toutes les ressources après démontage. Lint, suite complète et build Pages passent.
- Le lot horloge/consommateurs porte la suite à **82 tests** : réception monotone Tauri, compensation 0/−50 ms, attaque et relâchement enregistrés, bornes de phrase, jugement Live et état asynchrone du panneau MIDI. Lint, suite complète et build Pages passent.
- `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ANDROID_HOME=/Users/TobieRaggi/Library/Android/sdk android/gradlew -p android :app:testDebugUnitTest :app:assembleDebug` : passé après l'intégration audio/UI/gravure. **58 tests JVM**, C++ arm64/x86_64 compilé, APK debug produit. Huit tests couvrent focus refusé/perdu, arrière-plan, reprise explicite, libération différée et interruption d'un transport ; les nouveaux cas couvrent aussi projection de tenue, découpe 6/8 et ordre des sauvegardes éditeur.
- Après le passage de sémantique Compose, la même commande Android repasse : **58 tests JVM**, compilation Kotlin, C++ arm64/x86_64 et APK debug réussis. Aucun calcul musical ou chemin audio n'est modifié dans ce lot.
- Cette APK a été installée sur le Pixel 8 Pro avec `adb install -r` : succès et données conservées. Le lancement explicite a ramené la tâche Piano Teacher existante au premier plan sans recréer l'activité.
- Compatibilité Android 16 Ko : Oboe 1.10.0, DataStore 1.2.1 et Graphics Path 1.1.0. `zipalign -c -P 16 -v 4` valide l'APK ; `llvm-readelf -l` donne `Align 0x4000` pour les cinq bibliothèques arm64 (`libc++`, DataStore, Oboe, PianoTeacher et Graphics Path).
- Onze tests ciblent la timeline audio : jitter, note traversant une mesure, occurrences de même pitch, attente MIDI sans accompagnement, seek/cancel, scrub bidirectionnel et préécoute des deux mains. Dix tests couvrent la prochaine date des rappels selon jours, heure, minute et fuseau.
- Pixel 8 Pro (`37201FDJG0000L`, `husky_beta`) : `adb install -r` réussi, donc données applicatives conservées. L'activité `com.tobietheunknown.pianoteacher/.MainActivity` a démarré à froid en **1,688 s**, puis est restée `RESUMED`, visible et `reportedDrawn=true` après un second lancement contrôlé.
- Journal audio du Pixel : flux Oboe ouvert à **48 kHz**, burst de **96 frames**, puis **30/30 samples chargés** et sampler déclaré prêt. Aucun crash `AndroidRuntime` observé pendant le démarrage et les 20 secondes suivantes.
- Nouvelle APK audio/timeline installée avec `adb install -r` : succès, données conservées, activité visible, `topResumedActivity` et `reportedDrawn=true`. Le journal confirme **Audio ready=true, backend=Oboe, 30/30 samples** sans crash au démarrage.
- APK focus/UI réinstallée avec `adb install -r` sur le même Pixel. Le lancement n'ouvre aucun flux audio ; un appui sur Lecture demande le focus et ouvre Oboe. Après accueil Android, retour dans PianoTeacher puis nouvel appui sur Lecture, le journal montre une nouvelle ouverture Oboe à 48 kHz/96 frames sans second chargement des 30 samples. La production sonore reste à confirmer à l'oreille avec une autre application réellement en lecture.
- Contrôle visuel portrait sur le Pixel : dock d'onglets visible dans Live, absence de bande vide entre transport et onglets du Coach, cartes de chaque rangée alignées, et motifs répétés des cartes encadrés avec le même composant pour les deux mains. Le multiplicateur `×N` est désormais placé hors de la chip encadrée sur web et Android ; ce dernier ajustement attend la reconnexion du Pixel pour sa capture finale.
- L'inset du Coach est maintenant réparti par responsabilité : barre d'état en haut dans l'écran, barre de navigation en bas dans le dock. Compilation et 58 tests JVM passent ; contrôle visuel matériel à reprendre sur le Pixel.
- APK du 11 septembre réinstallée avec `adb install -r` : succès et données conservées. Le lancement contrôlé de l'activité a réussi sans `FATAL EXCEPTION`; le téléphone a ensuite affiché une autre application, donc ce passage ne valide ni le rendu Coach ni la production sonore.
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
- Le checkpoint `4c9daea` a été poussé sur la branche d'audit et `main` ; les workflows Android et Web/GitHub Pages sont tous deux terminés avec succès.
- Après `07ccfd2`, GitHub a signalé l'exécution forcée sous Node 24 d'actions encore fondées sur Node 20. Web/Pages passe avec `checkout` v7, `setup-node` v7, `upload-pages-artifact` v5 et `deploy-pages` v5. Android passe sans annotation Node 20 avec `checkout` v7, `setup-java` v6, `setup-android` v4, `cache` v6 et `upload-artifact` v7 ; l'APK est bien publiée comme artefact du job.
- Pas encore d'écoute manuelle ni d'essai avec clavier USB/BLE, pédale physique ou changement de sortie audio sur le Pixel.
- Pas de compilation/installation Tauri macOS/Windows/Linux dans ce lot.
- Préservation des métadonnées Room assurée par transaction dans le code ; pas encore de test instrumenté de base Android.
- Gravure : les voix de durées différentes, silences, liaisons et ligatures 6/8 ont des tests purs. Les tuplets et changements internes de métrique/tempo restent hors du modèle courant.
- Moteur natif : callback Oboe sans mutex validé par les tests C++ ci-dessous. La récupération de route/focus est couverte par tests purs mais reste à écouter sur le Pixel. Le repli SoundPool demande maintenant les 32 flux acceptés par Android.
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

## Checkpoint natif Oboe : callback sans mutex

Commandes depuis la racine :

```sh
cmake -S android/app/src/main/cpp -B /tmp/piano-voice-mixer-cmake -DCMAKE_BUILD_TYPE=Release
cmake --build /tmp/piano-voice-mixer-cmake
ctest --test-dir /tmp/piano-voice-mixer-cmake --output-on-failure
c++ -std=c++17 -Wall -Wextra -Werror -pthread -fsanitize=address,undefined -fno-omit-frame-pointer -I android/app/src/main/cpp android/app/src/test/cpp/voice_mixer_test.cpp -o /tmp/piano-voice-mixer-asan
/tmp/piano-voice-mixer-asan
c++ -std=c++17 -Wall -Wextra -Werror -pthread -fsanitize=thread -I android/app/src/main/cpp android/app/src/test/cpp/voice_mixer_test.cpp -o /tmp/piano-voice-mixer-tsan
/tmp/piano-voice-mixer-tsan
```

Depuis `android/` :

```sh
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ANDROID_HOME='/Users/TobieRaggi/Library/Android/sdk' ./gradlew :app:externalNativeBuildDebug :app:testDebugUnitTest --offline
```

Résultats : sept groupes C++ passés (CTest, ASan/UBSan, TSan), sans erreur détectée ; compilation Oboe arm64-v8a et x86_64 réussie ; **58 tests JVM passés**, aucun échec ni test ignoré. `git diff --check` passe. Les avertissements Gradle concernent la version XML du SDK et des API Kotlin/Android dépréciées déjà présentes.

Le harnais interdit `new`/`new[]` pendant le rendu et vérifie le rendu pendant qu'un producteur est suspendu, ainsi que la purge des générations et un stress concurrent. Ces vérifications ne remplacent pas une mesure des underruns et une écoute sur téléphone avec polyphonie, pédale, focus concurrent et changements de route. Aucune installation ni validation matérielle effectuée pour ce checkpoint ; les défauts P2 sessions/routes sont traités dans le checkpoint suivant.

## Checkpoint sessions/routes : révision native et ownership atomique

Tests de régression ajoutés avant la correction du contrôleur, puis tests ciblés et validation complète depuis `android/` :

```sh
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ANDROID_HOME='/Users/TobieRaggi/Library/Android/sdk' ./gradlew :app:externalNativeBuildDebug :app:testDebugUnitTest --tests '*AudioSessionControllerTest' --tests '*PlaybackTimelineTest' --offline
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ANDROID_HOME='/Users/TobieRaggi/Library/Android/sdk' ./gradlew :app:testDebugUnitTest :app:assembleDebug --offline
```

Résultats : tests ciblés passés, **63 tests JVM passés** au complet, aucun échec ni test ignoré ; bibliothèques natives arm64-v8a/x86_64 compilées et APK debug produit. CTest du mixeur reste passant ; `git diff --check` passe. `javap` confirme les signatures compilées de la notification privée JNI et des méthodes d'émission avec session ID.

Les nouveaux tests couvrent les interleavings précis (route notifiée ou notification retardée après réouverture MIDI, interruption pendant ouverture, émission tardive après réacquisition) et le transfert du propriétaire par le vrai transport lors d'une attaque/restauration de tenue. Les callbacks de fermeture JNI sur un vrai appareil, les routes Bluetooth/USB, le focus concurrent et la qualité audio ne sont pas validés matériellement ici. Pas d'installation effectuée.

Après retrait de la méthode historique `AudioEngine.start()` et de ses deux appels sans effet, `:app:testDebugUnitTest :app:assembleDebug` repasse : **63 tests JVM**, compilation Oboe arm64-v8a/x86_64 et APK debug réussies.

## Checkpoint fermeture Oboe hors du main

Depuis `android/`, après ajout des tests de régression :

```sh
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ANDROID_HOME='/Users/TobieRaggi/Library/Android/sdk' ./gradlew :app:testDebugUnitTest --tests '*AudioOutputLifecycleTest' --tests '*AudioSessionControllerTest' --tests '*PlaybackTimelineTest' --offline
JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ANDROID_HOME='/Users/TobieRaggi/Library/Android/sdk' ./gradlew :app:testDebugUnitTest :app:assembleDebug --offline
```

Résultats : tests ciblés passés ; **70 tests JVM passés**, aucun échec ni test ignoré. APK debug construit avec les bibliothèques arm64-v8a/x86_64. CTest du mixeur natif et `git diff --check` restent passants. L'avertissement de version XML du SDK était déjà présent.

`AudioOutputLifecycleTest` injecte un exécuteur manuel et un vrai worker avec une fermeture bloquée par latch : `interrupt()` rend la main et le verrou des voix reste accessible avant déblocage du pilote simulé. Les tests couvrent aussi stop→start, background pendant ouverture, notification retardée, annulation, note MIDI relâchée avant disponibilité et ownership de hauteurs identiques. Les tests antérieurs de sessions et de transport restent actifs.

APK installée sur le Pixel 8 Pro avec `adb install -r` : succès et données conservées. Le démarrage à froid de `MainActivity` a réussi en **1,022 s** ; l'activité est restée `topResumedActivity` et les journaux confirment **30/30 samples**, `Audio ready=true`, backend Oboe, sans `FATAL EXCEPTION`. Aucun flux n'est ouvert avant une action sonore, conformément au cycle de focus. L'écoute, la reprise après une autre application audio et les routes Bluetooth/USB restent à valider manuellement.

Un pilote qui ne termine pas peut bloquer le worker de sortie ; ce checkpoint garantit l'invalidation immédiate et retire les attentes Oboe du main/voiceLock, pas un délai maximal du pilote. Le chemin dormant `release()` est volontairement inchangé, comme le choix de fallback et l'ordonnanceur musical.
