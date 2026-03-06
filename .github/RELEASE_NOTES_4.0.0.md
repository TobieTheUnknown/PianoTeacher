# Piano Teacher v4.0.0

Application complète d'apprentissage du piano avec mode Synthesia, disponible sur desktop et mobile.

## Fonctionnalités

### Mode Synthesia
- Notes qui tombent en temps réel sur un clavier virtuel interactif
- Scoring en temps réel : Perfect, Good, OK, Miss avec combo counter
- Mode Attente : la lecture pause jusqu'a ce que vous jouiez la bonne note
- Mode Ecoute : l'ordinateur joue tout, vous observez
- Choix de la main : droite, gauche, les deux, ou ecoute
- Boucle sur une phrase ou un range de mesures personnalise
- Timeline navigable avec seek et drag des bornes de boucle
- Metronome integre avec subdivisions (mesure, demi-mesure, temps)
- Controle du tempo (BPM) et vitesse de defilement
- Effets visuels optionnels (particules, glow)
- Couleurs personnalisables par main
- Statistiques de session et historique des scores

### Mode Synthesia Mobile
- Interface tactile plein ecran optimisee
- Canvas unique a 30fps avec DPR=1 pour performances fluides
- Overlay mobile avec controles compacts (play, tempo, main, boucle, metronome)
- Prompt de rotation automatique en portrait
- Wake lock pour garder l'ecran allume pendant la lecture
- Labels de notes et lignes de mesure adaptes

### Mode Apprentissage
- Vue mesure par mesure du morceau
- Ecoute individuelle de chaque mesure (les deux mains, main droite, main gauche)
- Affichage des accords avec analyse harmonique
- Detail de la melodie note par note
- Surlignage des mesures importantes
- Indicateurs de repetition sur les notes consecutives

### Editeur de Morceaux
- Editeur complet melodie + accords par phrase
- Piano Roll graphique pour edition visuelle des notes
- Import MIDI avec detection automatique des mains
- Gestion des signatures rythmiques et armures
- Sauvegarde locale persistante

### Bibliotheque
- Bibliotheque de morceaux avec import/export JSON
- Import de fichiers MIDI (.mid)
- Morceaux de demonstration inclus
- Stockage local persistant

### MIDI
- Connexion clavier MIDI en temps reel (desktop)
- Calibration de latence MIDI
- Visualiseur MIDI pour debug

### Personnalisation
- Themes clair/sombre avec couleurs personnalisables
- Couleurs des mains configurables
- Export en partition PDF (VexFlow)

### Multi-Plateforme
- **Windows** : installeur .exe (NSIS) et .msi
- **macOS** : .dmg Universal (Intel + Apple Silicon)
- **Android** : .apk signe (release)

## Installation

| Plateforme | Fichier | Notes |
|------------|---------|-------|
| Windows | `Piano Teacher_4.0.0_x64-setup.exe` | Installeur NSIS |
| macOS | `Piano Teacher_4.0.0_universal.dmg` | Glisser dans Applications |
| Android | `app-universal-release.apk` | Activer "Sources inconnues" |
