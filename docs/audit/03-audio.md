# Audio et MIDI — examen en cours

## Web/desktop

`AudioEngine` est un singleton. `preload` construit Volume + MembraneSynth + Sampler local Salamander ; `start` doit déverrouiller le contexte sur geste utilisateur. `initialize` est encore appelé par les vues. `useMidiAudio` gère le piano MIDI ; `usePlaybackPosition` et LivePlay dérivent leur position d'une horloge.

Premiers défauts vus :

- Pas de `onerror` dans le chargement Sampler : promesse bloquée indéfiniment si un fichier manque.
- `initialize` conserve une promesse déjà résolue : ne réveille pas un contexte suspendu ensuite.
- `start` attend tout le téléchargement avant de reprendre le contexte : le geste initial peut être perdu.
- `stop` appelle le callback avant le nettoyage final : un callback qui relance une boucle voit sa nouvelle lecture nettoyée par l'ancien `stop`.
- `playNotes` ne réinitialise pas le timeout de la lecture précédente ni la position Transport.
- `useMidiRecording` transmet la vélocité comme durée à `playNote`.
- Volume 0% stocké comme -Infinity puis rétabli à 0 dB au prochain lancement : mute non persistant.

## Vérifications nécessaires

Chargement normal / ressource manquante / nouvelle tentative ; geste avant fin de chargement ; reprise après suspension ; notes MIDI pressées/relâchées pendant le chargement ; boucle terminée vs arrêt manuel ; démontage/changement de chanson ; clic audio et position visuelle ; périphérique débranché.

Ne retirer un repli que si toutes les plateformes concernées disposent du chemin principal. Le web sans Tauri et le desktop natif ne sont pas des cas d'erreur interchangeables.

## Corrections et limites constatées

Web : chargement rejetable/rejouable, reprise du contexte avant le téléchargement, `initialize` sans cache de déverrouillage périmé, arrêt manuel distinct de fin naturelle, nettoyage avant rappel de boucle, mute fini/persistant, indication d'échec et bouton réessayer. Injection du chargeur Tone pour tests du cycle de vie. MIDI : volume zéro respecté, notes relâchées pendant le chargement retirées de l'attente, nettoyage au démontage et débranchement, double monitoring de l'enregistrement retiré.

Android : `stop` coupe aussi SoundPool et remet la pédale à zéro ; Oboe ne remplace plus SoundPool si les samples sont incomplets ; publication du statut volatile. C++ : commande de clic publiée atomiquement ; les paramètres/position du clic ne sont plus modifiés concurremment par JNI et le callback audio.

**À ne pas déclarer impeccable** sans écoute/device : mutex bloquant dans le callback Oboe ; récupération après changement de route audio absente ; bascule de backend pendant une note tenue ; horloge Android fondée sur les jobs/callbacks UI ; pédales et notes superposées sur plusieurs canaux.

SoundPool attend maintenant ses callbacks réels au lieu d'un délai fixe. Le décodage MediaCodec libère codec, extracteur et asset même en erreur, respecte offset/limite des buffers et accepte les sorties PCM 16 bits ou float.

## Vérification sur Pixel 8 Pro

Installation debug avec conservation des données, démarrage à froid puis redémarrage contrôlé réussis. Oboe a ouvert un flux à 48 kHz avec un burst de 96 frames ; les 30 samples ont été chargés et le sampler s'est déclaré prêt, sans crash Android observé. Ce contrôle valide l'initialisation et le chargement, pas encore la qualité sonore perçue, les notes simultanées, le sustain ni les périphériques MIDI physiques.

## Deuxième lot : cycle MIDI et reprises

- Web : `useMidiAudio` reste abonné à la disponibilité des samples même après un premier échec ; un essai réussi rétablit le monitoring. `SheetMusicLearning` recrée le métronome à chaque tour de boucle ; les aperçus `playNotes` se terminent désormais automatiquement.
- `MidiInputService` partage un seul traitement des événements entre Web MIDI et Tauri. Volume MIDI à zéro et seuil à zéro sont conservés ; une sélection invalide garde le périphérique courant, un changement libère les notes tenues.
- Android : `MidiByteParser` conserve le running status et les messages incomplets entre paquets, et ignore correctement les octets temps réel intercalés. Deux tests JVM couvrent fragmentation, pédale, SysEx et réinitialisation.
- `MidiManager` n'inscrit qu'un callback USB, ferme les résultats d'ouverture périmés, réutilise directement le périphérique BLE obtenu et limite le scan à 30 secondes. Déconnexion et saturation de la file provoquent une réinitialisation des touches/pédale.
- `MainActivity` pilote USB/BLE selon les préférences, seulement lorsque l'activité est démarrée ; les ViewModels ne relancent plus chacun leur scan. Le résultat de permission BLE déclenche réellement le scan. L'ancien code de permission inutilisé de MainActivity est retiré.
- Compilation native et 15 tests JVM passés ; absence de test matériel de ces transitions explicitement consignée dans `05-validation.md`.

À approfondir : ownership audio des ViewModels conservés dans la pile de navigation ; canaux MIDI partageant un même pitch ; reconnexion physique après débranchement ; réglage audio global natif et changement de backend pendant une note tenue.
