# Guide de Build - Piano Teacher (Tauri)

Ce projet utilise **Tauri** pour créer des applications exécutables légères et performantes pour Windows, macOS et Linux.

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

### Build pour toutes les plateformes
```bash
npm run build:all
```
Crée les exécutables pour Windows, macOS et Linux en une seule commande.

**Note** : La cross-compilation peut ne pas fonctionner pour toutes les plateformes. Il est recommandé de build sur chaque système natif.

## Localisation des Builds

Tous les exécutables sont créés dans `src-tauri/target/release/bundle/` avec la structure suivante :

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

## Avantages de Tauri pour Piano Teacher

1. **Performance** : Utilisation des WebViews natives = meilleure fluidité pour les animations MIDI
2. **Légèreté** : Binaires 10-20x plus petits qu'avec Electron
3. **Mémoire** : Consommation réduite, idéal pour les applications audio
4. **Sécurité** : Architecture plus sécurisée par défaut
5. **Développement** : Même code React, simplement empaqueté différemment

## Commandes Utiles

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

### "Command not found: tauri"
```bash
npm install
```

### Erreurs de compilation Rust
Vérifiez que Rust est installé : `rustc --version`

### Build échoue sur macOS
Assurez-vous d'avoir Xcode Command Line Tools : `xcode-select --install`

### Build échoue sur Linux
Installez toutes les dépendances système listées ci-dessus.

## Différences avec le navigateur web

L'application Tauri offre :
- Fenêtre native de l'OS (meilleure intégration)
- Pas de barre d'adresse ni d'onglets
- Possibilité d'accéder aux API système (fichiers, notifications, etc.)
- Démarrage comme une vraie application
- Meilleure performance globale

---

## 📱 Builds Mobile (Android & iOS)

Tauri v2 supporte également Android et iOS ! Vous pouvez créer des APK et des applications iOS.

### Prérequis Android

1. **Installer Android Studio** : [developer.android.com/studio](https://developer.android.com/studio)

2. **Installer le NDK (Native Development Kit)** via Android Studio :
   - Ouvrir Android Studio
   - Settings → Appearance & Behavior → System Settings → Android SDK
   - Onglet "SDK Tools"
   - Cocher "NDK (Side by side)" et "Android SDK Command-line Tools"
   - Cliquer "Apply"

3. **Configurer les variables d'environnement** :

   **macOS/Linux** (ajouter à `~/.zshrc` ou `~/.bashrc`) :
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export NDK_HOME=$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
   ```

   **Windows** (PowerShell) :
   ```powershell
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:NDK_HOME = "$env:ANDROID_HOME\ndk\<version>"
   ```

4. **Accepter les licences Android** :
   ```bash
   sdkmanager --licenses
   ```

5. **Installer les cibles Rust Android** :
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

### Initialiser Android

**Une seule fois** pour configurer le projet :
```bash
npm run android:init
```

Cela crée le dossier `gen/android/` avec toute la configuration Android.

### Développement Android

```bash
# Lancer sur un émulateur ou appareil connecté
npm run android:dev
```

**Note** : Vous devez avoir un émulateur Android lancé ou un appareil physique connecté en USB avec le débogage USB activé.

### Build Android (APK)

```bash
# Build APK de debug (pour tester)
npm run build:android:apk

# Build APK de release (pour distribution)
npm run build:android
```

**Sortie** : `src-tauri/gen/android/app/build/outputs/apk/`

Les APK seront dans :
- `debug/` → APK de test non signé
- `release/` → APK signé pour distribution (nécessite une clé de signature)

### Prérequis iOS

**Uniquement sur macOS !**

1. **Xcode** (depuis l'App Store)

2. **Simulateur iOS** (inclus avec Xcode)

3. **Compte Apple Developer** (pour déployer sur appareil réel)

4. **Installer les cibles Rust iOS** :
   ```bash
   rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
   ```

### Initialiser iOS

```bash
npm run ios:init
```

### Développement iOS

```bash
# Lancer sur le simulateur iOS
npm run ios:dev
```

### Build iOS

```bash
npm run build:ios
```

**Sortie** : `src-tauri/gen/ios/build/`

**Note** : Pour distribuer sur l'App Store, vous devez configurer la signature de code avec votre certificat Apple Developer dans Xcode.

### Tester l'APK sur votre téléphone

1. **Activer le mode développeur** sur votre téléphone Android :
   - Paramètres → À propos du téléphone
   - Appuyer 7 fois sur "Numéro de build"

2. **Activer le débogage USB** :
   - Paramètres → Options pour les développeurs
   - Activer "Débogage USB"

3. **Connecter votre téléphone** en USB

4. **Vérifier la connexion** :
   ```bash
   adb devices
   ```

5. **Installer l'APK** :
   ```bash
   adb install src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Configuration spécifique mobile

Pour adapter l'interface aux mobiles, vous pouvez détecter la plateforme :

```javascript
import { platform } from '@tauri-apps/plugin-os';

const currentPlatform = await platform();
// Retourne 'android', 'ios', 'macos', 'windows', 'linux'

if (currentPlatform === 'android' || currentPlatform === 'ios') {
  // Afficher l'interface mobile
} else {
  // Afficher l'interface desktop
}
```

### Permissions Android

Pour accéder au microphone, stockage, etc., modifiez `gen/android/app/src/main/AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### Taille des APK

Les APK Tauri sont très légers :
- **Debug** : ~15-20 MB
- **Release** : ~8-12 MB (avec optimisations)

Beaucoup plus léger que React Native ou Flutter !

---

## Résumé des commandes

```bash
# Desktop
npm run tauri:dev          # Dev desktop
npm run build:win          # Build Windows
npm run build:mac          # Build macOS
npm run build:linux        # Build Linux

# Android
npm run android:init       # Init Android (1 fois)
npm run android:dev        # Dev Android
npm run build:android:apk  # Build APK

# iOS
npm run ios:init           # Init iOS (1 fois)
npm run ios:dev            # Dev iOS
npm run build:ios          # Build iOS
```

## Ressources

- [Documentation Tauri](https://tauri.app)
- [Guide de build Tauri](https://tauri.app/v1/guides/building/)
- [API Tauri](https://tauri.app/v1/api/js/)
- [Guide Mobile Tauri](https://tauri.app/start/prerequisites/#mobile)
- [Configuration Android](https://developer.android.com/studio/install)
