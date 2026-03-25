package com.tobietheunknown.pianoteacher.ui.theme

import android.content.Context
import androidx.compose.runtime.*
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color

enum class AppTheme { DARK, MIDNIGHT_BLUE, PASTEL_COZY }

data class ThemeColors(
    val background: Color,
    val surface: Color,
    val accent: Color,
    val melodyColor: Color,
    val chordsColor: Color,
    val textPrimary: Color = Color.White,
    val textSecondary: Color = Color(0xFF94A3B8)
)

val DarkTheme = ThemeColors(
    background = Color(0xFF0D0F14),
    surface = Color(0xFF151820),
    accent = Color(0xFF6366F1), // IndigoAccent
    melodyColor = Color(0xFF22D3EE), // CyanMelody
    chordsColor = Color(0xFFEC4899) // PinkChords
)

val MidnightBlueTheme = ThemeColors(
    background = Color(0xFF0A0E1A),
    surface = Color(0xFF111833),
    accent = Color(0xFF4F8EFF),
    melodyColor = Color(0xFF00E5FF), // electric cyan
    chordsColor = Color(0xFFFF4081) // neon pink
)

val PastelCozyTheme = ThemeColors(
    background = Color(0xFF1A1520),
    surface = Color(0xFF231E2A),
    accent = Color(0xFFC4A1D4), // soft lavender
    melodyColor = Color(0xFF7ECFB3), // soft mint
    chordsColor = Color(0xFFE8A0BF) // warm rose
)

fun getThemeColors(theme: AppTheme) = when (theme) {
    AppTheme.DARK -> DarkTheme
    AppTheme.MIDNIGHT_BLUE -> MidnightBlueTheme
    AppTheme.PASTEL_COZY -> PastelCozyTheme
}

val LocalThemeColors = compositionLocalOf { DarkTheme }

object ThemePrefs {
    private const val PREF_NAME = "piano_teacher_prefs"
    private const val KEY_THEME = "app_theme"
    private const val KEY_METRO_VOL = "metronome_volume"

    fun getTheme(context: Context): AppTheme {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return try { AppTheme.valueOf(prefs.getString(KEY_THEME, "DARK") ?: "DARK") } catch (_: Exception) { AppTheme.DARK }
    }

    fun setTheme(context: Context, theme: AppTheme) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit().putString(KEY_THEME, theme.name).apply()
    }

    fun getMetronomeVolume(context: Context): Int {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getInt(KEY_METRO_VOL, 1) // 0=low, 1=medium, 2=high
    }

    fun setMetronomeVolume(context: Context, level: Int) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit().putInt(KEY_METRO_VOL, level.coerceIn(0, 2)).apply()
    }
}

object ThemeState {
    val current = mutableStateOf(AppTheme.DARK)

    fun init(context: Context) {
        current.value = ThemePrefs.getTheme(context)
    }

    fun set(context: Context, theme: AppTheme) {
        ThemePrefs.setTheme(context, theme)
        current.value = theme
    }
}
