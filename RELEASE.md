# 🚀 Guide de Release - Piano Teacher

Ce document explique comment créer une nouvelle release et mettre les exécutables à disposition des utilisateurs.

---

## ⚡ TL;DR - Démarrage Rapide

Pour sortir une nouvelle version avec GitHub Actions (tout est automatisé) :

```bash
# 1. Mettre à jour les versions
# Éditer package.json et src-tauri/tauri.conf.json
# Changer "version": "1.0.0" vers "1.1.0" (par exemple)

# 2. Commiter et pusher
git add .
git commit -m "Bump version to 1.1.0"
git push origin main

# 3. Créer et pusher le tag
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# 4. Attendre 15-20 minutes
# Aller sur https://github.com/TobieTheUnknown/Piano/actions
# Le workflow build automatiquement pour Windows, macOS et Linux
# La release est créée et les fichiers sont uploadés automatiquement !
```

**C'est tout ! ✨** Continuez à lire pour plus de détails.

---

## ⚡ Méthode Recommandée : GitHub Actions (Automatisé)

**Le projet est maintenant configuré avec GitHub Actions pour automatiser complètement le processus de release !**

### 📋 Processus Simplifié

1. **Mettre à jour les versions** (déjà fait pour v1.0.0)
   - `package.json` → `"version": "1.0.0"`
   - `src-tauri/tauri.conf.json` → `"version": "1.0.0"`

2. **Commiter et pusher les changements**
   ```bash
   git add .
   git commit -m "Bump version to 1.0.0"
   git push origin main
   ```

3. **Créer et pusher un tag de version**
   ```bash
   # Créer un tag annoté
   git tag -a v1.0.0 -m "Release v1.0.0"

   # Pusher le tag vers GitHub
   git push origin v1.0.0
   ```

4. **🎉 C'est tout !**
   - GitHub Actions détecte automatiquement le tag `v1.0.0`
   - Les builds pour Windows, macOS et Linux se lancent en parallèle
   - Une release GitHub est créée automatiquement
   - Tous les exécutables sont uploadés vers la release
   - La release est marquée comme "Latest"

### 🔍 Suivre la Progression

Après avoir pushé le tag, suivez le build ici :
```
https://github.com/TobieTheUnknown/Piano/actions
```

Le workflow prend environ **15-20 minutes** pour compléter tous les builds.

### ✅ Fichiers Générés Automatiquement

Le workflow créera automatiquement :

- **Windows** : `Piano Teacher_1.0.0_x64-setup.exe`
- **macOS** : `Piano Teacher_1.0.0_universal.dmg` (Intel + Apple Silicon)
- **Linux** :
  - `piano-teacher_1.0.0_amd64.AppImage`
  - `piano-teacher_1.0.0_amd64.deb`

### 🔧 Workflow GitHub Actions

Le workflow `.github/workflows/release.yml` :

1. **Se déclenche** sur les tags matchant `v*.*.*`
2. **Crée la release** GitHub avec une description formatée
3. **Build en parallèle** sur 3 runners (Windows, macOS, Linux)
4. **Upload automatiquement** tous les exécutables
5. **Marque comme latest** la nouvelle release

---

## 🛠️ Méthode Alternative : Build Manuel

Si vous préférez construire manuellement ou tester localement :

### Sur Windows :
```bash
npm install
npm run build:win
```
**Fichier généré :** `src-tauri/target/release/bundle/nsis/Piano Teacher_1.0.0_x64-setup.exe`

### Sur macOS :
```bash
npm install
npm run build:mac
```
**Fichiers générés :**
- `src-tauri/target/release/bundle/dmg/Piano Teacher_1.0.0_universal.dmg`
- `src-tauri/target/release/bundle/macos/Piano Teacher.app` (optionnel)

### Sur Linux (Ubuntu/Debian) :
```bash
npm install
npm run build:linux
```
**Fichiers générés :**
- `src-tauri/target/release/bundle/deb/piano-teacher_1.0.0_amd64.deb`
- `src-tauri/target/release/bundle/appimage/piano-teacher_1.0.0_amd64.AppImage`

Ensuite, créez manuellement la release sur GitHub et uploadez les fichiers.

---

## 🏷️ Tags Git et Versioning

### Format des Tags

Utilisez le format **Semantic Versioning** :

```bash
# Vérifier que tout est commité
git status

# Créer un tag annoté
git tag -a v1.0.0 -m "Version 1.0.0 - Initial Release"

# Pousser le tag vers GitHub
git push origin v1.0.0
```

---

## 📝 Personnaliser la Description de Release (Optionnel)

Si vous utilisez GitHub Actions, la description est générée automatiquement. Vous pouvez l'éditer après coup si nécessaire.

### Éditer une Release Existante

1. Aller sur : https://github.com/TobieTheUnknown/Piano/releases
2. Cliquer sur ✏️ "Edit" sur la release
3. Modifier la description
4. Sauvegarder

---

## 📝 Template de Description de Release

**Note :** Ce template est utilisé automatiquement par le workflow GitHub Actions. Vous pouvez le personnaliser en éditant `.github/workflows/release.yml`.

Pour référence, voici le format de description généré :

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

### Avec GitHub Actions (Automatisé)

- [ ] Version mise à jour dans `package.json`
- [ ] Version mise à jour dans `src-tauri/tauri.conf.json`
- [ ] README.md à jour
- [ ] CHANGELOG.md mis à jour (si vous en avez un)
- [ ] Changements committés et pushés vers `main`
- [ ] Tag Git créé et poussé
- [ ] ✨ GitHub Actions s'occupe du reste automatiquement !

### Avec Build Manuel (si nécessaire)

- [ ] Version mise à jour dans `package.json`
- [ ] Version mise à jour dans `src-tauri/tauri.conf.json`
- [ ] README.md à jour
- [ ] Tous les tests passent
- [ ] Builds testés sur chaque plateforme
- [ ] Tag Git créé et poussé
- [ ] Release GitHub créée manuellement
- [ ] Exécutables uploadés manuellement
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

### Workflow GitHub Actions

#### "Le workflow ne se déclenche pas"
- Vérifier que le tag commence par `v` (ex: `v1.0.0`, pas `1.0.0`)
- Vérifier que le tag a été pushé : `git push origin v1.0.0`
- Regarder l'onglet Actions : https://github.com/TobieTheUnknown/Piano/actions

#### "Le build échoue"
- Consulter les logs dans l'onglet Actions
- Vérifier que les versions dans `package.json` et `tauri.conf.json` correspondent
- S'assurer que le code build localement avec `npm run tauri:build`

#### "Erreur bundle_dmg.sh sur macOS"
- Le workflow installe automatiquement `create-dmg` pour résoudre ce problème
- Si l'erreur persiste, vérifier que Homebrew est bien installé sur le runner
- Alternative : builder manuellement sur une machine macOS locale

#### "Les fichiers ne sont pas uploadés vers la release"
- Vérifier que `GITHUB_TOKEN` a les permissions nécessaires
- Consulter les logs du workflow pour voir les erreurs d'upload

### Utilisateurs Finaux

#### "Les utilisateurs ne trouvent pas le téléchargement"
- Vérifier que la release est marquée comme "Latest"
- Le lien `https://github.com/TobieTheUnknown/Piano/releases/latest` devrait fonctionner

#### "L'exécutable est bloqué par l'antivirus"
- Windows SmartScreen : Normal pour les nouveaux développeurs
- Les utilisateurs doivent cliquer sur "Plus d'infos" → "Exécuter quand même"
- Solution long terme : Signer le code avec un certificat de confiance

#### "L'app ne s'ouvre pas sur macOS"
- L'utilisateur doit faire clic droit → "Ouvrir" la première fois
- Ou exécuter : `xattr -cr /Applications/Piano\ Teacher.app`
- Solution long terme : Notariser l'app avec Apple

#### "Permission denied sur Linux"
- Pour AppImage : `chmod +x piano-teacher_1.0.0_amd64.AppImage`

---

## 📖 Ressources

- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Tauri Distribution Guide](https://tauri.app/distribute/)
- [Tauri Action (GitHub)](https://github.com/tauri-apps/tauri-action)
- [Semantic Versioning](https://semver.org/)

---

## 🎯 Résumé

**Pour une release complètement automatisée :**
1. ✏️ Mettre à jour les versions dans `package.json` et `tauri.conf.json`
2. 📝 Commiter et pusher vers `main`
3. 🏷️ Créer et pusher un tag `v*.*.*`
4. ⏳ Attendre que GitHub Actions construise tout
5. 🎉 Profiter de votre release !

**Temps total :** ~20 minutes (dont 15-20 minutes de build automatique)

---

**Bonne release ! 🚀**
