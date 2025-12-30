# 🚀 Instructions de Build - Piano Teacher

Guide rapide pour créer des exécutables pour toutes les plateformes.

---

## 📋 Prérequis Communs (À faire UNE FOIS)

### 1. Installer Node.js
Déjà installé ✅

### 2. Installer Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env  # Ou redémarrer le terminal
```

Vérifier l'installation :
```bash
rustc --version
```

### 3. Installer les dépendances du projet
```bash
npm install
```

---

## 💻 BUILD DESKTOP

### Windows (.exe)

**Sur Windows uniquement**

**Prérequis :**
- Visual Studio C++ Build Tools
- WebView2 (déjà installé sur Windows 10/11)

**Build :**
```bash
npm run build:win
```

**Sortie :** `src-tauri/target/release/bundle/nsis/Piano Teacher_0.0.0_x64-setup.exe`

---

### macOS (.dmg)

**Sur macOS uniquement**

**Prérequis :**
```bash
xcode-select --install
```

**Build :**
```bash
npm run build:mac
```

**Sortie :**
- `src-tauri/target/release/bundle/dmg/Piano Teacher_0.0.0_universal.dmg`
- `src-tauri/target/release/bundle/macos/Piano Teacher.app`

Le build est **universal** (fonctionne sur Intel ET Apple Silicon M1/M2/M3)

---

### Linux (.deb et .AppImage)

**Sur Linux (Ubuntu/Debian)**

**Prérequis :**
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

**Build :**
```bash
npm run build:linux
```

**Sortie :**
- `src-tauri/target/release/bundle/deb/piano-teacher_0.0.0_amd64.deb`
- `src-tauri/target/release/bundle/appimage/piano-teacher_0.0.0_amd64.AppImage`

---

## 📱 BUILD MOBILE

### Android (APK)

**Sur macOS, Linux ou Windows**

#### Étape 1 : Installer Android Studio

Télécharger et installer : https://developer.android.com/studio

#### Étape 2 : Installer NDK

Dans Android Studio :
1. Settings (⌘, sur Mac)
2. Appearance & Behavior → System Settings → Android SDK
3. Onglet "SDK Tools"
4. Cocher :
   - ✅ NDK (Side by side)
   - ✅ Android SDK Command-line Tools
5. Cliquer "Apply"

#### Étape 3 : Variables d'environnement

**macOS/Linux** - Ajouter à `~/.zshrc` ou `~/.bashrc` :
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export NDK_HOME=$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

Puis :
```bash
source ~/.zshrc  # ou source ~/.bashrc
```

**Windows** - Variables d'environnement système :
```
ANDROID_HOME = C:\Users\VotreNom\AppData\Local\Android\Sdk
NDK_HOME = %ANDROID_HOME%\ndk\<version>
```

#### Étape 4 : Accepter les licences
```bash
sdkmanager --licenses
```
Appuyer sur `y` pour tout accepter.

#### Étape 5 : Installer les cibles Rust
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

#### Étape 6 : Initialiser Android (1 FOIS)
```bash
npm run android:init
```

Cela crée le dossier `src-tauri/gen/android/`.

#### Étape 7 : Build l'APK
```bash
# APK de debug (pour tester)
npm run build:android:apk

# APK de release (pour distribuer)
npm run build:android
```

**Sortie :** `src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk`

#### Installer l'APK sur un téléphone

**Via USB :**
1. Activer le mode développeur (Paramètres → À propos → Appuyer 7x sur "Numéro de build")
2. Activer le débogage USB (Paramètres → Options développeur)
3. Connecter le téléphone en USB
4. Vérifier : `adb devices`
5. Installer : `adb install src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk`

**Via fichier :**
- Copier l'APK sur le téléphone
- Ouvrir le fichier sur le téléphone pour installer

---

### iOS (App iOS)

**Sur macOS UNIQUEMENT**

#### Étape 1 : Installer Xcode

Depuis l'App Store (gratuit).

#### Étape 2 : Installer les cibles Rust
```bash
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

#### Étape 3 : Initialiser iOS (1 FOIS)
```bash
npm run ios:init
```

#### Étape 4 : Build
```bash
npm run build:ios
```

**Sortie :** `src-tauri/gen/ios/build/`

**Note :** Pour distribuer sur l'App Store, vous devez :
- Avoir un compte Apple Developer (99$/an)
- Configurer la signature de code dans Xcode

---

## 🧪 MODE DÉVELOPPEMENT

Pour tester sans créer les exécutables :

```bash
# Desktop (macOS/Windows/Linux)
npm run tauri:dev

# Android (avec émulateur ou appareil)
npm run android:dev

# iOS (avec simulateur)
npm run ios:dev
```

---

## 📦 Résumé des Commandes

| Plateforme | Commande | Fichier généré |
|-----------|----------|----------------|
| Windows | `npm run build:win` | `.exe` (~10 MB) |
| macOS | `npm run build:mac` | `.dmg` (~8 MB) |
| Linux | `npm run build:linux` | `.deb` + `.AppImage` (~10 MB) |
| Android | `npm run build:android:apk` | `.apk` (~12 MB) |
| iOS | `npm run build:ios` | `.app` (~10 MB) |

---

## ❓ Problèmes Fréquents

### "Command not found: tauri"
```bash
npm install
```

### "rustc not found" ou "cargo not found"
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### "ANDROID_HOME not set"
Vérifier que les variables d'environnement sont bien configurées et redémarrer le terminal.

### Build échoue sur macOS
```bash
xcode-select --install
```

### Build échoue sur Linux
Installer toutes les dépendances listées dans la section Linux ci-dessus.

### APK ne s'installe pas
- Activer "Sources inconnues" dans les paramètres Android
- Pour release APK, signer l'APK avec une clé

---

## 📚 Documentation Complète

Pour plus de détails, voir **BUILD.md**

---

## ⚡ Build Rapide (si tout est configuré)

```bash
# Desktop
npm run build:mac        # ou build:win ou build:linux

# Mobile
npm run build:android:apk
npm run build:ios
```

C'est tout ! 🎉
