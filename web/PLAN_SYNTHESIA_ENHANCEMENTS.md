# Plan d'implémentation - Améliorations Vue Synthesia

## Vue d'ensemble

Améliorations majeures pour la vue Synthesia :
1. Allumage visuel des touches (élève, logiciel, notes attendues)
2. Navigation/scroll dans la timeline
3. Refonte complète du menu de loop avec timeline interactive
4. Mesure de préparation avant lecture
5. Gestion intelligente des loops avec début avant la zone

---

## 1. Allumage des Touches du Clavier

### 1.1 État Actuel
- Touches s'allument quand l'élève appuie (bleu/vert/rouge selon précision)
- Pas d'indication visuelle pour les notes jouées par le logiciel
- Pas d'indication des notes attendues en mode attente

### 1.2 Modifications

#### A. Nouvel état pour suivi des touches actives
```javascript
// Dans SynthesiaView.jsx
const [activeKeys, setActiveKeys] = useState({
  student: new Set(),      // Notes pressées par l'élève
  computer: new Set(),     // Notes jouées par le logiciel
  expected: new Set()      // Notes attendues (wait mode uniquement)
});
```

#### B. Mise à jour du rendu du clavier (drawKeyboard)
```javascript
// Ordre de rendu (du plus bas au plus haut) :
1. Touche normale (blanc/noir)
2. Note attendue (mode wait) → Outline bleu pulsant
3. Note jouée par ordinateur → Remplissage bleu clair
4. Note pressée par élève → Remplissage selon précision (vert/rouge/bleu)
```

#### C. Gestion des états
- **handleNoteOn** : Ajouter la note à `activeKeys.student`
- **handleNoteOff** : Retirer de `activeKeys.student`
- **Auto-play** : Ajouter/retirer de `activeKeys.computer` avec timing
- **Expected notes** : Calculer en temps réel basé sur `currentTime` et `waitMode`

#### D. Nouveaux styles visuels
```javascript
COLORS = {
  // Existants
  whiteKeyPressed: '#60a5fa',
  blackKeyPressed: '#3b82f6',
  // Nouveaux
  expectedKeyOutline: '#fbbf24',      // Amber outline pulsant
  computerKeyFill: '#93c5fd',         // Bleu clair semi-transparent
  expectedKeyGlow: 'rgba(251,191,36,0.3)'  // Halo jaune
}
```

### 1.3 Fichiers à modifier
- `src/components/SynthesiaView.jsx` (lignes 860-919 - drawKeyboard)
- `src/components/SynthesiaCanvas.jsx` (si on utilise la version optimisée)

---

## 2. Navigation/Scroll dans le Morceau

### 2.1 Fonctionnalités
- Cliquer n'importe où sur la timeline pour s'y positionner
- Scrubbing (drag) pour naviguer
- Scroll wheel pour avancer/reculer
- Affichage permanent de la timeline complète en bas

### 2.2 Nouveau Composant : TimelineNavigator

#### Structure
```javascript
<TimelineNavigator
  totalDuration={songDuration}
  currentTime={currentTime}
  loopStart={loopConfig?.startMeasure}
  loopEnd={loopConfig?.endMeasure}
  measures={measureCount}
  onSeek={(time) => jumpToTime(time)}
  onLoopChange={(start, end) => setLoopForRange(start, end)}
/>
```

#### Visuel
```
┌──────────────────────────────────────────────────────────┐
│ Mesure: 1    2    3    4    5    6    7    8    9   10   │
│ ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤      │
│ │    │    │░░░░░░░░░░░░│    │    │    │    │    │       │
│ │    │    │◄── LOOP ──►│    │    │    │    │    │       │
│ │    │    ▲                                    ▲          │
│ │    │    │                                    │          │
│ │ Curseur playback (triangle pointant vers le haut)      │
│ │ Poignées de loop (draggables)                          │
└──────────────────────────────────────────────────────────┘
```

#### Interactions
1. **Click** → `jumpToTime(clickX / totalWidth * duration)`
2. **Drag poignée loop** → Ajuster start/end
3. **Scroll wheel** → ±1 mesure
4. **Double-click** → Reset au début
5. **Shift+Click** → Créer/modifier zone loop

### 2.3 Fonction jumpToTime()
```javascript
const jumpToTime = (targetTime) => {
  const wasPlaying = isPlaying;
  if (wasPlaying) setIsPlaying(false);

  setCurrentTime(targetTime);
  startTimeRef.current = performance.now() - (targetTime / playbackSpeed) * 1000;

  // Reset notes processing
  processedNotesRef.current = new Set();
  setPlayedNotes(new Map());

  if (wasPlaying) {
    setTimeout(() => setIsPlaying(true), 100);
  }
};
```

### 2.4 Fichiers à créer/modifier
- **NOUVEAU** : `src/components/TimelineNavigator.jsx`
- **MODIFIER** : `src/components/SynthesiaView.jsx` (intégrer le composant)
- **NOUVEAU** : `src/hooks/useTimelineInteraction.js` (logique drag & drop)

---

## 3. Refonte du Menu de Loop

### 3.1 Problèmes Actuels
- Dropdown + inputs séparés = pas intuitif
- Difficile de visualiser la zone de loop
- Pas de feedback visuel immédiat

### 3.2 Nouveau Design : Timeline Interactive

#### Remplacement
```
AVANT :
┌─────────────────────────────────────┐
│ Phrase: [Dropdown ▼]                │
│ De mesure: [3] À mesure: [6]       │
│ [Loop] [Arrêter]                    │
└─────────────────────────────────────┘

APRÈS :
┌─────────────────────────────────────────────────────────┐
│ TIMELINE INTERACTIVE (voir section 2.2)                 │
│ ┌─────────────────────────────────────────────────┐    │
│ │ [●] Loop actif    Mesure 3 → 6    [×] Arrêter │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ Raccourcis phrases:                                      │
│ [Intro] [Couplet] [Refrain] [Pont] [Outro]             │
│         ↑ Click → Set loop to cette phrase              │
└─────────────────────────────────────────────────────────┘
```

#### Modes d'interaction
1. **Drag poignées** → Définir loop précis
2. **Shift+Click deux points** → Définir start/end
3. **Click bouton phrase** → Loop rapide sur phrase entière
4. **Click sur zone loop** → Toggle loop on/off
5. **Drag poignée hors zone** → Désactiver loop

### 3.3 Intégration avec Navigation
- Même composant `TimelineNavigator` gère les deux
- Props `loopEnabled` et `onLoopChange` pour le contrôle
- Synchronisation bidirectionnelle timeline ↔ loop state

### 3.4 Fichiers à modifier
- **MODIFIER** : `src/components/TimelineNavigator.jsx` (ajouter gestion loop)
- **MODIFIER** : `src/components/SynthesiaView.jsx` (retirer ancien UI loop, lignes 1807-1952)
- **MODIFIER** : `src/components/SynthesiaControls.jsx` (simplifier, garder juste toggle)

---

## 4. Mesure de Préparation Avant Lecture

### 4.1 Comportement Souhaité
- **TOUJOURS** 1 mesure (4 beats) de préparation avant la lecture
- Métronome actif pendant la préparation
- Compte à rebours visuel : "4... 3... 2... 1... GO!"
- Fonctionne avec ou sans loop

### 4.2 Implémentation

#### A. Modifier handlePlay()
```javascript
const handlePlay = () => {
  // Calculer startTime avec offset de -1 mesure
  const beatsPerMeasure = 4;
  const preparationTime = -beatsPerMeasure / beatsPerSecond;  // -1 mesure

  setCurrentTime(preparationTime);
  startTimeRef.current = performance.now() - (preparationTime / playbackSpeed) * 1000;
  setIsPlaying(true);
  setIsCountingIn(true);  // Nouveau state
};
```

#### B. Compte à rebours visuel
```javascript
const [isCountingIn, setIsCountingIn] = useState(false);
const [countInValue, setCountInValue] = useState(null);

// Dans useEffect animation loop
if (isCountingIn && currentTime < 0) {
  const beatsUntilStart = Math.ceil(Math.abs(currentTime * beatsPerSecond));
  setCountInValue(beatsUntilStart);  // 4, 3, 2, 1

  if (currentTime >= 0) {
    setIsCountingIn(false);
    setCountInValue(null);
  }
}
```

#### C. Affichage visuel
```javascript
// Dans le rendu canvas
if (isCountingIn && countInValue) {
  ctx.font = 'bold 120px Arial';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.fillText(countInValue, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  // Effet pulse
  const scale = 1 + Math.sin(currentTime * Math.PI * 4) * 0.1;
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.scale(scale, scale);
  // ... dessiner
  ctx.restore();
}
```

#### D. Métronome pendant préparation
```javascript
// Dans useEffect métronome (lignes 525-578)
// Le métronome fonctionne déjà basé sur currentTime
// Il continuera naturellement pendant le temps négatif
// Juste s'assurer que metronomeDivision = 'beat' pendant count-in
```

### 4.3 Gestion avec Loop
```javascript
// Si loop activé, le count-in démarre -1 mesure avant loopStart
const handlePlayWithLoop = () => {
  const loopStartTime = (loopConfig.startMeasure - 1) * 4 / beatsPerSecond;
  const preparationTime = loopStartTime - (4 / beatsPerSecond);

  setCurrentTime(preparationTime);
  startTimeRef.current = performance.now() - (preparationTime / playbackSpeed) * 1000;
  setIsPlaying(true);
  setIsCountingIn(true);
};
```

### 4.4 Fichiers à modifier
- **MODIFIER** : `src/components/SynthesiaView.jsx`
  - handlePlay() (ligne ~1410)
  - Animation loop (ligne ~1210)
  - Rendering du count-in (nouveau)
- **MODIFIER** : `src/services/AudioEngine.js` (s'assurer métronome fonctionne avec temps négatif)

---

## 5. Gestion Loops avec Début Avant

### 5.1 Scénario d'Usage
```
Timeline:
├─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┤
Mes:  1     2     3     4     5     6     7     8

User setup:
- Loop: Mesures 5-7
- Clique sur timeline à mesure 2 (avant la loop)
- Play

Comportement souhaité:
1. Lecture démarre à mesure 2
2. Élève joue mesures 2, 3, 4 normalement (pas de loop)
3. Quand playback atteint mesure 5 → Loop s'active automatiquement
4. Désormais loop entre 5-7 jusqu'à arrêt manuel
5. Tout transparent pour l'utilisateur
```

### 5.2 Implémentation

#### A. Nouveaux états
```javascript
const [loopActivationPending, setLoopActivationPending] = useState(false);
const [loopWillActivateAt, setLoopWillActivateAt] = useState(null);
```

#### B. Logique dans jumpToTime()
```javascript
const jumpToTime = (targetTime) => {
  // ... code existant

  // Détection: si on se positionne avant le début du loop
  if (isLoopEnabled && loopConfig) {
    const loopStartTime = (loopConfig.startMeasure - 1) * 4 / beatsPerSecond;

    if (targetTime < loopStartTime) {
      // Désactiver temporairement le loop, le réactiver plus tard
      setLoopActivationPending(true);
      setLoopWillActivateAt(loopStartTime);
    } else {
      setLoopActivationPending(false);
    }
  }
};
```

#### C. Activation automatique dans animation loop
```javascript
// Dans animate() (lignes 1210-1285)
if (loopActivationPending && currentTime >= loopWillActivateAt) {
  // Loop activée maintenant!
  setLoopActivationPending(false);
  setLoopWillActivateAt(null);
  // Le loop existant prendra le relais naturellement
}

// Logique de loop existante (avec modification)
if (isLoopEnabled && loopConfig && !loopActivationPending) {
  const loopStartTime = (loopConfig.startMeasure - 1) * 4 / beatsPerSecond;
  const loopEndTime = loopConfig.endMeasure * 4 / beatsPerSecond;

  if (elapsed >= loopEndTime) {
    // Reset au début du loop
    startTimeRef.current = performance.now() - (loopStartTime / playbackSpeed) * 1000;
    setCurrentTime(loopStartTime);
    processedNotesRef.current = new Set();
    setPlayedNotes(new Map());
  }
}
```

#### D. Indicateur visuel (optionnel)
```javascript
// Affichage subtil "Loop s'activera à mesure 5" pendant la lecture
if (loopActivationPending && loopWillActivateAt) {
  const measuresUntilLoop = Math.ceil(
    (loopWillActivateAt - currentTime) * beatsPerSecond / 4
  );

  // Petit texte en haut
  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgba(251,191,36,0.7)';
  ctx.fillText(
    `Loop s'activera dans ${measuresUntilLoop} mesure(s)`,
    CANVAS_WIDTH - 250,
    30
  );
}
```

### 5.3 Edge Cases à Gérer
1. **User clique pendant loop** → Loop déjà actif, rien à faire
2. **User clique après la fin du loop** → Désactiver complètement le loop
3. **User change loop range pendant lecture** → Recalculer loopWillActivateAt
4. **User désactive loop pendant pending** → Annuler loopActivationPending

### 5.4 Fichiers à modifier
- **MODIFIER** : `src/components/SynthesiaView.jsx`
  - jumpToTime() (nouveau ou modifier existant)
  - Animation loop (ligne ~1220)
  - Rendering de l'indicateur (optionnel)

---

## 6. Ordre d'Implémentation Recommandé

### Phase 1 : Infrastructure de Navigation (1-2 jours)
1. ✅ Créer `TimelineNavigator.jsx` (component de base)
2. ✅ Implémenter `jumpToTime()` et interactions de base
3. ✅ Intégrer dans `SynthesiaView.jsx`
4. ✅ Tester navigation/click

### Phase 2 : Refonte Loop (1 jour)
5. ✅ Ajouter gestion loop interactive à `TimelineNavigator`
6. ✅ Retirer ancien UI de loop
7. ✅ Implémenter drag & drop poignées
8. ✅ Raccourcis phrases rapides

### Phase 3 : Mesure de Préparation (0.5 jour)
9. ✅ Modifier `handlePlay()` pour count-in
10. ✅ Implémenter compte à rebours visuel
11. ✅ Tester avec/sans loop

### Phase 4 : Loop Intelligent (0.5 jour)
12. ✅ Implémenter `loopActivationPending` logic
13. ✅ Tester scénarios edge cases
14. ✅ Ajouter indicateur visuel optionnel

### Phase 5 : Allumage Touches (1 jour)
15. ✅ Refactoriser `activeKeys` state
16. ✅ Modifier rendering clavier pour 3 états
17. ✅ Implémenter expected notes (wait mode)
18. ✅ Styles visuels pulsants

### Phase 6 : Polish & Tests (1 jour)
19. ✅ Tests complets de toutes les fonctionnalités
20. ✅ Optimisation performances (si nécessaire)
21. ✅ Documentation utilisateur (tooltips, etc.)
22. ✅ Commit & Push

**Total estimé : 5-6 jours de développement**

---

## 7. Risques et Considérations

### Performance
- ❗ Rendering du clavier avec états multiples → Optimiser avec memoization
- ❗ Timeline draggable → Throttle events à 60fps
- ✅ Utiliser canvas layers existants pour minimiser redraws

### Compatibilité
- ✅ Fonctionnera avec version optimisée (`SynthesiaViewOptimized.jsx`)
- ✅ Compatible avec tous les modes (wait, free play, watch, etc.)
- ❗ Tester avec Tauri MIDI et Web MIDI API

### UX
- ✅ Timeline toujours visible = meilleure compréhension
- ✅ Count-in = meilleur feeling de début
- ✅ Loop intelligent = expérience fluide
- ❗ Bien documenter interactions timeline (tooltips)

### Code
- ✅ Garder architecture modulaire existante
- ✅ Réutiliser hooks et services
- ❗ Éviter duplication code entre SynthesiaView et SynthesiaViewOptimized

---

## 8. Tests à Effectuer

### Fonctionnels
- [ ] Allumage touches élève (note on/off)
- [ ] Allumage touches ordinateur (auto-play)
- [ ] Affichage notes attendues (wait mode)
- [ ] Click timeline → Navigation précise
- [ ] Drag timeline → Scrubbing fluide
- [ ] Scroll wheel → ±1 mesure
- [ ] Drag poignées loop → Ajuster range
- [ ] Click raccourci phrase → Loop rapide
- [ ] Count-in avant play (avec/sans loop)
- [ ] Loop activation automatique depuis avant
- [ ] Edge cases (click pendant loop, après loop, etc.)

### Performance
- [ ] 60fps constant pendant lecture
- [ ] Pas de lag pendant drag timeline
- [ ] Memory stable (pas de leaks)
- [ ] Fonctionne avec morceaux longs (>100 mesures)

### Compatibilité
- [ ] Fonctionne avec tous les modes (wait, free, watch)
- [ ] Fonctionne avec toutes les mains (L, R, both)
- [ ] Compatible Tauri MIDI
- [ ] Compatible Web MIDI API

---

## 9. Fichiers Nouveaux/Modifiés - Résumé

### Nouveaux Fichiers
- `src/components/TimelineNavigator.jsx` (~400 lignes)
- `src/hooks/useTimelineInteraction.js` (~150 lignes)
- `src/utils/timelineHelpers.js` (~100 lignes)

### Fichiers Modifiés
- `src/components/SynthesiaView.jsx`
  - handlePlay() : +20 lignes (count-in)
  - jumpToTime() : +30 lignes (nouveau)
  - drawKeyboard() : +40 lignes (3 états touches)
  - Animation loop : +30 lignes (loop intelligent)
  - Retirer ancien UI loop : -145 lignes
  - Intégrer TimelineNavigator : +20 lignes
  - **Total : ~-5 lignes (nettoyage)**

- `src/components/SynthesiaCanvas.jsx`
  - Rendering clavier : +40 lignes (si optimisé utilisé)

- `src/components/SynthesiaControls.jsx`
  - Simplification loop UI : -50 lignes

- `src/services/AudioEngine.js`
  - Support temps négatif métronome : +10 lignes

**Total lignes ajoutées : ~650**
**Total lignes retirées : ~195**
**Net : +455 lignes**

---

## 10. Documentation Utilisateur à Ajouter

### Tooltips
- Timeline : "Cliquez pour naviguer • Shift+Click pour loop • Scroll pour avancer"
- Poignées loop : "Glissez pour ajuster la zone de loop"
- Compte à rebours : "Mesure de préparation (métronome actif)"

### Guide Rapide
```
NAVIGATION TIMELINE :
- Click → Se positionner
- Scroll → ±1 mesure
- Drag → Scrubbing

LOOP :
- Shift+Click début/fin → Créer loop
- Drag poignées → Ajuster
- Click phrase → Loop rapide
- Click × → Désactiver

LECTURE :
- Toujours 1 mesure de préparation
- Compte à rebours : 4-3-2-1-GO!
- Loop s'active automatiquement si début avant
```

---

## Conclusion

Ce plan couvre toutes les fonctionnalités demandées avec une architecture cohérente et modulaire. L'implémentation sera progressive, testable à chaque phase, et s'intégrera naturellement dans le code existant.

**Prêt à commencer l'implémentation ?**
