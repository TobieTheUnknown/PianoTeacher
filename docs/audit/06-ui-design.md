# UI et design — constats pour le brainstorming

Cette fiche sépare les défauts d'usage à corriger des choix visuels à discuter. Elle applique les Web Interface Guidelines consultées le 9 septembre 2026.

## Défauts corrigés pendant l'audit

- Les cartes de mesure du Coach sont utilisables au clavier ; le numéro qui active le surlignage est un vrai bouton nommé.
- La zone plein écran de LivePlay mobile et son bouton retour ont un nom accessible.
- La recherche et le tri de la bibliothèque ont un nom de contrôle ; la recherche désactive l'autocomplétion sans rapport avec l'identité.
- Les transitions globales ne ciblent plus `all`, ce qui évite d'animer involontairement dimensions et mise en page.
- Le dock mobile web conserve un contour de focus visible ; les dernières transitions `all` de l'import/export de bibliothèque ont été remplacées par les propriétés réellement animées.
- Les champs de Réglages et les métadonnées de l'Éditeur sont reliés à leurs libellés. Les commandes de déplacement/renommage de phrase ont un nom accessible et fonctionnent au clavier ; la fenêtre d'import/export expose son rôle de dialogue.
- Le passage sur les 93 fichiers JS/JSX/CSS actifs ne trouve plus aucune transition `all` : chaque animation cible maintenant couleur, bordure, ombre, opacité ou transformation selon le contrôle.
- Les préférences de réduction des animations sont déjà prises en compte globalement et sur l'onboarding/la vitrine.

## Dette d'accessibilité à reprendre

- Plusieurs boutons avec une icône et un `title` seulement doivent recevoir un `aria-label`. Faire un passage composant par composant, sans attribuer automatiquement le même nom à des actions différentes.
- Le hook partagé `useDialogFocus` gère maintenant Réglages, les deux dialogues de Bibliothèque et Import/Export de l'Éditeur : focus initial, cycle Tab, fermeture Échap, blocage du scroll de fond et restitution au bouton d'ouverture. L'onboarding garde encore son cycle propre et le fond n'utilise pas encore l'attribut `inert`.
- La fenêtre Import/Export est maintenant un composant autonome avec sa feuille de styles. `SongEditor.jsx` passe de 1 308 à 1 140 lignes ; chaque sélecteur de fichier n'expose plus qu'un seul contrôle accessible au lieu du champ et d'un bouton décoratif superposés.
- Sur Android, l'option de clavier MIDI de l'introduction est un seul interrupteur accessible au lieu d'une rangée et d'un `Switch` concurrents. Les titres et cartes de mesure du Coach, les cartes de bibliothèque, les boutons de main Live, le détail Coach et la valeur éditable de boucle annoncent maintenant leur rôle ou leur action.
- La gestion de sauvegarde de bibliothèque est extraite de `Settings.jsx` dans un panneau autonome et stylé. Le composant principal passe de 960 à 823 lignes et le champ d'import est directement associé à son bouton visuel.
- Le changement de morceau, de filtre et de mode reste entièrement dans l'état React. Des URL partageables pour les pages principales rendraient retour navigateur, favoris et liens directs prévisibles.

## Pourquoi l'interface paraît chargée

- Les huit plus gros composants JSX totalisent plus de 8 400 lignes. `SongEditor`, `LiveLearning`, `PianoRollCanvas`, `LivePlayViewOptimized`, `PianoRollEditor`, `Settings`, `LivePlayCanvas` et `SheetMusicLearning` combinent logique, rendu, variantes responsive et styles ponctuels. Cette structure favorise l'accumulation de contrôles.
- Le relevé statique compte 82 déclarations de texte entre 8 et 11 px, 479 blocs de styles JSX et 760 couleurs littérales (`#…`, `rgb`, `rgba`) dans 93 fichiers JS/JSX/CSS. Les mockups d'introduction expliquent une partie des petites tailles, mais Coach, dock, bibliothèque et éditeur en contiennent aussi.
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

Le prochain passage de code doit extraire ensuite les paramètres MIDI de `Settings`, puis évaluer `inert` pour les fonds de dialogue. Changer la taille ou masquer des informations attendra le brainstorming afin de préserver les choix produit.
