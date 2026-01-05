import Vex from 'vexflow';
import { getNoteNameFromMidi, getFrenchNoteName } from '../models/song';

const { Factory, Formatter, Renderer } = Vex.Flow;

/**
 * Service pour exporter des partitions musicales à partir de données MIDI
 * Supporte l'annotation avec les noms de notes en français
 */
export class SheetMusicExportService {
    constructor() {
        this.renderer = null;
        this.context = null;
    }

    /**
     * Convertit un numéro MIDI en notation VexFlow
     * @param {number} midiNumber - Numéro MIDI (ex: 60 pour C4)
     * @returns {string} - Notation VexFlow (ex: "c/4")
     */
    midiToVexNote(midiNumber) {
        const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
        const octave = Math.floor(midiNumber / 12) - 1;
        const noteIndex = midiNumber % 12;

        let noteName = noteNames[noteIndex];

        // VexFlow utilise 'n' pour les notes naturelles avec dièse
        if (noteName.includes('#')) {
            noteName = noteName[0] + '#';
        }

        return `${noteName}/${octave}`;
    }

    /**
     * Convertit une durée en beats vers une notation VexFlow
     * @param {number} duration - Durée en beats
     * @returns {string} - Notation VexFlow (ex: "q" pour noire, "h" pour blanche)
     */
    durationToVexDuration(duration) {
        // Simplification : on arrondit aux durées standard
        if (duration >= 4) return 'w';  // Ronde (whole note)
        if (duration >= 2) return 'h';  // Blanche (half note)
        if (duration >= 1) return 'q';  // Noire (quarter note)
        if (duration >= 0.5) return '8'; // Croche (eighth note)
        if (duration >= 0.25) return '16'; // Double croche (sixteenth note)
        return '32'; // Triple croche
    }

    /**
     * Groupe les notes par mesure (4 temps par mesure par défaut)
     * @param {Array} notes - Array de {pitch: number, startTime: number, duration: number}
     * @param {number} beatsPerMeasure - Nombre de temps par mesure
     * @returns {Array} - Array de mesures, chaque mesure contenant un array de notes
     */
    groupNotesByMeasures(notes, beatsPerMeasure = 4) {
        const measures = [];
        let currentMeasure = [];
        let currentMeasureStart = 0;

        // Trier les notes par startTime
        const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

        sortedNotes.forEach(note => {
            const measureNumber = Math.floor(note.startTime / beatsPerMeasure);
            const targetMeasureStart = measureNumber * beatsPerMeasure;

            if (targetMeasureStart !== currentMeasureStart) {
                // Nouvelle mesure
                if (currentMeasure.length > 0) {
                    measures.push(currentMeasure);
                }
                currentMeasure = [];
                currentMeasureStart = targetMeasureStart;
            }

            currentMeasure.push({
                ...note,
                relativeStartTime: note.startTime - currentMeasureStart
            });
        });

        if (currentMeasure.length > 0) {
            measures.push(currentMeasure);
        }

        return measures;
    }

    /**
     * Crée une partition à partir des données d'un morceau
     * @param {Object} song - Objet song du modèle
     * @param {Object} options - Options d'export
     * @param {boolean} options.withAnnotations - Ajouter les noms de notes en français
     * @param {string} options.track - 'melody', 'chords', ou 'both'
     * @param {number} options.phraseIndex - Index de la phrase à exporter (ou null pour tout)
     * @returns {HTMLElement} - Element SVG contenant la partition
     */
    exportToSheetMusic(song, options = {}) {
        const {
            withAnnotations = false,
            track = 'both',
            phraseIndex = null
        } = options;

        // Créer un conteneur pour le rendu
        const container = document.createElement('div');
        container.style.width = '1200px';
        container.style.height = 'auto';

        // Initialiser le renderer VexFlow
        this.renderer = new Renderer(container, Renderer.Backends.SVG);
        this.renderer.resize(1200, 800);
        this.context = this.renderer.getContext();

        // Récupérer les notes à exporter
        const phrasesToExport = phraseIndex !== null
            ? [song.phrases[phraseIndex]]
            : song.phrases;

        let yPosition = 40;
        const factory = new Factory({ renderer: { elementId: null, backend: Renderer.Backends.SVG } });

        phrasesToExport.forEach((phrase, pIndex) => {
            // Pour chaque phrase, créer les portées
            const melodyNotes = track === 'chords' ? [] : phrase.tracks.melody || [];
            const chordNotes = track === 'melody' ? [] : phrase.tracks.chords || [];

            // Grouper les notes par mesures
            const melodyMeasures = this.groupNotesByMeasures(melodyNotes);
            const chordMeasures = this.groupNotesByMeasures(chordNotes);

            const maxMeasures = Math.max(melodyMeasures.length, chordMeasures.length, phrase.length);

            // Créer les systèmes de portées (groupes de 4 mesures par ligne)
            const measuresPerLine = 4;
            for (let m = 0; m < maxMeasures; m += measuresPerLine) {
                // Dessiner la portée supérieure (clé de Sol - mélodie)
                if (track !== 'chords') {
                    const trebleStave = new Vex.Flow.Stave(10, yPosition, 1100);
                    if (m === 0) {
                        trebleStave.addClef('treble').addTimeSignature('4/4');
                        if (song.key) {
                            trebleStave.addKeySignature(this.getKeySignatureString(song.key));
                        }
                    }
                    trebleStave.setContext(this.context).draw();

                    // Ajouter les notes de mélodie pour ces mesures
                    this.renderMeasuresOnStave(
                        trebleStave,
                        melodyMeasures.slice(m, m + measuresPerLine),
                        song.key,
                        withAnnotations
                    );

                    yPosition += 100;
                }

                // Dessiner la portée inférieure (clé de Fa - accords/basse)
                if (track !== 'melody') {
                    const bassStave = new Vex.Flow.Stave(10, yPosition, 1100);
                    if (m === 0) {
                        bassStave.addClef('bass').addTimeSignature('4/4');
                        if (song.key) {
                            bassStave.addKeySignature(this.getKeySignatureString(song.key));
                        }
                    }
                    bassStave.setContext(this.context).draw();

                    // Ajouter les notes d'accords pour ces mesures
                    this.renderMeasuresOnStave(
                        bassStave,
                        chordMeasures.slice(m, m + measuresPerLine),
                        song.key,
                        withAnnotations
                    );

                    yPosition += 150;
                }
            }

            yPosition += 50; // Espace entre les phrases
        });

        // Récupérer l'élément SVG généré
        const svg = container.querySelector('svg');
        if (svg) {
            // Ajuster la hauteur du SVG
            svg.setAttribute('height', yPosition.toString());
        }

        return container;
    }

    /**
     * Rend les notes sur une portée
     * @param {Stave} stave - Portée VexFlow
     * @param {Array} measures - Array de mesures contenant des notes
     * @param {Object} keySignature - Signature tonale
     * @param {boolean} withAnnotations - Ajouter les annotations
     */
    renderMeasuresOnStave(stave, measures, keySignature, withAnnotations) {
        if (!measures || measures.length === 0) return;

        const allNotes = [];

        measures.forEach(measure => {
            if (!measure || measure.length === 0) {
                // Mesure vide - ajouter un silence
                allNotes.push(
                    new Vex.Flow.StaveNote({
                        keys: ['b/4'],
                        duration: 'wr', // Whole rest
                    })
                );
            } else {
                measure.forEach(note => {
                    const vexNote = this.midiToVexNote(note.pitch);
                    const vexDuration = this.durationToVexDuration(note.duration);

                    const staveNote = new Vex.Flow.StaveNote({
                        keys: [vexNote],
                        duration: vexDuration,
                    });

                    // Ajouter des altérations si nécessaire
                    const noteName = getNoteNameFromMidi(note.pitch);
                    if (noteName.includes('#')) {
                        staveNote.addModifier(new Vex.Flow.Accidental('#'), 0);
                    } else if (noteName.includes('b')) {
                        staveNote.addModifier(new Vex.Flow.Accidental('b'), 0);
                    }

                    // Ajouter l'annotation en français si demandé
                    if (withAnnotations) {
                        const frenchName = getFrenchNoteName(note.pitch, keySignature);
                        staveNote.addModifier(
                            new Vex.Flow.Annotation(frenchName)
                                .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.BOTTOM)
                                .setFont('Arial', 10, 'italic'),
                            0
                        );
                    }

                    allNotes.push(staveNote);
                });
            }
        });

        if (allNotes.length > 0) {
            // Créer une voix et formater
            const voice = new Vex.Flow.Voice({
                num_beats: 4 * measures.length,
                beat_value: 4,
            });
            voice.setStrict(false); // Permettre des mesures incomplètes
            voice.addTickables(allNotes);

            // Formater et dessiner
            new Formatter()
                .joinVoices([voice])
                .format([voice], stave.getWidth() - 20);

            voice.draw(this.context, stave);
        }
    }

    /**
     * Convertit la signature tonale en string VexFlow
     * @param {Object} key - {note: 'C', mode: 'major'}
     * @returns {string} - String VexFlow (ex: 'C', 'Am', 'G', etc.)
     */
    getKeySignatureString(key) {
        if (!key || !key.note) return 'C';

        // VexFlow utilise la convention anglaise
        const keyMap = {
            'C': 'C', 'G': 'G', 'D': 'D', 'A': 'A', 'E': 'E', 'B': 'B', 'F#': 'F#',
            'F': 'F', 'Bb': 'Bb', 'Eb': 'Eb', 'Ab': 'Ab', 'Db': 'Db', 'Gb': 'Gb'
        };

        const baseKey = keyMap[key.note] || 'C';

        // Pour les tonalités mineures, ajouter 'm'
        return key.mode === 'minor' ? `${baseKey}m` : baseKey;
    }

    /**
     * Exporte la partition en tant qu'image PNG
     * @param {Object} song - Objet song
     * @param {Object} options - Options d'export
     * @returns {Promise<Blob>} - Promise contenant le blob PNG
     */
    async exportToPNG(song, options = {}) {
        const svgContainer = this.exportToSheetMusic(song, options);
        const svg = svgContainer.querySelector('svg');

        if (!svg) {
            throw new Error('Impossible de générer le SVG');
        }

        // Convertir SVG en PNG
        return new Promise((resolve, reject) => {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Impossible de créer le blob PNG'));
                    }
                }, 'image/png');
            };

            img.onerror = reject;
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
    }

    /**
     * Exporte la partition en tant que fichier SVG
     * @param {Object} song - Objet song
     * @param {Object} options - Options d'export
     * @returns {Blob} - Blob SVG
     */
    exportToSVG(song, options = {}) {
        const svgContainer = this.exportToSheetMusic(song, options);
        const svg = svgContainer.querySelector('svg');

        if (!svg) {
            throw new Error('Impossible de générer le SVG');
        }

        const svgData = new XMLSerializer().serializeToString(svg);
        return new Blob([svgData], { type: 'image/svg+xml' });
    }
}

// Exporter une instance singleton
export const sheetMusicExportService = new SheetMusicExportService();
