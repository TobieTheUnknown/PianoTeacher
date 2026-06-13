package com.tobietheunknown.pianoteacher.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color

// ─── Piano Teacher Design Tokens ─────────────────────────────────────────────
// Source of truth: web/src/styles/tokens.css (dark theme).
// These mirror the web token NAMES with EXACTLY the web hex values. The neutral
// scale (bg / surfaces / borders / text / status) is static; accent + hand
// colors stay dynamic (user-configurable) via ActiveTheme / LocalThemeColors —
// the constants below are only the DEFAULTS.
object Tokens {
    // Surfaces — --bg / --surface-1..3
    val Background = Color(0xFF0A0C10)   // --bg
    val Surface1   = Color(0xFF11141B)   // --surface-1
    val Surface2   = Color(0xFF181C25)   // --surface-2
    val Surface3   = Color(0xFF1F242F)   // --surface-3

    // Borders — --border (white 8%) / --hairline (white 5%) / --border-strong (white 14%)
    val BorderColor   = Color(0x14FFFFFF) // rgba(255,255,255,0.08)
    val Hairline      = Color(0x0DFFFFFF) // rgba(255,255,255,0.05)
    val BorderStrong  = Color(0x24FFFFFF) // rgba(255,255,255,0.14)

    // Text — --text-primary / secondary / tertiary / muted
    val TextPrimary   = Color(0xFFE8EAF0) // --text-primary
    val TextSecondary = Color(0xFFA8AEBD) // --text-secondary
    val TextTertiary  = Color(0xFF6B7280) // --text-tertiary
    val TextMuted     = Color(0xFF4B5563) // --text-muted

    // Accent (default blue) — --accent / --accent-hover
    val Accent      = Color(0xFF3B82F6)   // --accent
    val AccentHover = Color(0xFF60A5FA)   // --accent-hover

    // Hand colors (classic preset defaults) — --hand-right (cyan) / --hand-left (pink)
    val HandRight = Color(0xFF22D3EE)     // --hand-right
    val HandLeft  = Color(0xFFEC4899)     // --hand-left

    // Status — --success / --warning / --error
    val Success = Color(0xFF10B981)       // --success
    val Warning = Color(0xFFFBBF24)       // --warning
    val Error   = Color(0xFFEF4444)       // --error

    // Piano keys — --key-white / --key-white-shadow / --key-black
    val KeyWhite       = Color(0xFFF2F4F8)
    val KeyWhiteShadow = Color(0xFFCBD0D8)
    val KeyBlack       = Color(0xFF1A1D24)
}

// Top-level aliases (flat names) so screens can write TextSecondary, Surface2, etc.
val TokenBackground get() = Tokens.Background
val Surface1   get() = Tokens.Surface1
val Surface2   get() = Tokens.Surface2
val Surface3   get() = Tokens.Surface3
val BorderColor  get() = Tokens.BorderColor
val Hairline     get() = Tokens.Hairline
val BorderStrong get() = Tokens.BorderStrong
val TextPrimary   get() = Tokens.TextPrimary
val TextSecondary get() = Tokens.TextSecondary
val TextTertiary  get() = Tokens.TextTertiary
val TextMuted     get() = Tokens.TextMuted
val AccentHover get() = Tokens.AccentHover
val Success get() = Tokens.Success
val Warning get() = Tokens.Warning
val Error   get() = Tokens.Error
val KeyWhite       get() = Tokens.KeyWhite
val KeyWhiteShadow get() = Tokens.KeyWhiteShadow
val KeyBlack       get() = Tokens.KeyBlack

// Mutable theme state that survives recomposition and is readable from Canvas (non-composable) contexts.
object ActiveTheme {
    var colors: ThemeColors = DarkTheme
        private set

    fun apply(theme: ThemeColors) { colors = theme }
}

// ─── Legacy aliases ──────────────────────────────────────────────────────────
// Kept working so existing screens compile; values now point at the tokens or
// the dynamic theme. Accent + hand colors stay dynamic (user-configurable).
val Background: Color get() = ActiveTheme.colors.background
val Surface: Color get() = ActiveTheme.colors.surface
val SurfaceVariant: Color get() = Tokens.Surface3

val CyanMelody: Color get() = ActiveTheme.colors.melodyColor   // dynamic hand-right
val PinkChords: Color get() = ActiveTheme.colors.chordsColor   // dynamic hand-left
val IndigoAccent: Color get() = ActiveTheme.colors.accent      // dynamic accent

// Static aliases pointing at tokens (use these names where colors are decorative neutrals).
val HandRight: Color get() = ActiveTheme.colors.melodyColor    // dynamic
val HandLeft: Color get() = ActiveTheme.colors.chordsColor     // dynamic
val Accent: Color get() = ActiveTheme.colors.accent            // dynamic

val GreenSuccess = Tokens.Success
val AmberWarning = Tokens.Warning
val RedError = Tokens.Error

// Theme-aware accessors for Composable contexts
object ThemeAware {
    val melodyColor: Color @Composable get() = LocalThemeColors.current.melodyColor
    val chordsColor: Color @Composable get() = LocalThemeColors.current.chordsColor
    val accent: Color @Composable get() = LocalThemeColors.current.accent
    val background: Color @Composable get() = LocalThemeColors.current.background
    val surface: Color @Composable get() = LocalThemeColors.current.surface
}

private val DarkColorScheme = darkColorScheme(
    primary = Tokens.Accent,
    secondary = Tokens.HandRight,
    tertiary = Tokens.HandLeft,
    background = Tokens.Background,
    surface = Tokens.Surface1,
    surfaceVariant = Tokens.Surface3,
    onPrimary = Color.White,
    onSecondary = Color.Black,
    onBackground = Tokens.TextPrimary,
    onSurface = Tokens.TextPrimary,
    error = Tokens.Error,
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
