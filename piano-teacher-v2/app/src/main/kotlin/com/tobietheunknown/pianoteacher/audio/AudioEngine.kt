package com.tobietheunknown.pianoteacher.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.*
import kotlin.math.*

/**
 * Audio engine with two backends:
 * - SamplerEngine: Salamander Grand Piano samples (default when context available)
 * - SineEngine: Pure sine-wave fallback (no Context needed)
 *
 * TODO: Replace SineEngine with Oboe C++ engine for ultra-low latency
 *       once x86_64 build environment is available.
 */
class AudioEngine(context: Context? = null) {

    private val sampler = context?.let { SamplerEngine(it) }
    private val sine = SineEngine()

    private var enabled = true
    private var samplerReady = false

    init {
        if (sampler != null) {
            CoroutineScope(Dispatchers.IO).launch {
                samplerReady = sampler.loadAsync().await()
            }
        }
    }

    fun start(): Boolean {
        if (!enabled) return false
        return sine.start()
    }

    fun stop() {
        sine.stop()
    }

    fun noteOn(pitch: Int, velocity: Int = 80) {
        if (!enabled) return
        if (samplerReady && sampler != null) {
            sampler.noteOn(pitch, velocity)
        } else {
            sine.noteOn(pitch, velocity)
        }
    }

    fun noteOff(pitch: Int) {
        sampler?.noteOff(pitch)
        sine.noteOff(pitch)
    }

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) { stop(); sampler?.noteOff(-1) }
    }

    fun release() {
        sine.release()
        sampler?.release()
    }
}

// ─── Sine wave fallback ────────────────────────────────────────────────────────

private class SineEngine {
    private val sampleRate = 48000
    private val bufferSize = AudioTrack.getMinBufferSize(
        sampleRate, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT
    ).coerceAtLeast(1024)

    private var track: AudioTrack? = null
    private var engineJob: Job? = null
    private val voices = mutableMapOf<Int, Voice>()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    data class Voice(val pitch: Int, var amplitude: Float, var phase: Float = 0f)

    fun start(): Boolean = try {
        track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                    .build()
            )
            .setBufferSizeInBytes(bufferSize * 4)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        track?.play()
        startLoop()
        true
    } catch (e: Exception) { false }

    private fun startLoop() {
        engineJob = scope.launch {
            val buffer = FloatArray(bufferSize / 2)
            while (isActive) {
                synchronized(voices) {
                    val active = voices.values.toList()
                    for (i in buffer.indices step 2) {
                        var sample = 0f
                        active.forEach { v ->
                            sample += v.amplitude * sin(v.phase)
                            v.phase += 2f * PI.toFloat() * midiToFreq(v.pitch) / sampleRate
                            if (v.phase > 2f * PI) v.phase -= 2f * PI.toFloat()
                        }
                        sample = sample.coerceIn(-1f, 1f)
                        buffer[i] = sample
                        buffer[i + 1] = sample
                    }
                }
                track?.write(buffer, 0, buffer.size, AudioTrack.WRITE_BLOCKING)
            }
        }
    }

    fun noteOn(pitch: Int, velocity: Int) {
        synchronized(voices) {
            voices[pitch] = Voice(pitch, (velocity / 127f) * 0.25f)
        }
    }

    fun noteOff(pitch: Int) {
        synchronized(voices) { voices.remove(pitch) }
    }

    fun stop() {
        engineJob?.cancel()
        track?.stop(); track?.release(); track = null
        synchronized(voices) { voices.clear() }
    }

    fun release() { scope.cancel(); stop() }

    private fun midiToFreq(midi: Int): Float = 440f * 2f.pow((midi - 69) / 12f)
    private fun Float.pow(n: Int): Float = Math.pow(toDouble(), n.toDouble()).toFloat()
}
