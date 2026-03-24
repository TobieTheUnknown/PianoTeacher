package com.tobietheunknown.pianoteacher.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ─── Piano Teacher Color Palette ─────────────────────────────────────────────
// Dark theme, inspired by v1 design system
// Cyan = right hand (melody), Pink = left hand (chords), Indigo = accents

val Background = Color(0xFF0A0C10)
val Surface = Color(0xFF131620)
val SurfaceVariant = Color(0xFF1C1F2A)

val CyanMelody = Color(0xFF22D3EE)       // Right hand
val PinkChords = Color(0xFFEC4899)        // Left hand
val IndigoAccent = Color(0xFF6366F1)      // UI accent

val GreenSuccess = Color(0xFF10B981)
val AmberWarning = Color(0xFFFBBF24)
val RedError = Color(0xFFEF4444)

private val DarkColorScheme = darkColorScheme(
    primary = IndigoAccent,
    secondary = CyanMelody,
    tertiary = PinkChords,
    background = Background,
    surface = Surface,
    surfaceVariant = SurfaceVariant,
    onPrimary = Color.White,
    onSecondary = Color.Black,
    onBackground = Color(0xFFE2E8F0),
    onSurface = Color(0xFFE2E8F0),
    error = RedError,
)

@Composable
fun PianoTeacherTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography(),
        content = content
    )
}
