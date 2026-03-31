# Piano Practice

Application Android native pour apprendre le piano avec analyse de partitions MIDI.

## Fonctionnalités

- **Bibliothèque** — importe et gère tes fichiers MIDI
- **Piano Practice** — vue Synthesia temps réel, défilement synchronisé, main gauche/droite
- **Apprentissage** — grille de mesures avec analyse harmonique, stats par mesure
- **Paramètres** — MIDI USB, préférences d'affichage (octaves, bémols, touches attendues)

## Stack technique

- Kotlin + Jetpack Compose
- Android MIDI API
- Oboe / AAudio (audio low-latency)
- Gemini Nano (on-device AI)
- Gradle 8 / Android SDK 35 / NDK 27

## Build

```bash
./gradlew assembleDebug
```

APK de sortie : `app/build/outputs/apk/debug/app-debug.apk`

## Release

Les releases sont créées automatiquement via GitHub Actions au push d'un tag `v*` :

```bash
git tag v2.0.0
git push origin v2.0.0
```

L'APK signé est attaché à la GitHub Release.

> Pour signer, configure les secrets `SIGNING_KEY_BASE64`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_STORE_PASSWORD`, `SIGNING_KEY_PASSWORD` dans les Settings du repo.
