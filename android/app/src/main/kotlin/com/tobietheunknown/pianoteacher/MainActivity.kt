package com.tobietheunknown.pianoteacher

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.launch
import com.tobietheunknown.pianoteacher.midi.MidiManager
import com.tobietheunknown.pianoteacher.ui.settings.appPreferences
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.tobietheunknown.pianoteacher.audio.AudioEngine
import com.tobietheunknown.pianoteacher.ui.theme.PianoTeacherTheme
import com.tobietheunknown.pianoteacher.ui.theme.ThemeState
import com.tobietheunknown.pianoteacher.ui.theme.composeThemeColors
import com.tobietheunknown.pianoteacher.ui.theme.getThemeColors
import com.tobietheunknown.pianoteacher.ui.AppNavHost
import com.tobietheunknown.pianoteacher.ui.onboarding.OnboardingState
import com.tobietheunknown.pianoteacher.reminders.PracticeReminders

class MainActivity : ComponentActivity() {

    private var currentIntent by mutableStateOf<Intent?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        currentIntent = intent

        ThemeState.init(this)
        OnboardingState.init(this)

        // Warm the audio engine on the way in. SoundPool reports readiness through its load callback.
        // and starts decoding Oboe samples in the background so the Library →
        // LivePlay/Learning transition has a sampler ready instead of dropping
        // the first key presses.
        AudioEngine.getInstance(applicationContext)
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                val midi = MidiManager.getInstance(applicationContext)
                try {
                    applicationContext.appPreferences.collect { prefs ->
                        midi.configure(usb = prefs.usbMidiEnabled, ble = prefs.bleMidiEnabled)
                    }
                } finally {
                    midi.stop()
                    AudioEngine.getInstance(applicationContext).setSustainPedal(false)
                    AudioEngine.getInstance(applicationContext).noteOff(-1)
                }
            }
        }


        setContent {
            val currentTheme by ThemeState.current
            val currentAccent by ThemeState.accent
            val currentHands by ThemeState.hands
            val base = getThemeColors(currentTheme)
            val colors = composeThemeColors(base, currentAccent, currentHands)
            PianoTeacherTheme(colors = colors) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNavHost(intent = currentIntent)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        currentIntent = intent
    }

    override fun onResume() {
        super.onResume()
        // Restores the next local reminder after app updates, time changes or a
        // return from Android's notification settings.
        PracticeReminders.reschedule(this)
    }

}
