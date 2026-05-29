package com.tobietheunknown.pianoteacher.data.parser

import com.tobietheunknown.pianoteacher.data.model.*
import com.tobietheunknown.pianoteacher.utils.MEASURE_EPSILON
import java.io.InputStream
import java.util.UUID
import kotlin.math.roundToInt

/**
 * Parses standard MIDI files (.mid) into Song domain objects.
 * Auto-detects hand separation based on pitch threshold.
 * Splits into phrases based on silence gaps between note clusters.
 */
object MidiParser {

    private const val HAND_SPLIT_MIDI_NOTE = 60  // Middle C — notes below = left hand
    private const val SILENCE_GAP_BEATS = 2.0    // Gap threshold to create a new phrase
    private const val MIN_PHRASE_BEATS = 4.0      // Minimum phrase length

    fun parse(input: InputStream, title: String = "Untitled"): Result<Song> = runCatching {
        val bytes = input.readBytes()
        val reader = MidiReader(bytes)
        val rawMidi = reader.read()

        val tempo = rawMidi.tempo
        val ticksPerBeat = rawMidi.ticksPerBeat
        val timeSignature = rawMidi.timeSignature

        // Collect all note events from all tracks, convert ticks → beats
        val allNotes = rawMidi.tracks.flatMap { track ->
            track.notes.map { note ->
                NoteEvent(
                    id = UUID.randomUUID().toString(),
                    pitch = note.pitch,
                    startTime = note.startTick.toDouble() / ticksPerBeat,
                    duration = note.durationTicks.toDouble() / ticksPerBeat
                )
            }
        }.sortedBy { it.startTime }

        if (allNotes.isEmpty()) return@runCatching emptySong(title, tempo, timeSignature)

        // Separate into left/right hand by pitch
        val rightHand = allNotes.filter { it.pitch >= HAND_SPLIT_MIDI_NOTE }
        val rightHandLow = allNotes.filter { it.pitch < HAND_SPLIT_MIDI_NOTE }

        // If track 0 and track 1 are separate, use track assignment instead
        val melodyNotes: List<NoteEvent>
        val chordNotes: List<NoteEvent>

        if (rawMidi.tracks.size >= 2) {
            val t0 = rawMidi.tracks[0].notes.map { n ->
                NoteEvent(UUID.randomUUID().toString(), n.pitch,
                    n.startTick.toDouble() / ticksPerBeat, n.durationTicks.toDouble() / ticksPerBeat)
            }.sortedBy { it.startTime }
            val t1 = rawMidi.tracks[1].notes.map { n ->
                NoteEvent(UUID.randomUUID().toString(), n.pitch,
                    n.startTick.toDouble() / ticksPerBeat, n.durationTicks.toDouble() / ticksPerBeat)
            }.sortedBy { it.startTime }

            // Assign higher-average-pitch track to melody
            val avgPitch0 = if (t0.isEmpty()) 0.0 else t0.map { it.pitch }.average()
            val avgPitch1 = if (t1.isEmpty()) 0.0 else t1.map { it.pitch }.average()

            if (avgPitch0 >= avgPitch1) {
                melodyNotes = t0; chordNotes = t1
            } else {
                melodyNotes = t1; chordNotes = t0
            }
        } else {
            melodyNotes = rightHand
            chordNotes = rightHandLow
        }

        // Split into phrases based on silence gaps
        val phrases = splitIntoPhrases(melodyNotes, chordNotes, timeSignature.numerator)

        Song(
            id = UUID.randomUUID().toString(),
            title = title,
            artist = "",
            key = detectKey(allNotes),
            tempo = tempo,
            timeSignature = timeSignature,
            phrases = phrases,
            createdAt = java.time.Instant.now().toString()
        )
    }

    private fun splitIntoPhrases(
        melody: List<NoteEvent>,
        chords: List<NoteEvent>,
        beatsPerMeasure: Int
    ): List<Phrase> {
        if (melody.isEmpty() && chords.isEmpty()) return emptyList()

        val allNotes = (melody + chords).sortedBy { it.startTime }
        val totalBeats = allNotes.maxOf { it.startTime + it.duration }

        // Find natural phrase boundaries based on silences
        val boundaries = mutableListOf(0.0)
        var prevEnd = 0.0

        for (note in allNotes) {
            val gap = note.startTime - prevEnd
            if (gap >= SILENCE_GAP_BEATS && note.startTime - boundaries.last() >= MIN_PHRASE_BEATS) {
                // Snap to nearest measure boundary
                val measuresElapsed = ((note.startTime / beatsPerMeasure)).roundToInt()
                boundaries.add(measuresElapsed.toDouble() * beatsPerMeasure)
            }
            prevEnd = maxOf(prevEnd, note.startTime + note.duration)
        }
        boundaries.add(totalBeats)

        return boundaries.zipWithNext { start, end ->
            val phraseBeats = end - start
            val phraseMeasures = maxOf(1, (phraseBeats / beatsPerMeasure).roundToInt())
            val phraseIndex = boundaries.indexOf(start) + 1

            val phraseMelody = melody.filter {
                it.startTime >= start - MEASURE_EPSILON && it.startTime < end - MEASURE_EPSILON
            }.map { it.copy(startTime = it.startTime - start) }
            val phraseChords = chords.filter {
                it.startTime >= start - MEASURE_EPSILON && it.startTime < end - MEASURE_EPSILON
            }.map { it.copy(startTime = it.startTime - start) }

            Phrase(
                id = UUID.randomUUID().toString(),
                name = "Phrase $phraseIndex",
                length = phraseMeasures,
                tracks = Tracks(melody = phraseMelody, chords = phraseChords)
            )
        }.filter { it.tracks.melody.isNotEmpty() || it.tracks.chords.isNotEmpty() }
    }

    private fun detectKey(notes: List<NoteEvent>): KeySignature {
        // Simple pitch-class frequency analysis
        val pitchCounts = IntArray(12)
        notes.forEach { pitchCounts[it.pitch % 12]++ }

        // Find most common note as tonic (simplified)
        val tonicIndex = pitchCounts.indices.maxByOrNull { pitchCounts[it] } ?: 0
        val noteNames = arrayOf("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

        return KeySignature(note = noteNames[tonicIndex], mode = "major")
    }

    private fun emptySong(title: String, tempo: Int, timeSig: TimeSignature) = Song(
        id = UUID.randomUUID().toString(),
        title = title,
        tempo = tempo,
        timeSignature = timeSig
    )

    // ─── Raw MIDI file reader ──────────────────────────────────────────────────

    private data class RawNote(val pitch: Int, val startTick: Long, val durationTicks: Long)
    private data class RawTrack(val notes: List<RawNote>)
    private data class RawMidi(
        val tracks: List<RawTrack>,
        val ticksPerBeat: Int,
        val tempo: Int,
        val timeSignature: TimeSignature
    )

    private class MidiReader(private val data: ByteArray) {
        private var pos = 0

        fun read(): RawMidi {
            // Header chunk
            expect("MThd")
            val headerLength = readInt32()
            val format = readInt16()
            val numTracks = readInt16()
            val ticksPerBeat = readInt16()

            var globalTempo = 120
            var globalTimeSig = TimeSignature()
            val tracks = mutableListOf<RawTrack>()

            repeat(numTracks) {
                expect("MTrk")
                val trackLength = readInt32()
                val trackEnd = pos + trackLength

                val noteOnTimes = mutableMapOf<Int, Long>() // pitch → startTick
                val notes = mutableListOf<RawNote>()
                var tick = 0L

                var lastStatus = 0

                while (pos < trackEnd) {
                    val delta = readVarLen()
                    tick += delta

                    // Running status: if byte < 0x80 it's a data byte, reuse lastStatus
                    val firstByte = data[pos].toInt() and 0xFF
                    val statusByte: Int
                    if (firstByte >= 0x80) {
                        statusByte = firstByte
                        pos++
                        if (statusByte < 0xF0) lastStatus = statusByte // channel msgs only
                    } else {
                        statusByte = lastStatus // data byte with running status
                    }

                    when {
                        statusByte == 0xFF -> { // Meta event
                            val metaType = data[pos++].toInt() and 0xFF
                            val metaLen = readVarLen()
                            when (metaType) {
                                0x51 -> { // Set tempo
                                    if (metaLen >= 3) {
                                        val us = ((data[pos].toInt() and 0xFF) shl 16) or
                                                 ((data[pos+1].toInt() and 0xFF) shl 8) or
                                                 (data[pos+2].toInt() and 0xFF)
                                        if (us > 0) globalTempo = (60_000_000.0 / us).roundToInt()
                                    }
                                }
                                0x58 -> { // Time signature
                                    if (metaLen >= 2) {
                                        val num = data[pos].toInt() and 0xFF
                                        val den = 1 shl (data[pos+1].toInt() and 0xFF)
                                        globalTimeSig = TimeSignature(num, den)
                                    }
                                }
                            }
                            pos += metaLen
                        }
                        (statusByte and 0xF0) == 0x90 -> { // Note On
                            val pitch = data[pos++].toInt() and 0xFF
                            val velocity = data[pos++].toInt() and 0xFF
                            if (velocity > 0) noteOnTimes[pitch] = tick
                            else noteOnTimes.remove(pitch)?.let { start ->
                                notes.add(RawNote(pitch, start, tick - start))
                            }
                        }
                        (statusByte and 0xF0) == 0x80 -> { // Note Off
                            val pitch = data[pos++].toInt() and 0xFF
                            pos++ // velocity
                            noteOnTimes.remove(pitch)?.let { start ->
                                notes.add(RawNote(pitch, start, tick - start))
                            }
                        }
                        statusByte in 0xA0..0xAF -> pos += 2 // Aftertouch
                        statusByte in 0xB0..0xBF -> pos += 2 // Control Change
                        statusByte in 0xC0..0xCF -> pos += 1 // Program Change
                        statusByte in 0xD0..0xDF -> pos += 1 // Channel Pressure
                        statusByte in 0xE0..0xEF -> pos += 2 // Pitch Bend
                        statusByte == 0xF0 || statusByte == 0xF7 -> { // SysEx
                            val len = readVarLen(); pos += len
                        }
                        else -> { /* unknown system msg, already advanced past status */ }
                    }
                }

                // Close any notes still open at track end (rare but valid)
                noteOnTimes.forEach { (pitch, startTick) ->
                    if (tick > startTick) notes.add(RawNote(pitch, startTick, tick - startTick))
                }
                pos = trackEnd
                if (notes.isNotEmpty()) tracks.add(RawTrack(notes))
            }

            return RawMidi(tracks, ticksPerBeat, globalTempo, globalTimeSig)
        }

        private fun expect(header: String) {
            header.forEach { require(data[pos++] == it.code.toByte()) { "Bad MIDI header" } }
        }

        private fun readInt32(): Int =
            ((data[pos++].toInt() and 0xFF) shl 24) or
            ((data[pos++].toInt() and 0xFF) shl 16) or
            ((data[pos++].toInt() and 0xFF) shl 8) or
            (data[pos++].toInt() and 0xFF)

        private fun readInt16(): Int =
            ((data[pos++].toInt() and 0xFF) shl 8) or (data[pos++].toInt() and 0xFF)

        private fun readVarLen(): Int {
            var result = 0
            var byte: Int
            do {
                byte = data[pos++].toInt() and 0xFF
                result = (result shl 7) or (byte and 0x7F)
            } while (byte and 0x80 != 0)
            return result
        }
    }
}
