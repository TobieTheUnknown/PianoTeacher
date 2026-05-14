package com.tobietheunknown.pianoteacher.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color

// ─── Piano Teacher Color Palette ─────────────────────────────────────────────
// Mutable theme state that survives recomposition and is readable from Canvas (non-composable) contexts.
object ActiveTheme {
    var colors: ThemeColors = DarkTheme
        private set

    fun apply(theme: ThemeColors) { colors = theme }
}

val Background: Color get() = ActiveTheme.colors.background
val Surface: Color get() = ActiveTheme.colors.surface
val SurfaceVariant: Color get() = Color(0xFF1C1F2A)

val CyanMelody: Color get() = ActiveTheme.colors.melodyColor
val PinkChords: Color get() = ActiveTheme.colors.chordsColor
val IndigoAccent: Color get() = ActiveTheme.colors.accent

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
    ActiveTheme.apply(colors)
    val colorScheme = DarkColorScheme.copy(
        primary = colors.accent,
        secondary = colors.melodyColor,
        tertiary = colors.chordsColor,
        background = colors.background,
        surface = colors.surface
    )
    CompositionLocalProvider(LocalThemeColors provides colors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography(),
            content = content
        )
    }
}
