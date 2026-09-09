package com.tobietheunknown.pianoteacher.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Salamander Grand Piano sampler using SoundPool.
 * Samples are stored in assets/salamander/ (mp3 files)
 *
 * Sample map matches the Tone.js/Salamander format used in Piano Teacher v1:
 * C1, C2, C3, C4, C5, C6, C7, C8
 * Ds1, Ds2, Ds3, Ds4, Ds5, Ds6, Ds7
 * Fs1, Fs2, Fs3, Fs4, Fs5, Fs6, Fs7
 * A0, A1, A2, A3, A4, A5, A6, A7
 */
class SamplerEngine(private val context: Context) {

    private val pool = SoundPool.Builder()
        .setMaxStreams(32) // Android SoundPool's supported maximum.
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        )
        .build()

    // Map of MIDI note → SoundPool sound ID
    private val soundIds = ConcurrentHashMap<Int, Int>()
    private val streamIds = ConcurrentHashMap<Long, Int>()
    @Volatile private var loaded = false
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val loadResult = CompletableDeferred<Boolean>()
    private val loadLock = Any()
    private var loadStarted = false
    private var schedulingComplete = false
    private var pendingLoads = 0
    private var loadFailed = false

    // Sample definitions: name → MIDI note
    private val sampleMap = mapOf(
        "A0" to 21, "C1" to 24, "Ds1" to 27, "Fs1" to 30, "A1" to 33,
        "C2" to 36, "Ds2" to 39, "Fs2" to 42, "A2" to 45,
        "C3" to 48, "Ds3" to 51, "Fs3" to 54, "A3" to 57,
        "C4" to 60, "Ds4" to 63, "Fs4" to 66, "A4" to 69,
        "C5" to 72, "Ds5" to 75, "Fs5" to 78, "A5" to 81,
        "C6" to 84, "Ds6" to 87, "Fs6" to 90, "A6" to 93,
        "C7" to 96, "Ds7" to 99, "Fs7" to 102, "A7" to 105,
        "C8" to 108
    )

    // Sorted list of available MIDI notes for nearest-neighbor lookup
    private val availableNotes by lazy { sampleMap.values.sorted() }

    init {
        pool.setOnLoadCompleteListener { _, _, status ->
            synchronized(loadLock) {
                if (status != 0) loadFailed = true
                pendingLoads = (pendingLoads - 1).coerceAtLeast(0)
                finishLoadingIfReady()
            }
        }
    }

    fun loadAsync(): Deferred<Boolean> {
        synchronized(loadLock) {
            if (loadStarted) return loadResult
            loadStarted = true
        }
        scope.launch {
            sampleMap.forEach { (name, midi) ->
                synchronized(loadLock) { pendingLoads++ }
                try {
                    context.assets.openFd("salamander/$name.mp3").use { fd ->
                        val id = pool.load(fd, 1)
                        if (id == 0) {
                            synchronized(loadLock) {
                                pendingLoads--
                                loadFailed = true
                            }
                        } else {
                            soundIds[midi] = id
                        }
                    }
                } catch (_: Exception) {
                    synchronized(loadLock) {
                        pendingLoads--
                        loadFailed = true
                    }
                }
            }
            synchronized(loadLock) {
                schedulingComplete = true
                finishLoadingIfReady()
            }
        }
        return loadResult
    }

    private fun finishLoadingIfReady() {
        if (!schedulingComplete || pendingLoads != 0 || loadResult.isCompleted) return
        loaded = soundIds.isNotEmpty()
        loadResult.complete(!loadFailed && soundIds.size == sampleMap.size)
    }

    fun playVoice(id: Long, pitch: Int, velocity: Int = 80) {
        if (!loaded) return
        val nearestNote = findNearestSample(pitch)
        val soundId = soundIds[nearestNote] ?: return

        val semitoneOffset = pitch - nearestNote
        val rate = 2f.pow(semitoneOffset / 12f).coerceIn(0.5f, 2.0f)
        val vol = (velocity / 127f) * 0.85f

        val streamId = pool.play(soundId, vol, vol, 1, 0, rate)
        if (streamId != 0) streamIds[id] = streamId
    }

    fun stopVoice(id: Long) {
        streamIds.remove(id)?.let { pool.stop(it) }
    }

    private fun findNearestSample(pitch: Int): Int {
        return availableNotes.minByOrNull { kotlin.math.abs(it - pitch) } ?: pitch
    }

    @Volatile private var released = false
    fun release() {
        if (released) return
        released = true
        loaded = false
        if (!loadResult.isCompleted) loadResult.complete(false)
        scope.cancel()
        pool.release()
    }

    private fun Float.pow(n: Float): Float = Math.pow(this.toDouble(), n.toDouble()).toFloat()
}
