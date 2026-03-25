package com.tobietheunknown.pianoteacher.audio

import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack

class MetronomeEngine {
    private val sampleRate = 44100
    private val clickDurationMs = 30
    private val clickSamples = sampleRate * clickDurationMs / 1000

    private var amplitude = 0.25

    private var accentClick: ShortArray = generateClick(880.0) // Beat 1
    private var normalClick: ShortArray = generateClick(440.0) // Other beats

    fun setVolume(level: Int) {
        amplitude = when (level) { 0 -> 0.12; 2 -> 0.40; else -> 0.25 }
        accentClick = generateClick(880.0)
        normalClick = generateClick(440.0)
    }

    private fun generateClick(freq: Double): ShortArray {
        val samples = ShortArray(clickSamples)
        for (i in samples.indices) {
            val t = i.toDouble() / sampleRate
            val envelope = if (i < clickSamples / 4) i.toFloat() / (clickSamples / 4)
                          else 1f - (i - clickSamples / 4).toFloat() / (clickSamples * 3 / 4)
            samples[i] = (Short.MAX_VALUE * amplitude * envelope * Math.sin(2.0 * Math.PI * freq * t)).toInt().toShort()
        }
        return samples
    }

    fun playClick(isAccent: Boolean) {
        val data = if (isAccent) accentClick else normalClick
        val bufferSize = AudioTrack.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val track = AudioTrack(
            AudioManager.STREAM_MUSIC, sampleRate,
            AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
            bufferSize.coerceAtLeast(data.size * 2), AudioTrack.MODE_STATIC
        )
        track.write(data, 0, data.size)
        track.play()
        // Release after playback
        track.setNotificationMarkerPosition(data.size)
        track.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
            override fun onMarkerReached(t: AudioTrack) { t.release() }
            override fun onPeriodicNotification(t: AudioTrack) {}
        })
    }
}
