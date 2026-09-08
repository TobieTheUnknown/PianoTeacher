package com.tobietheunknown.pianoteacher.data.parser

import org.junit.Assert.*
import org.junit.Test

class SongJsonParserTest {
    private val legacy = """{"id":"s","title":"Legacy","key":"F#m","timeSignature":{"numerator":6,"denominator":8},
        "phrases":[{"id":"p","name":"Phrase","length":1,
        "melody":[{"pitch":"E#4","startTime":0,"duration":0.5}],
        "chords":[{"pitch":"Cb3","startTime":0,"duration":1}],
        "handSeparators":[{"fromMeasure":0,"pitch":"C4"}]}]}"""

    @Test fun legacyExportKeepsBothHandsAndEnharmonicOctaves() {
        val song = SongJsonParser.parse(legacy).getOrThrow()
        assertEquals("F#", song.key.note)
        assertEquals("minor", song.key.mode)
        assertEquals(3.0, song.beatsPerMeasure, 0.0)
        assertEquals(65, song.phrases[0].tracks.melody[0].pitch)
        assertEquals(47, song.phrases[0].tracks.chords[0].pitch)
        assertEquals(60, song.phrases[0].handSeparators[0].pitch)
        assertTrue(song.phrases[0].tracks.melody[0].id.isNotEmpty())
    }

    @Test fun invalidNotesAndTimingFailBeforeImport() {
        assertTrue(SongJsonParser.parse(legacy.replace("E#4", "C20")).isFailure)
        assertTrue(SongJsonParser.parse(legacy.replace("\"denominator\":8", "\"denominator\":0")).isFailure)
        assertTrue(SongJsonParser.parse(legacy.replace("\"duration\":0.5", "\"duration\":-1")).isFailure)
        assertTrue(SongJsonParser.parseLibrary("[$legacy,{}]").isFailure)
    }
}
