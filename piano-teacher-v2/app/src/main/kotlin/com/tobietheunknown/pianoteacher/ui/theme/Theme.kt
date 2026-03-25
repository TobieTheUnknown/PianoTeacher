package com.tobietheunknown.pianoteacher.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color

// ─── Piano Teacher Color Palette ─────────────────────────────────────────────
// Colors used in Canvas draw calls (non-composable) must be plain vals.
// Theme-aware colors are accessed via LocalThemeColors.current in @Composable scope.

val Background = Color(0xFF0D0F14)
val Surface = Color(0xFF151820)
val SurfaceVariant = Color(0xFF1C1F2A)

val CyanMelody = Color(0xFF22D3EE)
val PinkChords = Color(0xFFEC4899)
val IndigoAccent = Color(0xFF6366F1)

val GreenSuccess = Color(0xFF10B981)
val AmberWarning = Color(0xFFFBBF24)
val RedError = Color(0xFFEF4444)

// Theme-aware accessors for Composable contexts
object ThemeAware {
    val melodyColor: Color @Composable get() = LocalThemeColors.current.melodyColor
    val chordsColor: Color @Composable get() = LocalThemeColors.current.chordsColor
    val accent: Color @Composable get() = LocalThemeColors.current.accent
    val background: Color @Composable get() = LocalThemeColors.current.background
    val surface: Color @Composable get() = LocalThemeColors.current.surface
}

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
