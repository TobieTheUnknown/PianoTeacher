# Export de Partitions Musicales

## Fonctionnalité

Piano Teacher intègre désormais une fonctionnalité d'export de partitions musicales qui permet de convertir vos morceaux MIDI en notation musicale classique au format SVG ou PNG.

## Caractéristiques

### ✨ Points forts

- **Export SVG et PNG** : Exportez vos partitions dans les formats les plus courants
- **Annotations en français** : Option pour afficher les noms de notes en notation française (Do, Ré, Mi, etc.)
- **Flexibilité** : Exportez une phrase spécifique ou tout le morceau
- **Choix des portées** : Exportez la mélodie seule, les accords seuls, ou les deux
- **Prévisualisation** : Visualisez la partition avant de l'exporter
- **Basé sur VexFlow** : Utilise la bibliothèque VexFlow, standard de l'industrie pour le rendu de notation musicale

### 🎵 Options d'export

1. **Annotations** : Activez/désactivez les noms de notes en français sous chaque note
2. **Portées** :
   - Les deux mains (Clé de Sol + Fa)
   - Main droite uniquement (Clé de Sol - mélodie)
   - Main gauche uniquement (Clé de Fa - accords/basse)
3. **Sélection de phrase** : Exportez toutes les phrases ou une phrase spécifique

## Utilisation

### Dans l'application

1. Chargez ou créez un morceau dans l'éditeur
2. Cliquez sur l'onglet **"Export Partition"** dans la navigation
3. Configurez vos options d'export :
   - Cochez "Ajouter les noms de notes en français" pour les annotations
   - Sélectionnez les portées à exporter
   - Choisissez la phrase à exporter (ou toutes)
4. Cliquez sur **"Prévisualiser"** pour voir un aperçu
5. Cliquez sur **"Exporter en SVG"** ou **"Exporter en PNG"** selon votre besoin

### Formats de sortie

#### SVG (Scalable Vector Graphics)
- Format vectoriel, qualité parfaite à toute échelle
- Idéal pour l'impression et l'édition ultérieure
- Peut être ouvert dans des logiciels de dessin (Inkscape, Adobe Illustrator, etc.)

#### PNG (Portable Network Graphics)
- Format image raster
- Idéal pour partager sur les réseaux sociaux ou intégrer dans des documents
- Fond blanc, haute résolution

## Architecture technique

### Fichiers clés

- `src/services/SheetMusicExportService.js` : Service principal pour la conversion et l'export
- `src/components/SheetMusicExporter.jsx` : Interface utilisateur pour l'export

### Dépendances

- **VexFlow 5.0.0** : Bibliothèque de rendu de notation musicale
- **@tonejs/midi** : Déjà présent dans le projet pour le parsing MIDI

### Processus de conversion

1. **Lecture des données** : Le service lit les données de song (notes MIDI, tonalité, tempo)
2. **Groupement par mesures** : Les notes sont groupées en mesures de 4 temps
3. **Conversion MIDI vers VexFlow** : Chaque note MIDI est convertie en notation VexFlow
4. **Rendu** : VexFlow génère un SVG avec les portées, clés, et notes
5. **Annotations** : Si activées, les noms de notes en français sont ajoutés sous chaque note
6. **Export** : Le SVG est soit téléchargé tel quel, soit converti en PNG

### API du service

```javascript
import { sheetMusicExportService } from '../services/SheetMusicExportService';

// Options d'export
const options = {
  withAnnotations: true,  // Ajouter les noms de notes en français
  track: 'both',          // 'both', 'melody', ou 'chords'
  phraseIndex: null       // Index de la phrase ou null pour toutes
};

// Export SVG
const svgBlob = sheetMusicExportService.exportToSVG(song, options);

// Export PNG
const pngBlob = await sheetMusicExportService.exportToPNG(song, options);

// Prévisualisation (retourne un élément HTML contenant le SVG)
const svgContainer = sheetMusicExportService.exportToSheetMusic(song, options);
```

## Limitations connues

1. **Durées simplifiées** : Les durées sont arrondies aux valeurs standard (ronde, blanche, noire, croche, etc.)
2. **Mesures incomplètes** : Les mesures partielles sont supportées mais peuvent ne pas être formatées de manière optimale
3. **Polyphonie** : Les accords sont rendus séquentiellement pour le moment
4. **Tempo dynamique** : Seul le tempo initial est pris en compte

## Améliorations futures possibles

- [ ] Support des accords simultanés (polyphonie verticale)
- [ ] Export PDF multi-pages
- [ ] Ajout d'articulations et de dynamiques
- [ ] Support des changements de tempo en cours de morceau
- [ ] Export au format MusicXML pour compatibilité avec d'autres logiciels
- [ ] Personnalisation de la mise en page (marges, taille des portées, etc.)

## Comparaison avec MidiToSheetMusic

Le projet [MidiToSheetMusic](https://github.com/BYVoid/MidiToSheetMusic) a été étudié comme source d'inspiration, mais n'a pas été directement utilisé car :

- Écrit en C# (incompatible avec notre stack JavaScript/React)
- Génère uniquement des images PNG statiques
- Nécessite Mono pour fonctionner
- Pas de support natif pour les annotations personnalisées

Notre implémentation avec VexFlow offre :
- Intégration native dans l'application web
- Export SVG et PNG
- Annotations personnalisées en français
- Prévisualisation en temps réel
- Meilleure flexibilité pour les futures améliorations

## Ressources

- [Documentation VexFlow](https://www.vexflow.com/)
- [Tutoriel VexFlow](https://github.com/0xfe/vexflow/wiki)
- [Notation musicale française](https://fr.wikipedia.org/wiki/Notation_musicale)
