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
}
