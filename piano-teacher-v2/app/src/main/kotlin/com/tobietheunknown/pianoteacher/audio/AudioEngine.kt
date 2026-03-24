package com.tobietheunknown.pianoteacher.audio

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.nio.ByteBuffer

/**
 * Audio engine backed by Oboe (C++/NDK) + Salamander Grand Piano samples.
 * MP3 assets are decoded on the IO dispatcher via MediaExtractor/MediaCodec,
 * then handed off to the native sampler for low-latency playback.
 *
 * Falls back to the pure-Kotlin SineEngine if the native library fails to load.
 */
class AudioEngine(context: Context? = null) {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)
    private var enabled = true
    private var nativeAvailable = false

    // Kotlin sine fallback (used until native sampler is ready, or if native fails)
    private val sineEngine = SineEngine()
    private var samplerReady = false

    companion object {
        private const val TAG = "AudioEngine"

        // Salamander Grand Piano sample map: asset name → MIDI note
        private val SAMPLE_MAP = mapOf(
            "A0" to 21, "C1" to 24, "Ds1" to 27, "Fs1" to 30, "A1" to 33,
            "C2" to 36, "Ds2" to 39, "Fs2" to 42, "A2" to 45,
            "C3" to 48, "Ds3" to 51, "Fs3" to 54, "A3" to 57,
            "C4" to 60, "Ds4" to 63, "Fs4" to 66, "A4" to 69,
            "C5" to 72, "Ds5" to 75, "Fs5" to 78, "A5" to 81,
            "C6" to 84, "Ds6" to 87, "Fs6" to 90, "A6" to 93,
            "C7" to 96, "Ds7" to 99, "Fs7" to 102, "A7" to 105,
            "C8" to 108
        )

        init {
            try {
                System.loadLibrary("piano_teacher_audio")
            } catch (e: UnsatisfiedLinkError) {
                Log.w(TAG, "Native library unavailable: ${e.message}")
            }
        }
    }

    init {
        nativeAvailable = try {
            nativeStart()
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "Falling back to SineEngine")
            false
        }

        if (context != null && nativeAvailable) {
            scope.launch {
                loadSalamander(context)
            }
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    fun start(): Boolean {
        return if (nativeAvailable) true else sineEngine.start()
    }

    fun stop() {
        sineEngine.stop()
        if (nativeAvailable) {
            try { nativeNoteOff(-1) } catch (_: Exception) { }
        }
    }

    fun noteOn(pitch: Int, velocity: Int = 80) {
        if (!enabled) return
        if (nativeAvailable && samplerReady) {
            nativeNoteOn(pitch, velocity)
        } else if (!nativeAvailable) {
            sineEngine.noteOn(pitch, velocity)
        }
        // While samplerReady == false, stay silent (avoids sine during load)
    }

    fun noteOff(pitch: Int) {
        if (nativeAvailable) {
            try { nativeNoteOff(pitch) } catch (_: Exception) { }
        }
        sineEngine.noteOff(pitch)
    }

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) {
            noteOff(-1)          // stop all
            sineEngine.stop()
        }
    }

    fun release() {
        job.cancel()
        sineEngine.release()
        if (nativeAvailable) {
            try { nativeStop() } catch (_: Exception) { }
        }
    }

    // ─── Sample loading ───────────────────────────────────────────────────────

    private fun loadSalamander(context: Context) {
        var loaded = 0
        SAMPLE_MAP.forEach { (name, midiNote) ->
            try {
                val (pcm, sr, ch) = decodeMp3Asset(context, "salamander/$name.mp3")
                nativeLoadSample(midiNote, pcm, sr, ch)
                loaded++
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load $name: ${e.message}")
            }
        }
        nativeSetReady()
        samplerReady = true
        Log.i(TAG, "Salamander loaded: $loaded/${SAMPLE_MAP.size} samples")
    }

    private data class PcmData(val samples: FloatArray, val sampleRate: Int, val channels: Int)

    /**
     * Decodes an MP3 asset to interleaved float PCM using MediaExtractor + MediaCodec.
     * Output is typically 16-bit PCM converted to [-1.0, 1.0] float.
     */
    private fun decodeMp3Asset(context: Context, assetPath: String): PcmData {
        val afd = context.assets.openFd(assetPath)
        val extractor = MediaExtractor()
        extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)

        // Find audio track
        var trackIndex = -1
        var format: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val f = extractor.getTrackFormat(i)
            if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                trackIndex = i; format = f; break
            }
        }
        check(trackIndex >= 0) { "No audio track in $assetPath" }
        extractor.selectTrack(trackIndex)

        val sampleRate = format!!.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        val channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        val mime = format.getString(MediaFormat.KEY_MIME)!!

        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(format, null, null, 0)
        codec.start()

        val shorts = ArrayList<Short>(sampleRate * channels * 4)  // ~4s pre-alloc
        val bufInfo = MediaCodec.BufferInfo()
        var inputDone = false
        var sawEOS = false

        while (!sawEOS) {
            // Feed input
            if (!inputDone) {
                val inIdx = codec.dequeueInputBuffer(10_000L)
                if (inIdx >= 0) {
                    val buf: ByteBuffer = codec.getInputBuffer(inIdx)!!
                    val n = extractor.readSampleData(buf, 0)
                    if (n < 0) {
                        codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        inputDone = true
                    } else {
                        codec.queueInputBuffer(inIdx, 0, n, extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }
            }
            // Drain output
            val outIdx = codec.dequeueOutputBuffer(bufInfo, 10_000L)
            if (outIdx >= 0) {
                val buf: ByteBuffer = codec.getOutputBuffer(outIdx)!!
                val sb = buf.asShortBuffer()
                while (sb.hasRemaining()) shorts.add(sb.get())
                codec.releaseOutputBuffer(outIdx, false)
                if (bufInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawEOS = true
            }
        }

        codec.stop(); codec.release()
        extractor.release(); afd.close()

        val floats = FloatArray(shorts.size) { shorts[it] / 32768f }
        return PcmData(floats, sampleRate, channels)
    }

    // ─── JNI declarations ─────────────────────────────────────────────────────

    private external fun nativeStart(): Boolean
    private external fun nativeStop()
    private external fun nativeNoteOn(pitch: Int, velocity: Int)
    private external fun nativeNoteOff(pitch: Int)
    private external fun nativeLoadSample(midiNote: Int, pcm: FloatArray, sampleRate: Int, channels: Int)
    private external fun nativeSetReady()
}

// ─── Sine wave fallback ───────────────────────────────────────────────────────

private class SineEngine {
    private val sampleRate = 48000
    private val bufferSize = android.media.AudioTrack.getMinBufferSize(
        sampleRate,
        android.media.AudioFormat.CHANNEL_OUT_STEREO,
        android.media.AudioFormat.ENCODING_PCM_FLOAT
    ).coerceAtLeast(1024)

    private var track: android.media.AudioTrack? = null
    private var engineJob: kotlinx.coroutines.Job? = null
    private val voices = mutableMapOf<Int, Voice>()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    data class Voice(val pitch: Int, var amplitude: Float, var phase: Float = 0f)

    fun start(): Boolean = try {
        track = android.media.AudioTrack.Builder()
            .setAudioAttributes(
                android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                android.media.AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setChannelMask(android.media.AudioFormat.CHANNEL_OUT_STEREO)
                    .setEncoding(android.media.AudioFormat.ENCODING_PCM_FLOAT)
                    .build()
            )
            .setBufferSizeInBytes(bufferSize * 4)
            .setTransferMode(android.media.AudioTrack.MODE_STREAM)
            .build()
        track?.play()
        engineJob = scope.launch {
            val buffer = FloatArray(bufferSize / 2)
            while (isActive) {
                synchronized(voices) {
                    val active = voices.values.toList()
                    for (i in buffer.indices step 2) {
                        var sample = 0f
                        active.forEach { v ->
                            sample += v.amplitude * kotlin.math.sin(v.phase.toDouble()).toFloat()
                            v.phase += 2f * Math.PI.toFloat() * midiToFreq(v.pitch) / sampleRate
                            if (v.phase > 2f * Math.PI.toFloat()) v.phase -= 2f * Math.PI.toFloat()
                        }
                        sample = sample.coerceIn(-1f, 1f)
                        buffer[i] = sample; buffer[i + 1] = sample
                    }
                }
                track?.write(buffer, 0, buffer.size, android.media.AudioTrack.WRITE_BLOCKING)
            }
        }
        true
    } catch (e: Exception) { false }

    fun noteOn(pitch: Int, velocity: Int) {
        synchronized(voices) { voices[pitch] = Voice(pitch, (velocity / 127f) * 0.25f) }
    }

    fun noteOff(pitch: Int) {
        synchronized(voices) { if (pitch < 0) voices.clear() else voices.remove(pitch) }
    }

    fun stop() {
        engineJob?.cancel()
        track?.stop(); track?.release(); track = null
        synchronized(voices) { voices.clear() }
    }

    fun release() { scope.cancel(); stop() }

    private fun midiToFreq(midi: Int): Float = 440f * Math.pow(2.0, (midi - 69) / 12.0).toFloat()
}
