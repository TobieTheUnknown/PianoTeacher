package com.tobietheunknown.pianoteacher.ui.settings

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

private val Context.dataStore by preferencesDataStore("settings")

data class AppPrefs(
    val audioEnabled: Boolean = true,
    val bleMidiEnabled: Boolean = true,
    val usbMidiEnabled: Boolean = true,
    val handColorsEnabled: Boolean = true,
    val showExpectedKeys: Boolean = true,
    val geminiEnabled: Boolean = false   // Hidden until Easter egg
)

private object Keys {
    val AUDIO = booleanPreferencesKey("audio_enabled")
    val BLE_MIDI = booleanPreferencesKey("ble_midi_enabled")
    val USB_MIDI = booleanPreferencesKey("usb_midi_enabled")
    val HAND_COLORS = booleanPreferencesKey("hand_colors_enabled")
    val EXPECTED_KEYS = booleanPreferencesKey("show_expected_keys")
    val GEMINI = booleanPreferencesKey("gemini_enabled")
}

class SettingsViewModel(private val context: Context) : ViewModel() {

    val prefs: StateFlow<AppPrefs> = context.dataStore.data
        .map { p ->
            AppPrefs(
                audioEnabled = p[Keys.AUDIO] ?: true,
                bleMidiEnabled = p[Keys.BLE_MIDI] ?: true,
                usbMidiEnabled = p[Keys.USB_MIDI] ?: true,
                handColorsEnabled = p[Keys.HAND_COLORS] ?: true,
                showExpectedKeys = p[Keys.EXPECTED_KEYS] ?: true,
                geminiEnabled = p[Keys.GEMINI] ?: false
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppPrefs())

    fun setAudioEnabled(v: Boolean) = set(Keys.AUDIO, v)
    fun setBleMidiEnabled(v: Boolean) = set(Keys.BLE_MIDI, v)
    fun setUsbMidiEnabled(v: Boolean) = set(Keys.USB_MIDI, v)
    fun setHandColorsEnabled(v: Boolean) = set(Keys.HAND_COLORS, v)
    fun setShowExpectedKeys(v: Boolean) = set(Keys.EXPECTED_KEYS, v)
    fun setGeminiEnabled(v: Boolean) = set(Keys.GEMINI, v)

    private fun set(key: androidx.datastore.preferences.core.Preferences.Key<Boolean>, value: Boolean) {
        viewModelScope.launch { context.dataStore.edit { it[key] = value } }
    }

    class Factory(private val context: Context) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            SettingsViewModel(context.applicationContext) as T
    }
}
