package com.tobietheunknown.pianoteacher.ai

import android.content.Context

/**
 * On-device AI feedback via Gemini Nano (Android AICore).
 * Requires Pixel 8+ or compatible device with AICore installed.
 * Hidden behind Settings Easter egg (7 taps on version).
 *
 * TODO: Integrate android.ai.core API when stable.
 */
class GeminiNanoManager(private val context: Context) {

    private var isAvailable = false

    fun checkAvailability(): Boolean {
        // AICore availability check — requires device support
        isAvailable = try {
            Class.forName("android.ai.core.GeminiManager")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
        return isAvailable
    }

    /**
     * Generate feedback for a practice session.
     * @param missedNotes Number of missed notes
     * @param totalNotes Total notes in phrase
     * @param phraseName Phrase name for context
     */
    suspend fun generateFeedback(
        missedNotes: Int,
        totalNotes: Int,
        phraseName: String
    ): String {
        if (!isAvailable) return ""

        val accuracy = ((totalNotes - missedNotes).toDouble() / totalNotes * 100).toInt()

        // Placeholder — will use GeminiManager.createSession() + prompt
        return when {
            accuracy >= 95 -> "Excellent ! Tu maîtrises \"$phraseName\". Passe à la suite."
            accuracy >= 75 -> "Bien joué sur \"$phraseName\" ($accuracy%). Quelques notes à retravailler."
            accuracy >= 50 -> "\"$phraseName\" nécessite encore de la pratique ($accuracy%). Ralentis le tempo."
            else -> "Reprends \"$phraseName\" depuis le début ($accuracy%). Travaille main par main."
        }
    }
}
