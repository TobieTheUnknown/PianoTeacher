# Audit progressif PianoTeacher

État : en cours — logique musicale, persistance, import/export, cartes et premier lot de gravure polyphonique vérifiés ; validation matérielle audio et audit UI détaillé restent ouverts. Chaque domaine possède sa fiche ; lire l'index puis seulement la fiche concernée.
Les cases ne sont cochées qu'après examen et vérification ; une compilation seule ne valide ni le son ni la gravure.

## Ordre de travail

1. [x] Inventaire, état Git, intégration de la branche `codex/ui-onboarding` sur une branche d'audit ; distinguer sources et artefacts `gh-pages`.
2. [x] Modèle, unités de temps, import/export MIDI, persistance. Définir les invariants avant les corrections de rendu.
3. [x] Gammes, orthographe enharmonique, accords, motifs et arpèges répétés ; tests ciblés sans UI.
4. [x] Découpage des mesures et cartes d'apprentissage ; vérifier le passage analyse → présentation.
5. [x] Partitions : clefs, armures, altérations, durées, ligatures, notes liées, voix indépendantes et silences ; comparer web et Android. Les changements internes de métrique/tempo restent une évolution du modèle.
6. [ ] Audio/MIDI : chargement, premier geste, lecture, pause, reprise, boucles, changements de morceau, nettoyage et erreurs.
7. [ ] Éditeur et LivePlay : interactions, synchronisation, partage des états.
8. [x] Web/Pages et desktop, puis Android natif distinct : comportements, builds et chemins d'assets cohérents.
9. [ ] Code mort et duplication : supprimer seulement après vérification des consommateurs et des points d'entrée.
10. [ ] UI/design : inventaire des frictions, propositions pour le brainstorming sans refonte improvisée.
11. [ ] Vérification finale et bilan : tests réellement passés, limites matérielles, points restant ouverts.

## Fiches à consulter

- `source-index.md` et `android-index.md` : navigation générée par `python3 scripts/update-source-index.py`.
- `01-architecture.md` : points d'entrée, branches, dépendances et déploiement.
- `02-music.md` : données, gammes, accords, mesures, motifs, partition.
- `03-audio.md` : moteur audio, entrées MIDI et cycle de vie.
- `04-platforms-ui.md` : applications, édition, stockage et pistes de simplification.
- `05-validation.md` : commandes, résultats, limites et reprises.
- `06-ui-design.md` : audit d'accessibilité, sources de surcharge et directions de simplification.

## Règles de cette révision

- Avancer par domaine et consigner les conclusions avant de passer au suivant.
- Distinguer bug démontré, divergence de plateforme, dette et idée de produit.
- Garder les sauvegardes de données compatibles ; ne pas supprimer un repli uniquement parce que son nom contient fallback.
- Ne pas fusionner les fichiers compilés de `gh-pages` dans les sources.
- Préparer les changements localement ; publier et déclarer une plateforme validée seulement sur preuve.
