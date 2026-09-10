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
    val showExpectedKeys: Boolean = true,
    val showEditorTab: Boolean = true,
)

private object Keys {
    val AUDIO = booleanPreferencesKey("audio_enabled")
    val BLE_MIDI = booleanPreferencesKey("ble_midi_enabled")
    val USB_MIDI = booleanPreferencesKey("usb_midi_enabled")
    val EXPECTED_KEYS = booleanPreferencesKey("show_expected_keys")
    val SHOW_EDITOR_TAB = booleanPreferencesKey("show_editor_tab")
}

val Context.appPreferences: Flow<AppPrefs>
    get() = dataStore.data
        .map { p ->
            AppPrefs(
                audioEnabled = p[Keys.AUDIO] ?: true,
                bleMidiEnabled = p[Keys.BLE_MIDI] ?: true,
                usbMidiEnabled = p[Keys.USB_MIDI] ?: true,
                showExpectedKeys = p[Keys.EXPECTED_KEYS] ?: true,
                showEditorTab = p[Keys.SHOW_EDITOR_TAB] ?: true,
            )
        }


class SettingsViewModel(private val context: Context) : ViewModel() {

    val prefs: StateFlow<AppPrefs> = context.appPreferences
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppPrefs())

    fun setAudioEnabled(v: Boolean) = set(Keys.AUDIO, v)
    fun setBleMidiEnabled(v: Boolean) = set(Keys.BLE_MIDI, v)
    fun setUsbMidiEnabled(v: Boolean) = set(Keys.USB_MIDI, v)
    fun setShowExpectedKeys(v: Boolean) = set(Keys.EXPECTED_KEYS, v)
    fun setShowEditorTab(v: Boolean) = set(Keys.SHOW_EDITOR_TAB, v)

    private fun set(key: androidx.datastore.preferences.core.Preferences.Key<Boolean>, value: Boolean) {
        viewModelScope.launch { context.dataStore.edit { it[key] = value } }
    }

    class Factory(private val context: Context) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            SettingsViewModel(context.applicationContext) as T
    }
}
