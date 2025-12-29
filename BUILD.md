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

## Ressources

- [Documentation Tauri](https://tauri.app)
- [Guide de build Tauri](https://tauri.app/v1/guides/building/)
- [API Tauri](https://tauri.app/v1/api/js/)
