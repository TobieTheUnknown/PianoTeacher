package com.tobietheunknown.pianoteacher.audio

/** Caller holds the engine voice lock. Reservations survive opening, but never a note-off. */
class MidiVoiceRegistry {
    data class Released(val id: Long, val pending: Boolean)
    private val byPitch = mutableMapOf<Int, java.util.ArrayDeque<Long>>()
    private val pending = mutableSetOf<Long>()

    fun reserve(pitch: Int, id: Long) {
        byPitch.getOrPut(pitch) { java.util.ArrayDeque() }.addLast(id)
        pending.add(id)
    }

    fun activate(id: Long): Boolean = pending.remove(id)
    fun hasPending(): Boolean = pending.isNotEmpty()

    fun release(pitch: Int): Released? {
        val queue = byPitch[pitch] ?: return null
        val id = queue.pollFirst() ?: return null
        if (queue.isEmpty()) byPitch.remove(pitch)
        return Released(id, pending.remove(id))
    }

    fun cancel(id: Long) {
        pending.remove(id)
        byPitch.values.forEach { it.remove(id) }
        byPitch.entries.removeAll { it.value.isEmpty() }
    }

    fun clear() { byPitch.clear(); pending.clear() }
}
