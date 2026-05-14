package com.tobietheunknown.pianoteacher.audio

import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack

class MetronomeEngine {
    private val sampleRate = 44100
    private val clickDurationMs = 30
    private val clickSamples = sampleRate * clickDurationMs / 1000

    var amplitude = 0.45
        private set

    private var accentTrack: AudioTrack? = null
    private var normalTrack: AudioTrack? = null

    init { rebuildTracks() }

    private fun generateClick(freq: Double): ShortArray {
        val samples = ShortArray(clickSamples)
        for (i in samples.indices) {
            val t = i.toDouble() / sampleRate
            val envelope = if (i < clickSamples / 4) i.toFloat() / (clickSamples / 4)
                          else 1f - (i - clickSamples / 4).toFloat() / (clickSamples * 3 / 4)
            samples[i] = (Short.MAX_VALUE * amplitude * envelope * Math.sin(2.0 * Math.PI * freq * t)).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        return samples
    }

    private fun createStaticTrack(data: ShortArray): AudioTrack {
        val bufSize = AudioTrack.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val track = AudioTrack(
            AudioManager.STREAM_MUSIC, sampleRate,
            AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
            bufSize.coerceAtLeast(data.size * 2), AudioTrack.MODE_STATIC
        )
        track.write(data, 0, data.size)
        return track
    }

    private fun rebuildTracks() {
        accentTrack?.release()
        normalTrack?.release()
        accentTrack = createStaticTrack(generateClick(880.0))
        normalTrack = createStaticTrack(generateClick(440.0))
    }

    fun playClick(isAccent: Boolean, volumeMultiplier: Float = 1.0f) {
        val track = if (isAccent) accentTrack else normalTrack
        track ?: return
        try {
            track.stop()
            track.reloadStaticData()
            track.setStereoVolume(volumeMultiplier, volumeMultiplier)
            track.play()
        } catch (_: Exception) { }
    }

    fun setVolume(level: Int) {
        amplitude = when (level) { 0 -> 0.25; 2 -> 0.70; else -> 0.45 }
        rebuildTracks()
    }

    fun release() {
        accentTrack?.release()
        normalTrack?.release()
        accentTrack = null
        normalTrack = null
    }
}
