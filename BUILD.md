# Guide de Build - Piano Teacher

Ce projet est maintenant configuré pour créer des applications exécutables pour Windows, macOS et Linux.

## Prérequis

- Node.js et npm installés
- Les dépendances du projet installées (`npm install`)

## Scripts de Build Disponibles

### Build pour Windows (.exe)
```bash
npm run build:win
```
Crée un installateur NSIS (.exe) pour Windows 64-bit.

### Build pour macOS (.dmg)
```bash
npm run build:mac
```
Crée une image disque (.dmg) pour macOS (architectures x64 et ARM64/Apple Silicon).

**Note:** La création d'un build macOS sur un système non-macOS peut avoir des limitations.

### Build pour Linux (.AppImage)
```bash
npm run build:linux
```
Crée une AppImage pour Linux 64-bit.

### Build pour toutes les plateformes
```bash
npm run build:all
```
Crée les exécutables pour Windows, macOS et Linux en une seule commande.

**Note:** Ce build peut prendre du temps et nécessite beaucoup d'espace disque.

## Sortie des Builds

Tous les exécutables sont créés dans le dossier `release/` à la racine du projet. La structure est :

```
release/
└── 0.0.0/
    ├── Piano Teacher Setup 0.0.0.exe      (Windows)
    ├── Piano Teacher-0.0.0.dmg            (macOS)
    └── Piano Teacher-0.0.0.AppImage       (Linux)
```

## Mode Développement

Pour lancer l'application en mode développement avec Electron :

```bash
npm run dev
```

Cela lance l'application dans une fenêtre Electron avec le hot-reload activé.

## Notes Importantes

1. **Icônes** : Vous pouvez ajouter des icônes personnalisées en créant des fichiers d'icônes pour chaque plateforme dans le dossier `public/` et en mettant à jour la configuration dans `package.json`.

2. **Signature de code** : Pour distribuer les applications, vous devrez peut-être signer le code :
   - Windows : Nécessite un certificat de signature de code
   - macOS : Nécessite un compte Apple Developer et notarisation
   - Linux : Généralement pas de signature requise

3. **Taille des builds** : Les builds peuvent être volumineux (100+ MB) car ils incluent le runtime Electron et toutes les dépendances.

4. **Cross-compilation** :
   - Les builds Windows peuvent généralement être créés depuis n'importe quelle plateforme
   - Les builds macOS nécessitent idéalement un système macOS
   - Les builds Linux fonctionnent mieux sur Linux

## Dépannage

Si vous rencontrez des problèmes :

1. Assurez-vous que toutes les dépendances sont installées : `npm install`
2. Vérifiez que le build Vite fonctionne : `npm run build`
3. Consultez les logs d'electron-builder pour des erreurs détaillées
4. Vérifiez l'espace disque disponible (les builds nécessitent plusieurs GB)

## Structure du Projet Electron

```
Piano/
├── electron/
│   ├── main.js        # Processus principal Electron
│   └── preload.mjs    # Script de préchargement
├── src/               # Code source React
├── dist/              # Build Vite (renderer)
├── dist-electron/     # Build Electron (main + preload)
└── release/           # Exécutables finaux
```
