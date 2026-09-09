package com.tobietheunknown.pianoteacher.audio

/**
 * Audio focus belongs to an audible user action, never to entering an Activity.
 * Session ids invalidate an interrupted transport even if a newer Play already
 * acquired focus. The shared lock also serializes voice creation with focus loss.
 */
class AudioSessionController(
    private val lock: Any = Any(),
    private val requestFocus: () -> Boolean,
    private val abandonFocus: () -> Unit,
    private val openOutput: () -> Boolean,
    private val silenceAndCloseOutput: () -> Unit,
) {
    private var foreground = false
    private var focused = false
    private var interrupted = false
    private var nextSession = 1L
    private val sessions = mutableSetOf<Long>()

    fun setForeground(value: Boolean) = synchronized(lock) {
        foreground = value
        if (!value) interrupt() else interrupted = false
    }

    fun beginPlayback(): Long = synchronized(lock) {
        if (!prepareOutput(explicit = true)) return@synchronized 0L
        nextSession++.also(sessions::add)
    }

    fun isActive(session: Long): Boolean = synchronized(lock) {
        focused && foreground && session in sessions
    }

    fun endPlayback(session: Long) = synchronized(lock) { sessions.remove(session); Unit }

    fun prepareOutput(explicit: Boolean = false): Boolean = synchronized(lock) {
        if (!foreground || (interrupted && !explicit)) return@synchronized false
        if (explicit) interrupted = false
        if (!focused) {
            if (!requestFocus()) return@synchronized false
            focused = true
        }
        if (!openOutput()) {
            interrupt()
            return@synchronized false
        }
        true
    }

    /** Includes duck requests: piano practice pauses instead of playing inaudibly. */
    fun interrupt() = synchronized(lock) {
        interrupted = true
        sessions.clear()
        silenceAndCloseOutput()
        if (focused) {
            focused = false
            abandonFocus()
        }
    }

    /** Called after release tails, and checked again under the voice/session lock. */
    fun releaseIfIdle(hasVoices: Boolean) = synchronized(lock) {
        if (!hasVoices && sessions.isEmpty() && focused) {
            silenceAndCloseOutput()
            focused = false
            abandonFocus()
        }
    }
}
