package com.tobietheunknown.pianoteacher.midi

import org.junit.Assert.*
import org.junit.Test

class MidiByteParserTest {
    @Test fun fragmentedRunningStatusAndRealtimeKeepReleases() {
        val events = mutableListOf<MidiEvent>()
        val parser = MidiByteParser(events::add)
        fun feed(vararg values: Int) = parser.accept(values.map { it.toByte() }.toByteArray(), 0, values.size)
        feed(0x92, 60)
        feed(0xf8, 100, 62, 90, 60)
        feed(0xfa, 0, 0x82, 62, 0)
        assertEquals(listOf(MidiEvent.NoteOn(60,100,2), MidiEvent.NoteOn(62,90,2),
            MidiEvent.NoteOff(60,2), MidiEvent.NoteOff(62,2)), events)
    }

    @Test fun systemMessagesAndResetCannotCreatePhantomNotes() {
        val events = mutableListOf<MidiEvent>()
        val parser = MidiByteParser(events::add)
        fun feed(vararg values: Int) = parser.accept(values.map { it.toByte() }.toByteArray(), 0, values.size)
        feed(0x90, 60, 100, 0xf0, 60, 0xf8, 127, 0xf7, 62, 90)
        feed(0xb1, 64, 127, 64, 0, 0xf2, 1, 2, 60, 100)
        feed(0x90, 65)
        parser.reset()
        feed(100)
        assertEquals(listOf(MidiEvent.NoteOn(60,100,0), MidiEvent.SustainPedal(true,1),
            MidiEvent.SustainPedal(false,1)), events)
    }
}
