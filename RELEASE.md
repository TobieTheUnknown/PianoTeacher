# 🚀 Guide de Release - Piano Teacher

Ce document explique comment créer une nouvelle release et mettre les exécutables à disposition des utilisateurs.

---

## 📦 Étape 1 : Construire les Exécutables

### Option A : Build sur Machines Natives (Recommandé)

Pour obtenir les meilleurs résultats, construisez chaque exécutable sur sa plateforme native :

#### Sur Windows :
```bash
npm install
npm run build:win
```
**Fichier généré :** `src-tauri/target/release/bundle/nsis/Piano Teacher_1.0.0_x64-setup.exe`

#### Sur macOS :
```bash
npm install
npm run build:mac
```
**Fichiers générés :**
- `src-tauri/target/release/bundle/dmg/Piano Teacher_1.0.0_universal.dmg`
- `src-tauri/target/release/bundle/macos/Piano Teacher.app` (optionnel)

#### Sur Linux (Ubuntu/Debian) :
```bash
npm install
npm run build:linux
```
**Fichiers générés :**
- `src-tauri/target/release/bundle/deb/piano-teacher_1.0.0_amd64.deb`
- `src-tauri/target/release/bundle/appimage/piano-teacher_1.0.0_amd64.AppImage`

### Option B : Utiliser GitHub Actions (Automatisé)

Si vous avez configuré GitHub Actions, vous pouvez construire automatiquement pour toutes les plateformes :

1. Push votre code vers GitHub
2. Créer un tag de version (voir Étape 2)
3. Les workflows GitHub Actions construiront automatiquement tous les exécutables

---

## 🏷️ Étape 2 : Créer un Tag Git

Avant de créer la release, créez un tag de version :

```bash
# Vérifier que tout est commité
git status

# Créer un tag annoté
git tag -a v1.0.0 -m "Version 1.0.0 - Initial Release"

# Pousser le tag vers GitHub
git push origin v1.0.0
```

---

## 🎉 Étape 3 : Créer la Release sur GitHub

### Méthode 1 : Interface Web GitHub

1. **Aller sur GitHub** : https://github.com/TobieTheUnknown/Piano/releases

2. **Cliquer sur "Draft a new release"**

3. **Configurer la release :**
   - **Tag version** : `v1.0.0` (sélectionner le tag créé précédemment)
   - **Release title** : `Piano Teacher v1.0.0`
   - **Description** : Copier-coller le template ci-dessous

4. **Uploader les exécutables :**
   - Faire glisser les fichiers dans la zone "Attach binaries"
   - Fichiers à uploader :
     - ✅ `Piano Teacher_1.0.0_x64-setup.exe` (Windows)
     - ✅ `Piano Teacher_1.0.0_universal.dmg` (macOS)
     - ✅ `piano-teacher_1.0.0_amd64.AppImage` (Linux)
     - ✅ `piano-teacher_1.0.0_amd64.deb` (Linux - optionnel)

5. **Publier :**
   - Cocher "Set as the latest release" si c'est la version la plus récente
   - Cliquer sur "Publish release"

### Méthode 2 : GitHub CLI (gh)

```bash
# Installer GitHub CLI si nécessaire : https://cli.github.com/

# Créer la release avec les fichiers
gh release create v1.0.0 \
  --title "Piano Teacher v1.0.0" \
  --notes-file RELEASE_NOTES.md \
  src-tauri/target/release/bundle/nsis/*.exe \
  src-tauri/target/release/bundle/dmg/*.dmg \
  src-tauri/target/release/bundle/appimage/*.AppImage \
  src-tauri/target/release/bundle/deb/*.deb
```

---

## 📝 Template de Description de Release

```markdown
# 🎹 Piano Teacher v1.0.0

**Date de release :** 29 décembre 2025

## 🎉 Release Initiale

Première version stable de Piano Teacher, une application d'apprentissage du piano interactive.

## ✨ Fonctionnalités principales

- 📚 **Bibliothèque de morceaux** avec interface Glassmorphism
- ✏️ **Éditeur Piano Roll** avec import MIDI intelligent
- 📖 **Mode Apprentissage** avec analyse harmonique et filtrage par main
- 🎹 **Mode Synthesia** avec code couleur MG/MD et contrôle de tempo
- 💾 **Persistance locale** - Toutes vos données restent sur votre appareil

## 📥 Téléchargement

Choisissez le fichier correspondant à votre système d'exploitation :

### Windows
- **Piano Teacher_1.0.0_x64-setup.exe** (≈10 MB)
  - Double-cliquez pour installer
  - Fonctionne sur Windows 10 et 11

### macOS
- **Piano Teacher_1.0.0_universal.dmg** (≈8 MB)
  - Double-cliquez pour ouvrir
  - Glissez Piano Teacher vers Applications
  - Fonctionne sur Intel ET Apple Silicon (M1/M2/M3)

### Linux
- **piano-teacher_1.0.0_amd64.AppImage** (≈10 MB)
  - Rendre exécutable : `chmod +x piano-teacher_1.0.0_amd64.AppImage`
  - Lancer : `./piano-teacher_1.0.0_amd64.AppImage`

- **piano-teacher_1.0.0_amd64.deb** (≈10 MB)
  - Installer : `sudo dpkg -i piano-teacher_1.0.0_amd64.deb`
  - Pour Ubuntu/Debian

## 🐛 Corrections notables

- ✅ Fix des notes aux frontières de mesures (précision flottante)
- ✅ Persistance des mesures surlignées dans Live Learning
- ✅ Affichage de tous les accords par mesure

## 📚 Documentation

- [README](https://github.com/TobieTheUnknown/Piano/blob/main/README.md)
- [Guide de Build](https://github.com/TobieTheUnknown/Piano/blob/main/BUILD_INSTRUCTIONS.md)
- [Thèmes](https://github.com/TobieTheUnknown/Piano/blob/main/THEMES.md)

## 🙏 Remerciements

Merci à tous ceux qui ont contribué et testé cette application !

---

**Note :** Cette application fonctionne entièrement en local. Aucune donnée n'est envoyée vers un serveur externe.

🎵 **Bon apprentissage du piano !** 🎹
```

---

## 📋 Checklist de Release

Avant de publier :

- [ ] Version mise à jour dans `package.json`
- [ ] Version mise à jour dans `src-tauri/tauri.conf.json`
- [ ] README.md à jour
- [ ] CHANGELOG.md mis à jour (si vous en avez un)
- [ ] Tous les tests passent
- [ ] Builds testés sur chaque plateforme
- [ ] Tag Git créé et poussé
- [ ] Release GitHub créée
- [ ] Exécutables uploadés
- [ ] Description de release complétée
- [ ] Release publiée

---

## 🔄 Après la Release

1. **Annoncer la release** :
   - Sur les réseaux sociaux
   - Sur les forums pertinents
   - Par email aux testeurs bêta

2. **Surveiller les issues** :
   - Répondre rapidement aux bugs signalés
   - Planifier les hotfixes si nécessaire

3. **Préparer la prochaine version** :
   - Créer une branche `develop` ou `next`
   - Mettre à jour la roadmap

---

## 🆘 Problèmes Fréquents

### "Les utilisateurs ne trouvent pas le téléchargement"
- Vérifier que la release est marquée comme "Latest"
- Ajouter un lien direct dans le README

### "L'exécutable est bloqué par l'antivirus"
- Windows SmartScreen : Normal pour les nouveaux développeurs
- Les utilisateurs doivent cliquer sur "Plus d'infos" → "Exécuter quand même"
- Solution long terme : Signer le code avec un certificat de confiance

### "L'app ne s'ouvre pas sur macOS"
- L'utilisateur doit faire clic droit → "Ouvrir" la première fois
- Ou exécuter : `xattr -cr /Applications/Piano\ Teacher.app`
- Solution long terme : Notariser l'app avec Apple

### "Permission denied sur Linux"
- Pour AppImage : `chmod +x piano-teacher_1.0.0_amd64.AppImage`

---

## 📖 Ressources

- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Tauri Distribution Guide](https://tauri.app/distribute/)
- [Semantic Versioning](https://semver.org/)

---

**Bonne release ! 🚀**
