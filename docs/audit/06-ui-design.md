# UI et design — constats pour le brainstorming

Cette fiche sépare les défauts d'usage à corriger des choix visuels à discuter. Elle applique les Web Interface Guidelines consultées le 9 septembre 2026.

## Défauts corrigés pendant l'audit

- Les cartes de mesure du Coach sont utilisables au clavier ; le numéro qui active le surlignage est un vrai bouton nommé.
- La zone plein écran de LivePlay mobile et son bouton retour ont un nom accessible.
- La recherche et le tri de la bibliothèque ont un nom de contrôle ; la recherche désactive l'autocomplétion sans rapport avec l'identité.
- Les transitions globales ne ciblent plus `all`, ce qui évite d'animer involontairement dimensions et mise en page.
- Les préférences de réduction des animations sont déjà prises en compte globalement et sur l'onboarding/la vitrine.

## Dette d'accessibilité à reprendre

- `Settings.jsx` et `SongEditor.jsx` utilisent souvent un texte `<label>` sans `htmlFor`, donc le texte ne cible pas toujours le champ. Ajouter des identifiants stables et des noms aux contrôles.
- Plusieurs boutons avec une icône et un `title` seulement doivent recevoir un `aria-label`. Faire un passage composant par composant, sans attribuer automatiquement le même nom à des actions différentes.
- Les modales doivent toutes piéger le focus, rendre le fond inerte et restaurer le focus au bouton d'ouverture. `Settings`, l'onboarding et la bibliothèque ont chacun une implémentation partielle différente à unifier.
- Le changement de morceau, de filtre et de mode reste entièrement dans l'état React. Des URL partageables pour les pages principales rendraient retour navigateur, favoris et liens directs prévisibles.

## Pourquoi l'interface paraît chargée

- Les cinq composants principaux totalisent plus de 5 000 lignes (`LiveLearning`, `Settings`, `SongEditor`, `PlaybackDock`, `LivePlayViewOptimized`) et combinent logique, rendu, variantes responsive et styles ponctuels. Cette structure favorise l'accumulation de contrôles.
- Au moins 40 règles utilisent du texte de 8 à 10 px. Cette densité fait tenir davantage d'informations mais affaiblit la hiérarchie et la lisibilité.
- Les cartes du Coach superposent mesure, rôle, motif, notes, harmonie, degré, rythme et état de lecture. L'information musicale utile doit varier selon l'intention : mémoriser, comprendre ou jouer.
- Le dock rassemble mains, écoute, tempo, métronome, boucle, navigation, lecture et options de boucle. Les réglages secondaires peuvent apparaître après activation ou dans un panneau contextuel.

## Directions proposées

1. **Vue essentielle par défaut** : numéro, motif principal par main, lecture. Harmonie et rythme détaillé s'ouvrent à la demande.
2. **Trois niveaux explicites** : Jouer, Comprendre, Éditer. Chaque niveau garde seulement les actions nécessaires à son objectif.
3. **Typographie minimale de 12 px pour les informations utiles**, 11 px réservé aux métadonnées non critiques ; employer espace et contraste avant de multiplier bordures, badges et couleurs.
4. **Une seule barre de transport partagée** avec un noyau stable (retour, lecture, précédent/suivant, vitesse) et des extensions propres au mode.
5. **Analyse musicale qualifiée** : séparer visuellement les faits du fichier (armure explicite, notes) des inférences (tonalité estimée, accord incomplet).
6. **Cartes de motif fidèles à la séquence** : conserver le résultat demandé `do mi fa ×3`, puis `mi fa ×2`, et cacher les détails qui ne changent pas la manière de travailler la mesure.

## Ordre recommandé pour une future refonte

Faire d'abord un prototype statique du Coach avec une vraie pièce dense, puis le dock, puis Réglages. Valider portrait, paysage, clavier et réduction des animations avant de reporter les mêmes décisions dans Compose. Ne pas commencer par déplacer des couleurs : la surcharge vient surtout du nombre d'informations simultanées.
