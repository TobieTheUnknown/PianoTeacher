package com.tobietheunknown.pianoteacher.data.parser

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream

class MidiParserTest {
    private fun bytes(vararg values: Int) = values.map(Int::toByte).toByteArray()

    private fun vlq(value: Int): ByteArray {
        var buffer = value and 0x7f
        val out = mutableListOf<Int>()
        while (true) {
            out.add(0, buffer)
            if (value shr (out.size * 7) == 0) break
            buffer = ((value shr (out.size * 7)) and 0x7f) or 0x80
        }
        return bytes(*out.toIntArray())
    }

    private fun midi(track: ByteArray): ByteArray {
        val output = ByteArrayOutputStream()
        output.write("MThd".toByteArray())
        output.write(bytes(0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0)) // format 0, one track, PPQ 480
        output.write("MTrk".toByteArray())
        output.write(bytes(track.size ushr 24, track.size ushr 16, track.size ushr 8, track.size))
        output.write(track)
        return output.toByteArray()
    }

    @Test fun explicitMinorKeyAndOverlappingChannelsArePreserved() {
        val track = ByteArrayOutputStream().apply {
            write(bytes(0, 0xff, 0x59, 2, 0xfb, 1)) // five flats, minor = Bb minor
            write(bytes(0, 0x90, 60, 100))
            write(bytes(0, 0x91, 60, 100))
            write(vlq(480)); write(bytes(0x80, 60, 0))
            write(vlq(480)); write(bytes(0x81, 60, 0))
            write(bytes(0, 0xff, 0x2f, 0))
        }.toByteArray()
        val song = MidiParser.parse(midi(track).inputStream(), "Channels").getOrThrow()
        assertEquals("Bb", song.key.note)
        assertEquals("minor", song.key.mode)
        assertEquals(listOf(1.0, 2.0), song.phrases.single().tracks.melody.map { it.duration }.sorted())
    }

    @Test fun initialSilenceRemainsInTheFirstPhrase() {
        val track = ByteArrayOutputStream().apply {
            write(vlq(1920)); write(bytes(0x90, 72, 100))
            write(vlq(480)); write(bytes(0x80, 72, 0))
            write(bytes(0, 0xff, 0x2f, 0))
        }.toByteArray()
        val song = MidiParser.parse(midi(track).inputStream(), "Intro").getOrThrow()
        assertEquals(4.0, song.phrases.single().tracks.melody.single().startTime, 0.0)
        assertEquals(2, song.phrases.single().length)
    }
}
