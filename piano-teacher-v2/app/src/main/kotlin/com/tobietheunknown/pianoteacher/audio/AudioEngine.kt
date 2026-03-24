package com.tobietheunknown.pianoteacher.audio

/**
 * Kotlin wrapper around the native Oboe audio engine.
 * TODO: Replace sine-wave voices with Salamander piano samples.
 */
class AudioEngine {

    private var enabled = true

    fun start(): Boolean {
        if (!enabled) return false
        return nativeStart()
    }

    fun stop() = nativeStop()

    fun noteOn(pitch: Int, velocity: Int = 80) {
        if (enabled) nativeNoteOn(pitch, velocity)
    }

    fun noteOff(pitch: Int) {
        if (enabled) nativeNoteOff(pitch)
    }

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) nativeStop()
    }

    // JNI
    private external fun nativeStart(): Boolean
    private external fun nativeStop()
    private external fun nativeNoteOn(pitch: Int, velocity: Int)
    private external fun nativeNoteOff(pitch: Int)

    companion object {
        init { System.loadLibrary("piano_teacher_audio") }
    }
}
