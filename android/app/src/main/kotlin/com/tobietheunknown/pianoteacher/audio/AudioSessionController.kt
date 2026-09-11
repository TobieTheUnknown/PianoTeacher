package com.tobietheunknown.pianoteacher.audio

import java.util.concurrent.Executor

/**
 * Audio focus belongs to an audible user action, never to entering an Activity.
 * Session ids invalidate an interrupted transport even if a newer Play already
 * acquired focus. The shared lock also serializes voice creation with focus loss.
 */
class AudioSessionController(
    private val lock: Any = Any(),
    private val requestFocus: () -> Boolean,
    private val abandonFocus: () -> Unit,
    openOutput: () -> Boolean,
    private val silenceOutput: () -> Unit,
    closeOutput: () -> Unit = {},
    private val outputRevision: () -> Long = { 0L },
    executor: Executor = audioOutputExecutor,
) {
    private val output = SerialAudioOutput(executor, openOutput, closeOutput)
    private var foreground = false
    private var focused = false
    private var interrupted = false
    private var nextSession = 1L
    private val sessions = mutableSetOf<Long>()
    private var observedOutputRevision = 0L
    private var generation = 1L
    private var preparations = 0

    /** Called by JNI notification and before output use; delayed notifications are idempotent. */
    fun reconcileOutput(): Boolean = synchronized(lock) {
        val revision = outputRevision()
        if (revision == observedOutputRevision) return@synchronized false
        observedOutputRevision = revision
        interrupt()
        true
    }

    fun setForeground(value: Boolean) = synchronized(lock) {
        foreground = value
        if (!value) interrupt() else interrupted = false
    }

    suspend fun beginPlayback(): Long {
        val prepared = prepare(explicit = true) ?: return 0L
        return withPrepared(prepared, 0L) { nextSession++.also(sessions::add) }
    }

    fun isActive(session: Long): Boolean = synchronized(lock) {
        reconcileOutput()
        focused && foreground && output.isReady() && session in sessions
    }

    /** The owner check and emission share the focus/voice lock, including on SoundPool. */
    fun <T> withPlayback(session: Long, rejected: T, emit: () -> T): T = synchronized(lock) {
        if (!isActive(session)) return@synchronized rejected
        emit()
    }

    fun <T> withPrepared(ticket: Long, rejected: T, emit: () -> T): T = synchronized(lock) {
        reconcileOutput()
        if (ticket != generation || !focused || !foreground || !output.isReady()) return@synchronized rejected
        emit()
    }

    fun endPlayback(session: Long) = synchronized(lock) { sessions.remove(session); Unit }

    suspend fun prepareOutput(explicit: Boolean = false): Boolean = prepare(explicit) != null

    suspend fun prepare(explicit: Boolean = false): Long? {
        val (ticket, opening) = synchronized(lock) {
            reconcileOutput()
            if (!foreground || (interrupted && !explicit)) return null
            if (explicit) interrupted = false
            if (!focused) {
                if (!requestFocus()) return null
                focused = true
            }
            preparations++
            generation to output.open()
        }
        try {
            val opened = opening.await() // No voice/session lock while the device is busy.
            return synchronized(lock) {
                if (ticket != generation || reconcileOutput()) null
                else if (!opened) { interrupt(); null }
                else if (!foreground || !focused) null
                else ticket
            }
        } finally {
            synchronized(lock) { preparations-- }
        }
    }

    /** Includes duck requests: piano practice pauses instead of playing inaudibly. */
    fun interrupt() = synchronized(lock) {
        interrupted = true
        generation++
        sessions.clear()
        silenceOutput()
        output.close()
        if (focused) {
            focused = false
            abandonFocus()
        }
    }

    /** Called after release tails, and checked again under the voice/session lock. */
    fun releaseIfIdle(hasVoices: Boolean) = synchronized(lock) {
        if (!hasVoices && preparations == 0 && sessions.isEmpty() && focused) {
            generation++
            silenceOutput()
            output.close()
            focused = false
            abandonFocus()
        }
    }
}
