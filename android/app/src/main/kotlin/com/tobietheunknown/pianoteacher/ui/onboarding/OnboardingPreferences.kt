package com.tobietheunknown.pianoteacher.ui.onboarding

import android.content.Context
import androidx.compose.runtime.mutableStateOf

data class LearnerProfile(
    val wantsMidi: Boolean = true,
)

object OnboardingPreferences {
    private const val PREFS = "piano_teacher_prefs"
    private const val KEY_COMPLETE = "onboarding_complete_v2"
    private const val KEY_WANTS_MIDI = "learner_wants_midi"

    fun isComplete(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_COMPLETE, false)

    fun profile(context: Context): LearnerProfile {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return LearnerProfile(
            wantsMidi = prefs.getBoolean(KEY_WANTS_MIDI, true),
        )
    }

    fun complete(context: Context, profile: LearnerProfile) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_COMPLETE, true)
            .putBoolean(KEY_WANTS_MIDI, profile.wantsMidi)
            .apply()
    }
}

/** Synchronous first-frame gate, backed by SharedPreferences for a flash-free launch. */
object OnboardingState {
    val isComplete = mutableStateOf(false)

    fun init(context: Context) {
        isComplete.value = OnboardingPreferences.isComplete(context)
    }

    fun complete(context: Context, profile: LearnerProfile) {
        OnboardingPreferences.complete(context, profile)
        isComplete.value = true
    }
}
