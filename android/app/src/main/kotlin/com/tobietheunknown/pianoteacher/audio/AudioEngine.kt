package com.tobietheunknown.pianoteacher.audio

import android.content.Context
import androidx.annotation.Keep
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.AudioFormat
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import java.io.ByteArrayOutputStream
import java.nio.ByteOrder

/** One stable, fully loaded backend per session. Playback waits for actual readiness. */
class AudioEngine(private val context: Context? = null) : PlaybackAudio {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    @Volatile private var enabled = true
    private var nativeAvailable = false
    @Volatile private var oboeReady = false

    private val readiness = CompletableDeferred<Boolean>()
    private val _ready = MutableStateFlow(false)
    val ready = _ready.asStateFlow()
    private val voiceLock = Any()
    private val nextVoice = java.util.concurrent.atomic.AtomicLong(1)
    private val activeVoices = mutableSetOf<Long>()
    private val midiVoices = mutableMapOf<Int, java.util.ArrayDeque<Long>>()
    private var pedalEngaged = false
    private val heldByPedal = mutableSetOf<Long>()
    private var idleReleaseJob: Job? = null
    private val audioManager = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val focusRequest: AudioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
        .setWillPauseWhenDucked(true)
        .setAcceptsDelayedFocusGain(false)
        .setOnAudioFocusChangeListener({ change ->
            if (change != AudioManager.AUDIOFOCUS_GAIN) {
                Log.i(TAG, "Audio focus interrupted ($change); waiting for explicit playback")
                sessions.interrupt()
            }
        }, Handler(Looper.getMainLooper()))
        .build()
    private val sessions: AudioSessionController = AudioSessionController(
        lock = voiceLock,
        requestFocus = { audioManager?.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED },
        abandonFocus = { audioManager?.abandonAudioFocusRequest(focusRequest); Unit },
        openOutput = { if (oboeReady) nativeStart() else samplerEngine != null },
        outputRevision = { if (oboeReady) nativeOutputRevision() else 0L },
        silenceAndCloseOutput = {
            activeVoices.clear()
            midiVoices.clear()
            heldByPedal.clear()
            pedalEngaged = false
            if (nativeAvailable) nativeSuspend()
            samplerEngine?.stopAll()
        },
    )
    // Construct SoundPool only if Oboe cannot initialise. There is no mid-song switch.
    private var samplerEngine: SamplerEngine? = null

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
            nativeInitialize()
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "Native start failed, using SamplerEngine permanently")
            false
        }

        scope.launch {
            val nativeLoaded = context != null && nativeAvailable && runCatching { loadOboe(context) }.getOrDefault(false)
            val success = if (nativeLoaded) true else if (context != null) {
                samplerEngine = SamplerEngine(context)
                samplerEngine!!.loadAsync().await()
            } else false
            _ready.value = success
            readiness.complete(success)
            Log.i(TAG, "Audio ready=$success, backend=${if (oboeReady) "Oboe" else "SoundPool"}")
        }
    }

    override suspend fun awaitReady(): Boolean = readiness.await()

    /** Resuming a page does not steal focus from music playing in another app. */
    fun onForeground() = sessions.setForeground(true)
    fun onBackground() = sessions.setForeground(false)

    override fun beginPlayback(): Long = synchronized(voiceLock) {
        if (!_ready.value) return@synchronized 0L
        idleReleaseJob?.cancel()
        sessions.beginPlayback()
    }

    override fun isPlaybackActive(session: Long): Boolean = synchronized(voiceLock) {
        if (!sessions.isActive(session)) return@synchronized false
        if (oboeReady && !nativeIsRunning()) {
            sessions.interrupt()
            return@synchronized false
        }
        true
    }

    override fun endPlayback(session: Long) = synchronized(voiceLock) {
        sessions.endPlayback(session)
        scheduleIdleRelease()
    }

    private fun scheduleIdleRelease() {
        idleReleaseJob?.cancel()
        idleReleaseJob = scope.launch {
            delay(1_200) // Let the release envelope finish before returning focus.
            synchronized(voiceLock) { sessions.releaseIfIdle(activeVoices.isNotEmpty()) }
        }
    }

    /** Each score occurrence must still own a live session at the exact emission point. */
    override fun playVoice(session: Long, pitch: Int, velocity: Int): Long =
        sessions.withPlayback(session, 0L) { createVoice(pitch, velocity) }

    /** Called only under voiceLock, after preparing MIDI output or validating a score session. */
    private fun createVoice(pitch: Int, velocity: Int): Long {
        if (!enabled || !_ready.value || pitch !in 0..127) return 0L
        idleReleaseJob?.cancel()
        val id = nextVoice.getAndIncrement()
        activeVoices.add(id)
        if (oboeReady) nativePlayVoice(id, pitch, velocity.coerceIn(1, 127))
        else samplerEngine?.playVoice(id, pitch, velocity)
        return id
    }

    override fun stopVoice(id: Long) = synchronized(voiceLock) {
        sessions.reconcileOutput()
        if (id != 0L && activeVoices.remove(id)) {
            heldByPedal.remove(id)
            if (oboeReady) nativeStopVoice(id) else samplerEngine?.stopVoice(id)
            if (activeVoices.isEmpty()) scheduleIdleRelease()
        }
    }

    fun noteOn(pitch: Int, velocity: Int = 80) = synchronized(voiceLock) {
        if (!enabled || !_ready.value || !sessions.prepareOutput(explicit = true)) return@synchronized
        val id = createVoice(pitch, velocity)
        if (id != 0L) midiVoices.getOrPut(pitch) { java.util.ArrayDeque() }.addLast(id)
    }

    fun noteOff(pitch: Int) = synchronized(voiceLock) {
        sessions.reconcileOutput()
        if (pitch < 0) {
            activeVoices.toList().forEach(::stopVoice)
            midiVoices.clear()
            heldByPedal.clear()
        } else {
            val queue = midiVoices[pitch]
            val id = queue?.pollFirst()
            if (queue?.isEmpty() == true) midiVoices.remove(pitch)
            if (id != null) {
                if (pedalEngaged) heldByPedal.add(id) else stopVoice(id)
            }
        }
    }

    fun stop() {
        setSustainPedal(false)
        noteOff(-1)
    }

    fun setSustainPedal(engaged: Boolean) = synchronized(voiceLock) {
        sessions.reconcileOutput()
        pedalEngaged = engaged
        if (!engaged) heldByPedal.toList().forEach(::stopVoice)
    }

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) sessions.interrupt()
    }

    fun release() {
        job.cancel()
        stop()
        sessions.interrupt()
        samplerEngine?.release()
        if (nativeAvailable) try { nativeStop() } catch (_: Exception) { }
    }

    // ─── Oboe sample loading ──────────────────────────────────────────────────

    private fun loadOboe(context: Context): Boolean {
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
        if (loaded != SAMPLE_MAP.size) {
            Log.w(TAG, "Oboe samples incomplete ($loaded/${SAMPLE_MAP.size}); using SoundPool")
            return false
        }
        nativeSetReady()
        oboeReady = true
        Log.i(TAG, "Oboe sampler ready: $loaded/${SAMPLE_MAP.size} samples loaded")

        return true
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
        var codec: MediaCodec? = null
        var codecStarted = false
        try {
            extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)

            var trackIndex = -1
            var inputFormat: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val candidate = extractor.getTrackFormat(i)
                if (candidate.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                    trackIndex = i
                    inputFormat = candidate
                    break
                }
            }
            check(trackIndex >= 0) { "No audio track in $assetPath" }
            val format = checkNotNull(inputFormat) { "No audio format in $assetPath" }
            extractor.selectTrack(trackIndex)

            var sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT
            val mime = format.getString(MediaFormat.KEY_MIME)!!
            val maxFrames = sampleRate * MAX_SAMPLE_SECONDS

            codec = MediaCodec.createDecoderByType(mime)
            codec.configure(format, null, null, 0)
            codec.start()
            codecStarted = true

            val rawBytes = ByteArrayOutputStream(sampleRate * channels * 2 * 3)
            val bufInfo = MediaCodec.BufferInfo()
            var inputDone = false
            var sawEOS = false
            var framesDecoded = 0

            while (!sawEOS && framesDecoded < maxFrames) {
                if (!inputDone) {
                    val inIdx = codec.dequeueInputBuffer(10_000L)
                    if (inIdx >= 0) {
                        val buffer = codec.getInputBuffer(inIdx)!!
                        val count = extractor.readSampleData(buffer, 0)
                        if (count < 0) {
                            codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            codec.queueInputBuffer(inIdx, 0, count, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }

                when (val outIdx = codec.dequeueOutputBuffer(bufInfo, 10_000L)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val output = codec.outputFormat
                        sampleRate = output.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = output.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        if (output.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
                            pcmEncoding = output.getInteger(MediaFormat.KEY_PCM_ENCODING)
                        }
                    }
                    else -> if (outIdx >= 0) {
                        val buffer = codec.getOutputBuffer(outIdx)!!
                        buffer.position(bufInfo.offset)
                        buffer.limit(bufInfo.offset + bufInfo.size)
                        val bytes = ByteArray(bufInfo.size)
                        buffer.get(bytes)
                        rawBytes.write(bytes)
                        val bytesPerSample = if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) 4 else 2
                        framesDecoded += bufInfo.size / (bytesPerSample * channels)
                        codec.releaseOutputBuffer(outIdx, false)
                        if (bufInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawEOS = true
                    }
                }
            }

            val byteBuffer = java.nio.ByteBuffer.wrap(rawBytes.toByteArray()).order(ByteOrder.LITTLE_ENDIAN)
            val floats = if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
                val source = byteBuffer.asFloatBuffer()
                FloatArray(source.remaining()) { source.get().coerceIn(-1f, 1f) }
            } else {
                val source = byteBuffer.asShortBuffer()
                FloatArray(source.remaining()) { source.get() / 32768f }
            }
            return PcmData(floats, sampleRate, channels)
        } finally {
            if (codecStarted) runCatching { codec?.stop() }
            runCatching { codec?.release() }
            extractor.release()
            afd.close()
        }
    }

    // ─── JNI declarations ─────────────────────────────────────────────────────

    private external fun nativeInitialize(): Boolean
    private external fun nativeStart(): Boolean
    private external fun nativeSuspend()
    private external fun nativeIsRunning(): Boolean
    private external fun nativeOutputRevision(): Long
    private external fun nativeStop()
    private external fun nativePlayVoice(id: Long, pitch: Int, velocity: Int)
    private external fun nativeStopVoice(id: Long)
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

    // Invoked on Oboe's error thread, after its stream mutex has been released.
    // A MIDI action may already have consumed the revision and opened a newer stream.
    @Keep
    private fun onNativeOutputInterrupted() {
        sessions.reconcileOutput()
    }

    /** A stale transport cannot emit a click into a newly acquired session. */
    override fun playClick(session: Long, isAccent: Boolean, amplitude: Float) =
        sessions.withPlayback(session, Unit) {
            if (enabled && nativeAvailable && oboeReady) {
                try { nativePlayClick(isAccent, amplitude) } catch (_: Exception) { }
            }
        }
}
