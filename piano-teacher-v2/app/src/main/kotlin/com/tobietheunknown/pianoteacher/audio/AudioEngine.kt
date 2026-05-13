package com.tobietheunknown.pianoteacher.audio

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.nio.ByteOrder

/**
 * Audio engine backed by Oboe (C++/NDK) + Salamander Grand Piano samples.
 *
 * Strategy:
 *  1. SamplerEngine (SoundPool) starts immediately → user hears audio right away
 *  2. Oboe native engine loads Salamander samples in background via MediaCodec
 *  3. Once Oboe is ready, it takes over (lower latency, better quality)
 *  4. If native library fails to load, SamplerEngine is the permanent backend
 */
class AudioEngine(private val context: Context? = null) {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    private var enabled = true
    private var nativeAvailable = false
    private var oboeReady = false

    // Sustain pedal (MIDI CC64): when engaged, defer noteOff until released.
    private var pedalEngaged = false
    private val heldByPedal = java.util.concurrent.ConcurrentHashMap.newKeySet<Int>()

    // SoundPool bridge: plays immediately while Oboe loads, and permanent fallback if Oboe unavailable
    private val samplerEngine: SamplerEngine? = context?.let { SamplerEngine(it) }

    companion object {
        private const val TAG = "AudioEngine"
        private const val MAX_SAMPLE_SECONDS = 8  // Trim samples to 8s — release envelope handles fadeout

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

        // Process-wide singleton. The whole app shares one engine so samples
        // load once at app start (warm by the time any piano page opens) and
        // active notes survive screen transitions.
        @Volatile private var instance: AudioEngine? = null
        fun getInstance(context: Context): AudioEngine =
            instance ?: synchronized(this) {
                instance ?: AudioEngine(context.applicationContext).also { instance = it }
            }
    }

    init {
        nativeAvailable = try {
            nativeStart()
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "Native start failed, using SamplerEngine permanently")
            false
        }

        if (context != null) {
            scope.launch {
                // Step 1: Load SamplerEngine immediately (fast, works right away)
                samplerEngine?.loadAsync()?.await()
                Log.i(TAG, "SamplerEngine ready — audio available immediately")

                // Step 2: Load Oboe samples in background (lower latency, better quality)
                if (nativeAvailable) {
                    loadOboe(context)
                }
            }
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    fun start(): Boolean = true  // Setup happens in init

    fun stop() {
        if (nativeAvailable && oboeReady) try { nativeNoteOff(-1) } catch (_: Exception) { }
    }

    fun noteOn(pitch: Int, velocity: Int = 80) {
        if (!enabled) return
        // A re-attack supersedes any pending pedal-deferred release for this pitch.
        heldByPedal.remove(pitch)
        if (nativeAvailable && oboeReady) {
            nativeNoteOn(pitch, velocity)
        } else {
            samplerEngine?.noteOn(pitch, velocity)
        }
    }

    fun noteOff(pitch: Int) {
        // Pedal down → defer the release. pitch == -1 is the "stop all" sentinel and
        // must always run, regardless of pedal state.
        if (pedalEngaged && pitch >= 0) {
            heldByPedal.add(pitch)
            return
        }
        if (pitch < 0) heldByPedal.clear()
        if (nativeAvailable && oboeReady) {
            try { nativeNoteOff(pitch) } catch (_: Exception) { }
        } else {
            if (pitch >= 0) samplerEngine?.noteOff(pitch)
            else samplerEngine?.let { for (n in 21..108) it.noteOff(n) }
        }
    }

    /**
     * MIDI CC64 (damper/sustain pedal). value ≥ 64 = pressed (MIDI 1.0 spec).
     * On release, every note whose noteOff we deferred is flushed.
     */
    fun setSustainPedal(engaged: Boolean) {
        val wasEngaged = pedalEngaged
        pedalEngaged = engaged
        if (wasEngaged && !engaged) {
            val toRelease = heldByPedal.toList()
            heldByPedal.clear()
            for (pitch in toRelease) {
                if (nativeAvailable && oboeReady) {
                    try { nativeNoteOff(pitch) } catch (_: Exception) { }
                } else {
                    samplerEngine?.noteOff(pitch)
                }
            }
        }
    }

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) {
            if (nativeAvailable && oboeReady) try { nativeNoteOff(-1) } catch (_: Exception) { }
            else samplerEngine?.let { for (n in 21..108) it.noteOff(n) }
        }
    }

    fun release() {
        job.cancel()
        samplerEngine?.release()
        if (nativeAvailable) try { nativeStop() } catch (_: Exception) { }
    }

    // ─── Oboe sample loading ──────────────────────────────────────────────────

    private fun loadOboe(context: Context) {
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
        oboeReady = true
        Log.i(TAG, "Oboe sampler ready: $loaded/${SAMPLE_MAP.size} samples loaded")
    }

    private data class PcmData(val samples: FloatArray, val sampleRate: Int, val channels: Int)

    /**
     * Decodes an MP3 asset to interleaved float PCM.
     * Uses ByteArrayOutputStream (raw bytes) to avoid Short boxing and GC pressure.
     * Trims to MAX_SAMPLE_SECONDS to bound memory usage.
     */
    private fun decodeMp3Asset(context: Context, assetPath: String): PcmData {
        val afd = context.assets.openFd(assetPath)
        val extractor = MediaExtractor()
        extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)

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
        val maxFrames = sampleRate * MAX_SAMPLE_SECONDS

        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(format, null, null, 0)
        codec.start()

        // Raw bytes — no boxing, minimal GC pressure
        val rawBytes = ByteArrayOutputStream(sampleRate * channels * 2 * 3)
        val bufInfo = MediaCodec.BufferInfo()
        var inputDone = false
        var sawEOS = false
        var framesDecoded = 0

        while (!sawEOS && framesDecoded < maxFrames) {
            if (!inputDone) {
                val inIdx = codec.dequeueInputBuffer(10_000L)
                if (inIdx >= 0) {
                    val buf = codec.getInputBuffer(inIdx)!!
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
            val outIdx = codec.dequeueOutputBuffer(bufInfo, 10_000L)
            if (outIdx >= 0) {
                val buf = codec.getOutputBuffer(outIdx)!!
                val bytes = ByteArray(bufInfo.size)
                buf.get(bytes)
                rawBytes.write(bytes)
                framesDecoded += bufInfo.size / (2 * channels)
                codec.releaseOutputBuffer(outIdx, false)
                if (bufInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawEOS = true
            }
        }

        codec.stop(); codec.release()
        extractor.release(); afd.close()

        // 16-bit LE PCM bytes → float [-1, 1], no boxing
        val byteArr = rawBytes.toByteArray()
        val shortBuf = java.nio.ByteBuffer.wrap(byteArr)
            .order(ByteOrder.LITTLE_ENDIAN)
            .asShortBuffer()
        val floats = FloatArray(shortBuf.remaining()) { shortBuf.get() / 32768f }
        return PcmData(floats, sampleRate, channels)
    }

    // ─── JNI declarations ─────────────────────────────────────────────────────

    private external fun nativeStart(): Boolean
    private external fun nativeStop()
    private external fun nativeNoteOn(pitch: Int, velocity: Int)
    private external fun nativeNoteOff(pitch: Int)
    private external fun nativeLoadSample(midiNote: Int, pcm: FloatArray, sampleRate: Int, channels: Int)
    private external fun nativeSetReady()
    private external fun nativeSetRelease(releasePer: Float)
    private external fun nativePlayClick(isAccent: Boolean, amplitude: Float)

    fun setRelease(level: Int) {
        val value = when (level) { 0 -> 0.9996f; 2 -> 0.9999f; else -> 0.9998f }
        if (nativeAvailable) {
            try { nativeSetRelease(value) } catch (_: Exception) { }
        }
    }

    /** Play a metronome click via the native Oboe audio callback (zero Java AudioTrack overhead) */
    fun playClick(isAccent: Boolean, amplitude: Float = 0.45f) {
        if (nativeAvailable && oboeReady) {
            try { nativePlayClick(isAccent, amplitude) } catch (_: Exception) { }
        }
    }
}
