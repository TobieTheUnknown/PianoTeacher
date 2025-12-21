import { Renderer, Stave, StaveNote, Formatter, Voice, Accidental } from 'vexflow';
import jsPDF from 'jspdf';

/**
 * Converts a MIDI note name to VexFlow notation
 * Example: "C4" -> "c/4", "C#4" -> "c#/4", "Bb3" -> "bb/3"
 */
function midiNoteToVexFlow(noteName) {
    // Extract the note letter, accidental, and octave
    const match = noteName.match(/^([A-G])(#|b)?(\d+)$/);
    if (!match) {
        console.warn(`Invalid note name: ${noteName}`);
        return 'c/4'; // Default fallback
    }

    const [, letter, accidental = '', octave] = match;

    // VexFlow uses lowercase letters
    const vexLetter = letter.toLowerCase();
    const vexAccidental = accidental;
    const vexOctave = octave;

    return `${vexLetter}${vexAccidental}/${vexOctave}`;
}

/**
 * Determines the duration of a note in VexFlow format
 * Based on MIDI duration (in beats)
 */
function getDuration(durationBeats) {
    if (durationBeats >= 4) return 'w'; // whole note
    if (durationBeats >= 2) return 'h'; // half note
    if (durationBeats >= 1) return 'q'; // quarter note
    if (durationBeats >= 0.5) return '8'; // eighth note
    return '16'; // sixteenth note
}

/**
 * Groups notes by start time to find chords
 */
function groupNotesByTime(notes) {
    const groups = {};
    const EPSILON = 0.001;

    // Filter out invalid notes
    const validNotes = notes.filter(note => note && note.name && note.startTime !== undefined);

    validNotes.forEach(note => {
        const time = Math.round(note.startTime * 1000) / 1000;

        // Find existing group within epsilon
        let foundGroup = false;
        for (const existingTime in groups) {
            if (Math.abs(parseFloat(existingTime) - time) < EPSILON) {
                groups[existingTime].push(note);
                foundGroup = true;
                break;
            }
        }

        if (!foundGroup) {
            groups[time] = [note];
        }
    });

    return Object.entries(groups)
        .map(([time, notes]) => ({
            time: parseFloat(time),
            notes: notes.sort((a, b) => {
                // Sort by pitch (higher notes first for better visual)
                if (!a.name || !b.name) return 0;
                const matchA = a.name.match(/\d+$/);
                const matchB = b.name.match(/\d+$/);
                if (!matchA || !matchB) return 0;
                const pitchA = parseInt(matchA[0]);
                const pitchB = parseInt(matchB[0]);
                return pitchB - pitchA;
            })
        }))
        .sort((a, b) => a.time - b.time);
}

/**
 * Creates StaveNotes from grouped MIDI notes
 */
function createStaveNotes(noteGroups) {
    return noteGroups.map(group => {
        const { notes } = group;
        // Filter out any invalid notes
        const validNotes = notes.filter(n => n && n.name && n.duration !== undefined);
        if (validNotes.length === 0) {
            // Return a rest if no valid notes
            return new StaveNote({ keys: ['b/4'], duration: 'qr' });
        }
        const duration = getDuration(validNotes[0].duration);

        if (validNotes.length === 1) {
            // Single note
            const vexNote = midiNoteToVexFlow(validNotes[0].name);
            const staveNote = new StaveNote({
                keys: [vexNote],
                duration: duration
            });

            // Add accidentals if needed
            if (validNotes[0].name.includes('#')) {
                staveNote.addModifier(new Accidental('#'), 0);
            } else if (validNotes[0].name.includes('b')) {
                staveNote.addModifier(new Accidental('b'), 0);
            }

            return staveNote;
        } else {
            // Chord (multiple notes at same time)
            const vexNotes = validNotes.map(n => midiNoteToVexFlow(n.name));
            const staveNote = new StaveNote({
                keys: vexNotes,
                duration: duration
            });

            // Add accidentals for each note in the chord
            validNotes.forEach((note, index) => {
                if (note.name.includes('#')) {
                    staveNote.addModifier(new Accidental('#'), index);
                } else if (note.name.includes('b')) {
                    staveNote.addModifier(new Accidental('b'), index);
                }
            });

            return staveNote;
        }
    });
}

/**
 * Generates a sheet music PDF from a song's MIDI data
 */
export async function generatePartitionPDF(song) {
    try {
        // Create a container div for VexFlow rendering
        const containerDiv = document.createElement('div');
        containerDiv.style.width = '800px';
        containerDiv.style.height = '1000px';
        document.body.appendChild(containerDiv);

        // Create VexFlow renderer
        const renderer = new Renderer(containerDiv, Renderer.Backends.SVG);
        renderer.resize(800, 1000);
        const context = renderer.getContext();

        let yPosition = 40;
        const staveWidth = 700;
        const stavePadding = 100;

        // Process each phrase
        song.phrases.forEach((phrase, phraseIndex) => {
            // Combine melody and chords for complete notation
            const allNotes = [
                ...phrase.tracks.melody,
                ...phrase.tracks.chords
            ];

            if (allNotes.length === 0) return;

            // Group notes by time
            const noteGroups = groupNotesByTime(allNotes);

            // Split into measures (4 beats per measure)
            const measuresData = [];
            let currentMeasure = [];
            let currentBeat = 0;

            noteGroups.forEach(group => {
                const measureNumber = Math.floor(group.time / 4);

                if (measureNumber !== Math.floor(currentBeat / 4) && currentMeasure.length > 0) {
                    measuresData.push(currentMeasure);
                    currentMeasure = [];
                }

                currentMeasure.push(group);
                currentBeat = group.time;
            });

            if (currentMeasure.length > 0) {
                measuresData.push(currentMeasure);
            }

            // Render each measure
            measuresData.forEach((measureGroups, measureIndex) => {
                // Create a stave
                const stave = new Stave(50, yPosition, staveWidth);

                // Add clef and time signature to first stave
                if (phraseIndex === 0 && measureIndex === 0) {
                    stave.addClef('treble').addTimeSignature('4/4');
                }

                stave.setContext(context).draw();

                // Create notes for this measure
                const staveNotes = createStaveNotes(measureGroups);

                // Create a voice and add notes
                const voice = new Voice({ num_beats: 4, beat_value: 4 });
                voice.addTickables(staveNotes);

                // Format and draw
                new Formatter()
                    .joinVoices([voice])
                    .format([voice], staveWidth - 100);

                voice.draw(context, stave);

                yPosition += stavePadding;

                // Add new page if needed
                if (yPosition > 900) {
                    yPosition = 40;
                }
            });
        });

        // Get the SVG element
        const svgElement = containerDiv.querySelector('svg');

        // Create PDF
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [800, 1000]
        });

        // Convert SVG to PDF
        await pdf.svg(svgElement, {
            x: 0,
            y: 0,
            width: 800,
            height: 1000
        });

        // Convert PDF to base64 for storage
        const pdfBase64 = pdf.output('dataurlstring');

        // Cleanup
        document.body.removeChild(containerDiv);

        return {
            success: true,
            pdfBase64,
            fileName: `${song.title || 'partition'}.pdf`
        };

    } catch (error) {
        console.error('Error generating partition:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
