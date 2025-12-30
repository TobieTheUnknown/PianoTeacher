# 🚀 Guide de Release - Piano Teacher

Ce document explique comment créer une nouvelle release de Piano Teacher.

## 📋 Prérequis

- Tous les changements doivent être committés et pushés
- Vous devez avoir les permissions pour créer des tags et releases sur le repo GitHub

## 🔧 Utiliser le script de release

### 1. Créer la release localement

```bash
./release.sh 1.5.0
```

Ce script va :
- ✅ Vérifier que vous n'avez pas de modifications non committées
- ✅ Mettre à jour les versions dans `package.json`, `Cargo.toml`, et `tauri.conf.json`
- ✅ Regénérer les lock files (`package-lock.json`, `Cargo.lock`)
- ✅ Créer un commit de release avec changelog
- ✅ Créer un tag Git annoté `v1.5.0` avec notes de release

### 2. Merger sur la branche principale

```bash
# Créer une Pull Request
gh pr create --title "Release v1.5.0" --body "Release version 1.5.0"

# OU merger directement si vous êtes sur main
git checkout main
git merge claude/midi-input-settings-2s0Yy
```

### 3. Pousser le tag pour déclencher GitHub Actions

```bash
git push origin main
git push origin v1.5.0
```

### 4. GitHub Actions va automatiquement :

- 🏗️ Builder l'application pour **macOS** (Universal Binary), **Windows**, et **Linux**
- 📦 Créer une **GitHub Release** avec le tag
- ⬆️ Upload les binaires compilés (.dmg, .exe, .AppImage, .deb)
- 📝 Générer les notes de release avec instructions d'installation

## 📦 Résultat de la Release

Une fois GitHub Actions terminé (environ 15-20 minutes), vous aurez :

### macOS
- `Piano Teacher_1.5.0_universal.dmg` - Fonctionne sur Intel et Apple Silicon

### Windows
- `Piano Teacher_1.5.0_x64-setup.exe` - Installateur Windows

### Linux
- `piano-teacher_1.5.0_amd64.AppImage` - Portable (recommandé)
- `piano-teacher_1.5.0_amd64.deb` - Package Debian/Ubuntu

## 🔍 Vérifier le statut du build

### Via GitHub UI
1. Aller sur https://github.com/TobieTheUnknown/Piano/actions
2. Cliquer sur le workflow "Release Build"
3. Vérifier que tous les jobs sont verts ✅

### Via CLI
```bash
gh run list --workflow=release.yml
gh run view --log  # Pour voir les logs du dernier run
```

## 🎯 Checklist de Release

Avant de créer une release, vérifier :

- [ ] Tous les tests passent
- [ ] L'application fonctionne en dev (`npm run dev`)
- [ ] L'application fonctionne en Tauri dev (`npm run tauri:dev`)
- [ ] Le MIDI fonctionne (navigateur et Tauri)
- [ ] Les exports fonctionnent
- [ ] La calibration de latence fonctionne
