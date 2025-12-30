#!/bin/bash

# Script de release pour Piano Teacher
# Usage: ./release.sh <version>
# Exemple: ./release.sh 1.5.0

set -e  # Exit on error

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "❌ Erreur: Veuillez spécifier une version"
    echo "Usage: ./release.sh <version>"
    echo "Exemple: ./release.sh 1.5.0"
    exit 1
fi

echo "🚀 Préparation de la release v$VERSION"
echo ""

# Vérifier qu'on est sur une branche propre
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Erreur: Vous avez des modifications non commitées"
    echo "Veuillez commiter ou stasher vos changements avant de continuer"
    exit 1
fi

echo "📝 Mise à jour des fichiers de version..."

# Mettre à jour package.json
if command -v jq &> /dev/null; then
    jq ".version = \"$VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
    # Fallback sans jq
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json && rm package.json.bak
fi

# Mettre à jour src-tauri/tauri.conf.json
if command -v jq &> /dev/null; then
    jq ".version = \"$VERSION\"" src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json
else
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json && rm src-tauri/tauri.conf.json.bak
fi

# Mettre à jour src-tauri/Cargo.toml
sed -i.bak "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml && rm src-tauri/Cargo.toml.bak

echo "✅ Fichiers de version mis à jour"
echo ""

# Regénérer package-lock.json et Cargo.lock
echo "🔄 Mise à jour des lock files..."
npm install --package-lock-only
cd src-tauri && cargo update && cd ..
echo "✅ Lock files mis à jour"
echo ""

# Afficher les changements
echo "📋 Changements détectés:"
git diff package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
echo ""

# Demander confirmation
read -p "⚠️  Voulez-vous continuer avec ces changements? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release annulée"
    git checkout package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml package-lock.json src-tauri/Cargo.lock
    exit 1
fi

# Créer le commit de release
echo "📦 Création du commit de release..."
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: Release v$VERSION

Features:
- Native MIDI support for desktop app (Tauri)
- MIDI latency calibration (visual & audio)
- Export songs/library with native file dialogs
- Improved MIDI visualization with blue glow effects
- Fixed black piano key alignment

Technical:
- Tauri v2 integration with midir
- Static imports for Tauri APIs
- Environment variable based Tauri detection
- Optimized keyboard rendering
"

echo "✅ Commit créé"
echo ""

# Créer le tag
echo "🏷️  Création du tag v$VERSION..."
git tag -a "v$VERSION" -m "Release v$VERSION

Piano Teacher v$VERSION

Major Features:
✨ Native MIDI support for desktop app
✨ MIDI latency calibration (visual & audio modes)
✨ Native file save dialogs for exports
✨ Enhanced MIDI visualization
✨ Improved keyboard UI

Fixes:
🐛 Black piano keys now properly aligned
🐛 Tauri v2 detection using environment variables
🐛 MIDI connection stability improvements

Technical Improvements:
⚡ Static imports for better bundle optimization
⚡ Removed unused code and imports
⚡ Canvas glow effects for pressed keys
"

echo "✅ Tag créé"
echo ""

# Afficher les informations de la release
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Release v$VERSION prête!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 Commit: $(git rev-parse HEAD)"
echo "🏷️  Tag: v$VERSION"
echo ""
echo "Pour pousser la release sur GitHub:"
echo "  git push origin $(git branch --show-current)"
echo "  git push origin v$VERSION"
echo ""
echo "Pour builder les applications desktop:"
echo "  npm run tauri:build"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
