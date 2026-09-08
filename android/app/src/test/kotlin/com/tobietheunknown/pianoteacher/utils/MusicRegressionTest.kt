package com.tobietheunknown.pianoteacher.utils

import org.junit.Assert.*
import org.junit.Test

class MusicRegressionTest {
    @Test fun exactSeventhBeforeBassTriad() {
        val chord = identifyChord(listOf(62, 65, 69, 70), true)!!
        assertEquals(10, chord.rootPitchClass)
        assertEquals("Maj7", chord.quality)
    }
    @Test fun storedSpellingAndOctaveSurvive() {
        val cb = musicKeySignatureFromStored(com.tobietheunknown.pianoteacher.data.model.KeySignature("Cb", "major"))!!
        assertEquals("Cb-major", cb.keyName)
        assertEquals("Dob4", midiToFrench(59, keySignature = cb))
        val fs = musicKeySignatureFromStored(com.tobietheunknown.pianoteacher.data.model.KeySignature("F#", "major"))!!
        assertEquals("Mi#4", midiToFrench(65, keySignature = fs))
    }
    @Test fun changingMotifsWithinOneMeasure() {
        val pitches = listOf(60,64,65,60,64,65,60,64,65,64,65,64,65)
        val notes = pitches.mapIndexed { i, pitch -> com.tobietheunknown.pianoteacher.data.model.NoteEvent("$i", pitch, i * 0.25, 0.25) }
        val segments = segmentRepeatedMotifs(notes)
        assertEquals(listOf(3, 2), segments.map { it.repetitions })
        assertEquals(listOf(listOf(60,64,65), listOf(64,65)), segments.map { it.groups.map { g -> g.first().pitch } })
    }
    @Test fun fastSequentialNotesAreNotCollapsedIntoChords() {
        val pitches = listOf(60,64,65,60,64,65)
        val notes = pitches.mapIndexed { i, pitch ->
            com.tobietheunknown.pianoteacher.data.model.NoteEvent("$i", pitch, i / 16.0, 1 / 16.0)
        }
        val segments = segmentRepeatedMotifs(notes)
        assertEquals(2, segments.single().repetitions)
        assertEquals(listOf(60,64,65), segments.single().groups.map { it.single().pitch })
    }
    @Test fun armureAndAccidentalMemory() {
        val key = musicKeySignatureFromStored(com.tobietheunknown.pianoteacher.data.model.KeySignature("G", "major"))!!
        val state = AccidentalState(key)
        assertNull(state.next(spellMidiForStaff(66, key, false)))
        assertEquals("♮", state.next(spellMidiForStaff(65, key, false)))
        assertNull(state.next(spellMidiForStaff(65, key, false)))
        assertEquals("♯", state.next(spellMidiForStaff(66, key, false)))
    }
    @Test fun statisticalKeyFixtureMatchesWeb() {
        val key = detectKeySignature(listOf(60, 64, 68), listOf(1.0, 1.0, 1.0))
        assertEquals(0, key.root)
        assertFalse(key.isMinor)
    }
    @Test fun measureHarmonyIsGroundedAndConsistent() {
        assertNull(getMeasureHarmony(listOf(60, 64, 65), null))
        val harmony = getMeasureHarmony(listOf(60, 64, 67, 69), null)!!
        assertEquals("6", harmony.chord.quality)
        assertEquals(0, harmony.chord.rootPitchClass)
        assertEquals("DO 6", harmony.label)
    }
    @Test fun beamsFollowSimpleAndCompoundPulses() {
        val eighths = List(8) { BeamItem(it * 0.5, 0.5, 1) }
        assertEquals(listOf(2,2,2,2), computeBeamGroups(eighths, 4, 4).map { it.size })
        assertEquals(listOf(3,3), computeBeamGroups(eighths.take(6), 6, 8).map { it.size })
    }
    @Test fun sustainedNotesBecomeTiedStaffFragments() {
        val note = com.tobietheunknown.pianoteacher.data.model.NoteEvent("held", 60, 3.0, 6.0)
        val fragments = (0..2).mapNotNull { measure ->
            sliceNotesForStaff(listOf(note), measure * 4.0, (measure + 1) * 4.0).singleOrNull()
        }
        assertEquals(listOf(1.0, 4.0, 1.0), fragments.map { it.note.duration })
        assertEquals(listOf(false, true, true), fragments.map { it.tieFromPrevious })
        assertEquals(listOf(true, true, false), fragments.map { it.tieToNext })
    }
}
