# Guide de Build - Piano Teacher (Tauri)

Ce projet utilise **Tauri** pour créer des applications exécutables légères et performantes pour Windows, macOS, Linux, Android et iOS.

## Pourquoi Tauri ?

**Tauri est beaucoup plus léger et performant qu'Electron** :
- Taille des exécutables : ~5-10 MB (vs 100+ MB avec Electron)
- Utilise les WebViews natives du système (pas d'embarquement de Chromium)
- Excellent pour les applications nécessitant de la fluidité (comme Piano Teacher)
- Consommation mémoire réduite

## Prérequis

### Tous les systèmes
- Node.js et npm installés
- Rust installé ([rustup.rs](https://rustup.rs/))

### Dépendances système

#### macOS
```bash
xcode-select --install
```

#### Windows
- Microsoft Visual Studio C++ Build Tools
- WebView2 (généralement déjà installé sur Windows 10/11)

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

## Installation

```bash
npm install
```

## Scripts de Build Disponibles

### Mode Développement
```bash
npm run tauri:dev
```
Lance l'application dans une fenêtre native avec hot-reload. **Recommandé pour le développement.**

### Build pour Windows (.exe)
```bash
npm run build:win
```
Crée un installateur MSI et un exécutable pour Windows 64-bit.

**Sortie** : `src-tauri/target/release/bundle/msi/` et `src-tauri/target/release/bundle/nsis/`

### Build pour macOS (.dmg et .app)
```bash
npm run build:mac
```
Crée une application universelle (Intel + Apple Silicon) et un .dmg.

**Sortie** : `src-tauri/target/release/bundle/dmg/` et `src-tauri/target/release/bundle/macos/`

### Build pour Linux (.deb et .AppImage)
```bash
npm run build:linux
```
Crée un paquet .deb et une AppImage pour Linux 64-bit.

**Sortie** : `src-tauri/target/release/bundle/deb/` et `src-tauri/target/release/bundle/appimage/`

### Build pour Android (.apk et .aab)

#### Prérequis Android
1. **Android Studio** installé avec SDK Android
2. **Java JDK 17+** installé
3. **Android NDK** installé via Android Studio
4. Variables d'environnement configurées :
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export NDK_HOME=$ANDROID_HOME/ndk/[VERSION]
   ```

#### Initialisation Android (première fois)
```bash
npm run tauri android init
```
Cette commande génère le projet Android dans `src-tauri/gen/android/`.

#### Développement Android
```bash
npm run tauri android dev
```
Lance l'application sur un émulateur ou appareil connecté avec hot-reload.

#### Build Android
```bash
# Build APK (debug)
npm run tauri android build

# Build APK (release, signé)
npm run tauri android build --release

# Build AAB pour Google Play Store
npm run tauri android build --release --apk --split-per-abi
```

**Sortie** : `src-tauri/gen/android/app/build/outputs/`

#### Configuration de signature Android
Pour publier sur le Play Store, créez un keystore :
```bash
keytool -genkey -v -keystore piano-teacher.keystore -alias piano-teacher -keyalg RSA -keysize 2048 -validity 10000
```

Puis configurez dans `src-tauri/gen/android/app/build.gradle.kts`.

### Build pour iOS (.app et .ipa)

#### Prérequis iOS
1. **macOS** requis
2. **Xcode 15+** installé
3. **Compte Apple Developer** (pour déploiement sur appareil et App Store)
4. **CocoaPods** installé :
   ```bash
   sudo gem install cocoapods
   ```

#### Initialisation iOS (première fois)
```bash
npm run tauri ios init
```
Cette commande génère le projet Xcode dans `src-tauri/gen/ios/`.

#### Développement iOS
```bash
# Lancer sur simulateur
npm run tauri ios dev

# Lancer sur appareil physique
npm run tauri ios dev --device
```

#### Build iOS
```bash
# Build pour simulateur
npm run tauri ios build

# Build pour appareil (release)
npm run tauri ios build --release

# Build IPA pour TestFlight/App Store
npm run tauri ios build --release --export-method app-store
```

**Sortie** : `src-tauri/gen/ios/build/`

#### Publication sur App Store
1. Ouvrez le projet dans Xcode : `src-tauri/gen/ios/piano_teacher.xcodeproj`
2. Configurez votre profil de provisioning et certificat
3. Utilisez Xcode pour archiver et soumettre à App Store Connect

### Build pour toutes les plateformes (Desktop)
```bash
npm run build:all
```
Crée les exécutables pour Windows, macOS et Linux en une seule commande.

**Note** : La cross-compilation peut ne pas fonctionner pour toutes les plateformes. Il est recommandé de build sur chaque système natif.

## Localisation des Builds

### Desktop
Tous les exécutables desktop sont créés dans `src-tauri/target/release/bundle/` :

```
src-tauri/target/release/bundle/
├── dmg/
│   └── Piano Teacher_0.0.0_universal.dmg       (macOS)
├── macos/
│   └── Piano Teacher.app                        (macOS)
├── msi/
│   └── Piano Teacher_0.0.0_x64_en-US.msi       (Windows)
├── nsis/
│   └── Piano Teacher_0.0.0_x64-setup.exe       (Windows)
├── deb/
│   └── piano-teacher_0.0.0_amd64.deb           (Linux)
└── appimage/
    └── piano-teacher_0.0.0_amd64.AppImage      (Linux)
```

### Mobile
Les builds mobiles sont dans leurs dossiers respectifs :

**Android** : `src-tauri/gen/android/app/build/outputs/`
```
apk/
├── debug/
│   └── app-debug.apk
└── release/
    └── app-release.apk
bundle/
└── release/
    └── app-release.aab                          (Google Play Store)
```

**iOS** : `src-tauri/gen/ios/build/`
```
Build/Products/
├── Debug-iphonesimulator/
│   └── Piano Teacher.app                        (Simulateur)
└── Release-iphoneos/
    └── Piano Teacher.app                        (Appareil)
```

## Avantages de Tauri pour Piano Teacher

1. **Performance** : Utilisation des WebViews natives = meilleure fluidité pour les animations MIDI
2. **Légèreté** : Binaires 10-20x plus petits qu'avec Electron
3. **Mémoire** : Consommation réduite, idéal pour les applications audio
4. **Sécurité** : Architecture plus sécurisée par défaut
5. **Développement** : Même code React, simplement empaqueté différemment

## Commandes Utiles

### Desktop
```bash
# Lancer en mode dev avec console Rust
npm run tauri:dev

# Build en mode release (optimisé)
npm run tauri:build

# Build uniquement le frontend (sans l'app native)
npm run build

# Lancer le dev server Vite uniquement
npm run dev
```

### Mobile
```bash
# Android - Initialisation
npm run tauri android init

# Android - Dev avec hot-reload
npm run tauri android dev

# Android - Build release
npm run tauri android build --release

# iOS - Initialisation
npm run tauri ios init

# iOS - Dev sur simulateur
npm run tauri ios dev

# iOS - Dev sur appareil
npm run tauri ios dev --device

# iOS - Build release
npm run tauri ios build --release
```

## Personnalisation

### Icônes
Les icônes sont dans `src-tauri/icons/`. Pour les remplacer :
1. Placez vos images dans ce dossier
2. Utilisez `npm run tauri icon` pour générer toutes les tailles

### Configuration
Modifiez `src-tauri/tauri.conf.json` pour :
- Changer la taille de la fenêtre
- Ajouter des permissions
- Configurer les menus natifs
- Personnaliser les builds

## Dépannage

### Desktop

#### "Command not found: tauri"
```bash
npm install
```

#### Erreurs de compilation Rust
Vérifiez que Rust est installé : `rustc --version`

#### Build échoue sur macOS
Assurez-vous d'avoir Xcode Command Line Tools : `xcode-select --install`

#### Build échoue sur Linux
Installez toutes les dépendances système listées ci-dessus.

### Android

#### "ANDROID_HOME not found"
Configurez les variables d'environnement :
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

#### "NDK not found"
Installez NDK via Android Studio :
1. Ouvrez Android Studio
2. Settings → Appearance & Behavior → System Settings → Android SDK
3. SDK Tools → NDK (Side by side)
4. Apply

#### "No connected devices"
Pour un émulateur :
```bash
# Lister les AVD disponibles
emulator -list-avds

# Lancer un émulateur
emulator -avd [NOM_AVD]
```

Pour un appareil physique :
1. Activez le mode développeur sur Android
2. Activez le débogage USB
3. Connectez via USB et acceptez l'autorisation

#### Erreur de signature
Pour les builds release, configurez votre keystore dans `src-tauri/gen/android/app/build.gradle.kts`.

### iOS

#### "Xcode is not installed"
Installez Xcode depuis le Mac App Store (15+ recommandé).

#### "No provisioning profile found"
1. Ouvrez le projet dans Xcode : `src-tauri/gen/ios/piano_teacher.xcodeproj`
2. Sélectionnez le target "piano_teacher"
3. Signing & Capabilities → Cochez "Automatically manage signing"
4. Sélectionnez votre Apple Developer Team

#### "Could not find simulator"
Listez les simulateurs disponibles :
```bash
xcrun simctl list devices
```

Créez un nouveau simulateur via Xcode → Window → Devices and Simulators.

#### Erreur CocoaPods
Réinstallez les dépendances :
```bash
cd src-tauri/gen/ios
pod deintegrate
pod install
```

## Différences avec le navigateur web

L'application Tauri offre :
- Fenêtre native de l'OS (meilleure intégration)
- Pas de barre d'adresse ni d'onglets
- Possibilité d'accéder aux API système (fichiers, notifications, etc.)
- Démarrage comme une vraie application
- Meilleure performance globale

## Notes Importantes pour les Builds Mobiles

### Android
- **Première initialisation** : `npm run tauri android init` doit être exécuté une seule fois
- **Permissions** : Configurez les permissions Android dans `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
- **API Level** : Tauri supporte Android 7.0+ (API 24+)
- **Taille APK** : Les APK Tauri sont significativement plus petits que React Native (5-15 MB vs 25-50 MB)

### iOS
- **macOS requis** : Les builds iOS ne peuvent être faits que sur macOS
- **Certificats** : Compte Apple Developer requis pour tester sur appareil réel (99$/an)
- **TestFlight** : Gratuit pour tester avec jusqu'à 10,000 utilisateurs externes
- **Simulateur** : Gratuit et ne nécessite pas de compte développeur
- **Taille IPA** : Comparable aux apps natives Swift (~10-20 MB)

### Performance Mobile
- **WebView natif** : Utilise WKWebView (iOS) et WebView2 (Android)
- **Pas de JS Bridge lourd** : Communication directe avec le code natif
- **Audio MIDI** : Les capacités audio peuvent varier selon la plateforme mobile
- **Optimisation** : Testez sur de vrais appareils, pas seulement sur émulateurs

## Ressources

### Documentation Officielle
- [Documentation Tauri](https://tauri.app)
- [Guide de build Desktop](https://tauri.app/v1/guides/building/)
- [Guide Mobile (v2)](https://v2.tauri.app/develop/mobile/)
- [API Tauri](https://tauri.app/v1/api/js/)

### Mobile Spécifique
- [Guide Android](https://v2.tauri.app/develop/mobile/android/)
- [Guide iOS](https://v2.tauri.app/develop/mobile/ios/)
- [Configuration Mobile](https://v2.tauri.app/reference/config/)

### Outils de Développement
- [Android Studio](https://developer.android.com/studio)
- [Xcode](https://developer.apple.com/xcode/)
- [Rust](https://rustup.rs/)

## Résumé des Commandes

```bash
# DESKTOP
npm run tauri:dev              # Dev mode desktop
npm run build:win              # Build Windows
npm run build:mac              # Build macOS
npm run build:linux            # Build Linux
npm run build:all              # Build toutes les plateformes desktop

# ANDROID
npm run tauri android init     # Initialisation (une fois)
npm run tauri android dev      # Dev mode
npm run tauri android build --release  # Build production

# iOS
npm run tauri ios init         # Initialisation (une fois)
npm run tauri ios dev          # Dev mode (simulateur)
npm run tauri ios dev --device # Dev mode (appareil)
npm run tauri ios build --release  # Build production
```
