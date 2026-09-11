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

Android : `stop` remet la pédale à zéro et ne coupe que les voix appartenant à la session concernée. Le playback attend un backend entièrement prêt : Oboe reste stable pendant la session ; SoundPool ne sert que si le chemin natif échoue avant la lecture. C++ : commande de clic publiée atomiquement ; les paramètres/position du clic ne sont plus modifiés concurremment par JNI et le callback audio.

Le focus audio appartient maintenant à une action sonore explicite. Passer en arrière-plan ou perdre le focus invalide les transports en cours, ferme le flux et libère le focus ; revenir dans l'application reste silencieux. Le prochain appui sur Lecture redemande le focus et rouvre Oboe sans recharger les samples. Un flux interrompu par Android est détecté comme inactif au lieu de laisser l'interface croire que la lecture continue.

**À ne pas déclarer impeccable** sans écoute/device : le mutex du callback Oboe est retiré dans le checkpoint ci-dessous ; la propagation des interruptions aux sessions Kotlin est corrigée dans le checkpoint sessions/routes ci-dessous, et la réouverture demande encore une écoute matérielle ; pédales et notes MIDI superposées sur plusieurs canaux. L'ordonnanceur est monotone à cadence 4 ms, pas calé à l'échantillon dans le callback Oboe.

SoundPool attend maintenant ses callbacks réels au lieu d'un délai fixe. Le décodage MediaCodec libère codec, extracteur et asset même en erreur, respecte offset/limite des buffers et accepte les sorties PCM 16 bits ou float.

## Troisième lot : audio maître, rendu suiveur

- `PlaybackTimeline` transforme le morceau entier en événements ordonnés et identifie chaque occurrence séparément, y compris deux notes simultanées de même hauteur.
- `TimelineTransport` tourne sur le thread dédié `PianoPlayback`, mesure le temps avec `System.nanoTime`, absorbe le jitter en drainant tous les événements franchis et publie la position visuelle à environ 60 Hz.
- Les changements de carte/mesure n'arrêtent plus les voix : une note longue traverse la barre et chaque note-off cible sa propre occurrence.
- Live joue depuis la timeline complète ; `visibleNotes` devient une projection du temps audio et ne décide plus quelles attaques sont entendues.
- Le scrub Live parcourt la timeline dans les deux sens, auditionne au plus le dernier accord traversé et déduplique les attaques pendant un geste.
- L'indicateur du bouton Lecture rend visible l'attente du chargement initial au lieu de lancer une session SoundPool puis de changer d'enveloppe en cours de morceau.
- Une reprise au milieu d'une note tenue la réattaque pour sa durée restante sur Web et Android. Une position située à la fin termine immédiatement la lecture, et une reprise hors de la plage d'une boucle revient à son début avant toute émission sonore.
- L'écoute isolée d'une phrase ou d'une plage de mesures projette temporairement les notes commencées avant la coupe et encore tenues. Les données du morceau gardent une seule attaque : une lecture complète ne crée donc aucun redoublement à la frontière.

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

## Troisième lot MIDI Web : connexions concurrentes et préférences

- Les opérations Tauri de connexion/déconnexion sont sérialisées et associées à une génération. Une sélection ou déconnexion plus récente gagne aussi dans le backend natif, même si une ancienne promesse se résout ensuite.
- Un refus d'accès Web MIDI reste retentable par une action explicite ; les appels concurrents partagent la même demande et aucun minuteur ne répète la permission.
- Les erreurs `localStorage` n'interrompent plus une connexion, une déconnexion ou la notification des réglages. Les valeurs numériques et les canaux sauvegardés sont bornés et normalisés champ par champ.
- Un débranchement physique conserve le périphérique préféré pour la reconnexion. Une déconnexion demandée par l'utilisateur efface cette préférence. Les scans natifs périmés ne remplacent plus une liste récente et un actif disparu est invalidé.

Limites : une commande native qui ne termine jamais bloque encore la file matérielle. La calibration MIDI, l'horloge des événements natifs et les consommateurs de la compensation restent le lot suivant.

## Calibration MIDI robuste

- Les frappes sont associées une seule fois aux battements dans une fenêtre de ±250 ms. Un battement manqué ou une double attaque ne décale plus toutes les paires suivantes.
- La calibration exige au moins cinq battements valides sur huit, utilise la médiane et borne la compensation à la plage des réglages, −100 à +100 ms. Un essai insuffisant n'enregistre rien.
- Une session possède désormais son compte à rebours, son intervalle et son synthé. Le démontage annule les callbacks différés et détruit la ressource, y compris si l'initialisation audio se termine après la fermeture.

## Horloge et application de la compensation MIDI

- Les messages Tauri sont horodatés à leur réception avec `performance.now()` ; l'epoch murale envoyée par Rust n'est plus mélangée à l'origine temporelle Web MIDI. Le délai IPC fait ainsi partie de la calibration observée.
- La compensation décale maintenant les attaques et relâchements de l'enregistrement, ainsi que le jugement Live. Les temps proches du début sont bornés à zéro et les notes finalisées gardent une durée positive dans la phrase.
- Le monitoring audio du clavier reste immédiat : aucune temporisation n'est ajoutée au son direct.
- Réglages observe désormais la fin d'initialisation et les changements de paramètres. Actualiser attend le vrai scan et fusionne les clics répétés pendant la même requête.

Limites : le timestamp natif inclut la traversée IPC et demande une validation avec clavier physique. En mode attente, le temps du morceau reste volontairement figé. `LatencyWizard` et l'epoch du backend Rust sont inchangés.

## Checkpoint Oboe : commandes bornées et voix appartenant au callback

- `voice_mixer.h` contient le mixeur C++ indépendant d'Android. Seul le callback modifie les voix, leurs enveloppes et le clic. JNI sérialise les producteurs avec un mutex que le rendu ne prend jamais.
- Une file préallouée de 256 commandes transfère attaques, relâchements et clics. Chaque callback consomme un instantané borné de la file ; seules des opérations atomiques 32 bits garanties sans verrou sont utilisées pour la coordination.
- Saturation : la commande qui ne rentre pas est refusée et invalide la génération. Le callback suivant coupe les voix/clics de l'ancienne génération et ignore ses commandes en attente. Si la saturation survient pendant le mixage, le buffer est remis à zéro dès que l'invalidation est observée. Cette politique peut perdre des attaques sous surcharge ; elle empêche qu'un note-off perdu laisse une voix tenue.
- Fermeture/reprise : publication d'une nouvelle génération, sans réinitialiser les indices de la file ni modifier les voix depuis le thread de gestion. Les anciennes commandes et clics ne reviennent pas au redémarrage.
- Tests C++ : ordre on/off, même hauteur avec IDs distincts, vol de la 65e voix et ancien note-off, préférence des voix en release, saturation, clic actif/en attente, purge et génération, producteur suspendu, invalidation pendant le rendu, bouclage des indices, stress concurrent de 100 000 paires, interpolation stéréo et fin de sample. Les allocations C++ dans le rendu sont interdites par le harnais de test.

Les risques P2 laissés ouverts par ce premier checkpoint sont traités dans le lot sessions/routes ci-dessous. La fermeture Oboe reste bloquante sur le chemin de focus, et `release()` reste un chemin dormant à sécuriser. Aucun changement aux P2 sessions/routes, au fallback SoundPool ou au métronome d'aperçu des Réglages. Les underruns, la latence et les changements de périphérique restent à vérifier sur téléphone.

## Checkpoint sessions/routes : interruption native et émission appartenant à une session

- Une erreur du flux incrémente une révision native avant sa fermeture. Oboe notifie ensuite `onNativeOutputInterrupted` par JNI, après libération du mutex de flux pour éviter l'inversion avec le verrou Kotlin. La méthode est conservée par `@Keep` lors de la minification.
- Le contrôleur réconcilie aussi cette révision avant et après la préparation audio. Si une note MIDI arrive avant la notification, les anciennes sessions, voix, files MIDI et pédales sont invalidées avant la réouverture. Une notification retardée déjà traitée ne coupe pas le nouveau propriétaire.
- Si le redémarrage trouve lui-même l'ancien flux inactif avant son callback d'erreur, il enregistre l'interruption avant de le remplacer. Une interruption découverte pendant l'ouverture fait échouer cette tentative ; l'action explicite suivante peut reprendre. Aucune session périmée n'est rendue utilisable.
- `PlaybackAudio.playVoice` et `playClick` exigent maintenant la session. `withPlayback` valide le propriétaire et émet sous le même verrou que les interruptions. Le transport transmet son ID pour les attaques, les restaurations de tenues, le count-in et les clics ; le scrub transmet également son ID.
- Le monitoring MIDI reste une action explicite indépendante du transport ; le chemin SoundPool conserve ses appels et bénéficie du même contrôle de session pour la partition.

Tests déterministes : notification sans polling ; MIDI qui rouvre avant une notification retardée ; interruption pendant l'ouverture ; ancien contrôle de session suivi d'une perte/réacquisition du focus avant l'attaque ou le clic ; vraie exécution du transport interrompue juste avant une attaque ou une restauration de tenue. Aucun rendu UI modifié. La fermeture bloquante, la destruction dormante de `release()`, l'aperçu AudioTrack des Réglages et la validation matérielle restent des sujets séparés.
