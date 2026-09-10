package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.*
import org.junit.Assert.*
import org.junit.Test

class PhraseEditingTest {
    @Test fun splitAndMergePreservePositionsSilenceAndSeparators() {
        val phrase = Phrase(
            id = "p", name = "P", length = 4,
            tracks = Tracks(melody = listOf(
                NoteEvent("a", 60, 3.0, 1.0), NoteEvent("b", 64, 9.0, 1.0),
            )),
            handSeparators = listOf(HandSeparator(0, 58), HandSeparator(2, 61)),
        )
        val (before, after) = splitPhraseAtMeasure(phrase, 2, 4.0)!!
        assertEquals(1.0, after.tracks.melody.single().startTime, 0.0)
        assertEquals(listOf(HandSeparator(0, 61)), after.handSeparators)
        val merged = mergePhrases(before, after, 4.0)
        assertEquals(4, merged.length)
        assertEquals(listOf(3.0, 9.0), merged.tracks.melody.map { it.startTime })
        assertEquals(phrase.handSeparators, merged.handSeparators)
    }

    @Test fun `compound meter split preserves crossing holds in both hands without duplication`() {
        val phrase = Phrase("p", "P", 4, Tracks(
            melody = listOf(NoteEvent("held", 60, 5.0, 4.0), NoteEvent("edge", 64, 6.0, 1.0)),
            chords = listOf(NoteEvent("bass", 48, 0.0, 10.0), NoteEvent("later", 52, 8.0, 1.0)),
        ), listOf(HandSeparator(0, 59)))
        val (before, after) = splitPhraseAtMeasure(phrase, 2, 3.0)!!
        assertEquals(4.0, before.tracks.melody.single().duration, 0.0)
        assertEquals(10.0, before.tracks.chords.single().duration, 0.0)
        assertEquals(0.0, after.tracks.melody.single().startTime, 0.0)
        assertEquals(2.0, after.tracks.chords.single().startTime, 0.0)
        assertEquals(listOf(HandSeparator(0, 59)), after.handSeparators)
        assertEquals(phrase.tracks, mergePhrases(before, after, 3.0).tracks)
        assertEquals(4, mergePhrases(before, after, 3.0).length)
    }

    @Test fun `invalid measure units cannot silently discard notes`() {
        val phrase = Phrase("p", "P", 4, Tracks(melody = listOf(NoteEvent("n", 60, 1.0, 1.0))))
        for (units in listOf(0.0, -1.0, Double.NaN, Double.POSITIVE_INFINITY)) {
            assertNull(splitPhraseAtMeasure(phrase, 2, units))
        }
    }
}
