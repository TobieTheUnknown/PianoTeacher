package com.tobietheunknown.pianoteacher.midi

/** MIDI byte-stream decoder. Packets may split messages or use running status. */
internal class MidiByteParser(private val emit: (MidiEvent) -> Unit) {
    private var status = 0
    private var count = 0
    private var first = 0
    private var sysex = false

    @Synchronized fun reset() {
        status = 0
        count = 0
        sysex = false
    }

    @Synchronized fun accept(bytes: ByteArray, offset: Int, length: Int) {
        require(offset >= 0 && length >= 0 && offset <= bytes.size - length)
        for (index in offset until offset + length) {
            val byte = bytes[index].toInt() and 0xff
            // Realtime messages can occur inside any other message, including SysEx.
            if (byte >= 0xf8) continue
            if (byte >= 0x80) {
                count = 0
                sysex = byte == 0xf0
                status = when (byte) {
                    in 0x80..0xef, 0xf1, 0xf2, 0xf3 -> byte
                    else -> 0
                }
                continue
            }
            if (sysex || status == 0) continue
            val size = when {
                status == 0xf1 || status == 0xf3 -> 1
                status == 0xf2 -> 2
                (status and 0xf0) in listOf(0xc0, 0xd0) -> 1
                else -> 2
            }
            if (count == 0) first = byte
            count++
            if (count < size) continue
            val channel = status and 0x0f
            when (status and 0xf0) {
                0x90 -> emit(if (byte == 0) MidiEvent.NoteOff(first, channel) else MidiEvent.NoteOn(first, byte, channel))
                0x80 -> emit(MidiEvent.NoteOff(first, channel))
                0xb0 -> if (first == 64) emit(MidiEvent.SustainPedal(byte >= 64, channel))
            }
            count = 0
            // Only channel messages establish running status.
            if (status >= 0xf0) status = 0
        }
    }
}
