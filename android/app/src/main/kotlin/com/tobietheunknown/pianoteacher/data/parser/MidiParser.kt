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
            val sortedTracks = rawMidi.tracks.sortedBy { track -> track.notes.map { it.pitch }.average() }
            fun events(tracks: List<RawTrack>) = tracks.flatMap { track -> track.notes.map { n ->
                NoteEvent(UUID.randomUUID().toString(), n.pitch,
                    n.startTick.toDouble() / ticksPerBeat, n.durationTicks.toDouble() / ticksPerBeat)
            } }.sortedBy { it.startTime }
            chordNotes = events(sortedTracks.take(1))
            melodyNotes = events(sortedTracks.drop(1))
        } else {
            melodyNotes = rightHand
            chordNotes = rightHandLow
        }

        // Split into phrases based on silence gaps
        val phrases = splitIntoPhrases(melodyNotes, chordNotes, timeSignature.numerator * 4.0 / timeSignature.denominator)

        Song(
            id = UUID.randomUUID().toString(),
            title = title,
            artist = "",
            key = rawMidi.keySignature ?: detectKey(allNotes),
            tempo = tempo,
            timeSignature = timeSignature,
            phrases = phrases,
            createdAt = java.time.Instant.now().toString()
        )
    }

    private fun splitIntoPhrases(
        melody: List<NoteEvent>,
        chords: List<NoteEvent>,
        beatsPerMeasure: Double
    ): List<Phrase> {
        if (melody.isEmpty() && chords.isEmpty()) return emptyList()

        val allNotes = (melody + chords).sortedBy { it.startTime }
        val totalBeats = allNotes.maxOf { it.startTime + it.duration }

        // Find natural phrase boundaries based on silences
        val boundaries = mutableListOf(0.0)
        var prevEnd = 0.0

        for ((index, note) in allNotes.withIndex()) {
            val gap = note.startTime - prevEnd
            // The silence before the first note belongs to the score. Splitting
            // there would silently erase an intro or a long pickup.
            if (index > 0 && gap >= SILENCE_GAP_BEATS && note.startTime - boundaries.last() >= MIN_PHRASE_BEATS) {
                // Snap to nearest measure boundary
                val boundary = kotlin.math.floor(note.startTime / beatsPerMeasure) * beatsPerMeasure
                if (boundary > boundaries.last() && boundary >= prevEnd) boundaries.add(boundary)
            }
            prevEnd = maxOf(prevEnd, note.startTime + note.duration)
        }
        boundaries.add(totalBeats)

        return boundaries.zipWithNext { start, end ->
            val phraseBeats = end - start
            val phraseMeasures = maxOf(1, kotlin.math.ceil(phraseBeats / beatsPerMeasure).toInt())
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
        if (notes.isEmpty()) return KeySignature()
        val detected = com.tobietheunknown.pianoteacher.utils.detectKeySignature(
            pitches = notes.map { it.pitch },
            durations = notes.map { it.duration },
        )
        val names = if (detected.useFlats) {
            arrayOf("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B")
        } else {
            arrayOf("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
        }
        return KeySignature(
            note = names[detected.root],
            mode = if (detected.isMinor) "minor" else "major",
        )
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
        val timeSignature: TimeSignature,
        val keySignature: KeySignature?
    )

    private class MidiReader(private val data: ByteArray) {
        private var pos = 0

        fun read(): RawMidi {
            // Header chunk
            expect("MThd")
            val headerLength = readInt32()
            val format = readInt16()
            require(format in 0..1) { "Independent MIDI sequences (format 2) are not supported" }
            val numTracks = readInt16()
            val ticksPerBeat = readInt16()
            require(ticksPerBeat in 1..0x7fff) { "SMPTE MIDI timing is not supported" }
            require(headerLength >= 6) { "Invalid MIDI header length" }
            pos += headerLength - 6

            var globalTempo = 120
            var globalTimeSig = TimeSignature()
            var globalKeySig: KeySignature? = null
            val tracks = mutableListOf<RawTrack>()

            repeat(numTracks) {
                expect("MTrk")
                val trackLength = readInt32()
                val trackEnd = pos + trackLength

                // Channel is part of note identity. The deque also preserves
                // repeated same-pitch attacks before their corresponding offs.
                val noteOnTimes = mutableMapOf<Pair<Int, Int>, ArrayDeque<Long>>()
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
                                        if (us > 0 && tick == 0L) globalTempo = (60_000_000.0 / us).roundToInt()
                                    }
                                }
                                0x58 -> { // Time signature
                                    if (metaLen >= 2) {
                                        val num = data[pos].toInt() and 0xFF
                                        val den = 1 shl (data[pos+1].toInt() and 0xFF)
                                        if (tick == 0L && num > 0 && den > 0) globalTimeSig = TimeSignature(num, den)
                                    }
                                }
                                0x59 -> { // Key signature: signed flats/sharps + major/minor
                                    if (metaLen >= 2 && tick == 0L) {
                                        val accidentals = data[pos].toInt()
                                        val minor = (data[pos + 1].toInt() and 0xFF) == 1
                                        val majorNames = mapOf(
                                            -7 to "Cb", -6 to "Gb", -5 to "Db", -4 to "Ab",
                                            -3 to "Eb", -2 to "Bb", -1 to "F", 0 to "C",
                                            1 to "G", 2 to "D", 3 to "A", 4 to "E",
                                            5 to "B", 6 to "F#", 7 to "C#"
                                        )
                                        val minorNames = mapOf(
                                            -7 to "Ab", -6 to "Eb", -5 to "Bb", -4 to "F",
                                            -3 to "C", -2 to "G", -1 to "D", 0 to "A",
                                            1 to "E", 2 to "B", 3 to "F#", 4 to "C#",
                                            5 to "G#", 6 to "D#", 7 to "A#"
                                        )
                                        (if (minor) minorNames else majorNames)[accidentals]?.let { note ->
                                            globalKeySig = KeySignature(note, if (minor) "minor" else "major")
                                        }
                                    }
                                }
                            }
                            pos += metaLen
                        }
                        (statusByte and 0xF0) == 0x90 -> { // Note On
                            val channel = statusByte and 0x0F
                            val pitch = data[pos++].toInt() and 0xFF
                            val velocity = data[pos++].toInt() and 0xFF
                            val key = channel to pitch
                            if (velocity > 0) noteOnTimes.getOrPut(key) { ArrayDeque() }.addLast(tick)
                            else noteOnTimes[key]?.removeFirstOrNull()?.let { start ->
                                notes.add(RawNote(pitch, start, tick - start))
                                if (noteOnTimes[key]?.isEmpty() == true) noteOnTimes.remove(key)
                            }
                        }
                        (statusByte and 0xF0) == 0x80 -> { // Note Off
                            val channel = statusByte and 0x0F
                            val pitch = data[pos++].toInt() and 0xFF
                            pos++ // velocity
                            val key = channel to pitch
                            noteOnTimes[key]?.removeFirstOrNull()?.let { start ->
                                notes.add(RawNote(pitch, start, tick - start))
                                if (noteOnTimes[key]?.isEmpty() == true) noteOnTimes.remove(key)
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
                noteOnTimes.forEach { (key, starts) ->
                    starts.forEach { startTick ->
                        if (tick > startTick) notes.add(RawNote(key.second, startTick, tick - startTick))
                    }
                }
                pos = trackEnd
                if (notes.isNotEmpty()) tracks.add(RawTrack(notes))
            }

            return RawMidi(tracks, ticksPerBeat, globalTempo, globalTimeSig, globalKeySig)
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
