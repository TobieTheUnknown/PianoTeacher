package com.tobietheunknown.pianoteacher.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color

// ─── Piano Teacher Color Palette ─────────────────────────────────────────────
// Dark theme, inspired by v1 design system
// Cyan = right hand (melody), Pink = left hand (chords), Indigo = accents

val Background: Color get() = LocalThemeColors.current.background
val Surface: Color get() = LocalThemeColors.current.surface
val SurfaceVariant = Color(0xFF1C1F2A)

val CyanMelody: Color get() = LocalThemeColors.current.melodyColor
val PinkChords: Color get() = LocalThemeColors.current.chordsColor
val IndigoAccent: Color get() = LocalThemeColors.current.accent

val GreenSuccess = Color(0xFF10B981)
val AmberWarning = Color(0xFFFBBF24)
val RedError = Color(0xFFEF4444)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF6366F1),
    secondary = Color(0xFF22D3EE),
    tertiary = Color(0xFFEC4899),
    background = Color(0xFF0A0C10),
    surface = Color(0xFF131620),
    surfaceVariant = Color(0xFF1C1F2A),
    onPrimary = Color.White,
    onSecondary = Color.Black,
    onBackground = Color(0xFFE2E8F0),
    onSurface = Color(0xFFE2E8F0),
    error = RedError,
)

@Composable
fun PianoTeacherTheme(
    colors: ThemeColors = DarkTheme,
    content: @Composable () -> Unit
) {
    CompositionLocalProvider(LocalThemeColors provides colors) {
        MaterialTheme(
            colorScheme = DarkColorScheme,
            typography = Typography(),
            content = content
        )
    }
}
