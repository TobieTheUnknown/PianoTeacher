package com.tobietheunknown.pianoteacher.ui.theme

import android.content.Context
import androidx.compose.runtime.*
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color

// ─── Theme mode ──────────────────────────────────────────────────────────────
// Legacy named themes are kept for backward compat; the design-token system
// (mode + accent + hands) takes precedence when those keys are set.
enum class AppTheme { DARK, MIDNIGHT_BLUE, PASTEL_COZY, LIGHT }

// ─── ThemeColors ─────────────────────────────────────────────────────────────
data class ThemeColors(
    val background: Color,
    val surface: Color,
    val accent: Color,
    val melodyColor: Color,
    val chordsColor: Color,
    val textPrimary: Color = Tokens.TextPrimary,
    val textSecondary: Color = Tokens.TextSecondary,
)

// Bases — ported pixel-fidelity from src/styles/tokens.css.
val DarkTheme = ThemeColors(
    background = Color(0xFF0A0C10),
    surface = Color(0xFF11141B),
    accent = Color(0xFF3B82F6),       // AccentBlue (default)
    melodyColor = Color(0xFF22D3EE),  // HandsClassic right
    chordsColor = Color(0xFFEC4899),  // HandsClassic left
    textPrimary = Color(0xFFE8EAF0),
    textSecondary = Color(0xFFA8AEBD),
)

val LightTheme = ThemeColors(
    background = Color(0xFFF7F8FA),
    surface = Color(0xFFFFFFFF),
    accent = Color(0xFF3B82F6),
    melodyColor = Color(0xFF22D3EE),
    chordsColor = Color(0xFFEC4899),
    textPrimary = Color(0xFF0F1218),
    textSecondary = Color(0xFF4B5363),
)

val MidnightBlueTheme = ThemeColors(
    background = Color(0xFF0A0E1A),
    surface = Color(0xFF111833),
    accent = Color(0xFF4F8EFF),
    melodyColor = Color(0xFF00E5FF),
    chordsColor = Color(0xFFFF4081)
)

val PastelCozyTheme = ThemeColors(
    background = Color(0xFF1A1520),
    surface = Color(0xFF231E2A),
    accent = Color(0xFFC4A1D4),
    melodyColor = Color(0xFF7ECFB3),
    chordsColor = Color(0xFFE8A0BF)
)

fun getThemeColors(theme: AppTheme) = when (theme) {
    AppTheme.DARK -> DarkTheme
    AppTheme.LIGHT -> LightTheme
    AppTheme.MIDNIGHT_BLUE -> MidnightBlueTheme
    AppTheme.PASTEL_COZY -> PastelCozyTheme
}

// ─── Accent presets ──────────────────────────────────────────────────────────
data class AccentPreset(val key: String, val color: Color, val hover: Color)

val AccentBlue    = AccentPreset("blue",    Color(0xFF3B82F6), Color(0xFF60A5FA))
val AccentViolet  = AccentPreset("violet",  Color(0xFF8B5CF6), Color(0xFFA78BFA))
val AccentEmerald = AccentPreset("emerald", Color(0xFF10B981), Color(0xFF34D399))
val AccentAmber   = AccentPreset("amber",   Color(0xFFF59E0B), Color(0xFFFBBF24))

val AllAccents = listOf(AccentBlue, AccentViolet, AccentEmerald, AccentAmber)

fun accentByKey(key: String): AccentPreset = AllAccents.firstOrNull { it.key == key } ?: AccentBlue

// ─── Hand-color presets ──────────────────────────────────────────────────────
data class HandPreset(val key: String, val right: Color, val left: Color)

val HandsClassic = HandPreset("classic", Color(0xFF22D3EE), Color(0xFFEC4899))
val HandsOcean   = HandPreset("ocean",   Color(0xFF38BDF8), Color(0xFFF97316))
val HandsForest  = HandPreset("forest",  Color(0xFF34D399), Color(0xFFC084FC))
val HandsSunset  = HandPreset("sunset",  Color(0xFFFBBF24), Color(0xFFF43F5E))
val HandsMono    = HandPreset("mono",    Color(0xFFCBD5E1), Color(0xFF64748B))

val AllHands = listOf(HandsClassic, HandsOcean, HandsForest, HandsSunset, HandsMono)

fun handsByKey(key: String): HandPreset = AllHands.firstOrNull { it.key == key } ?: HandsClassic

/**
 * Compose the final ThemeColors from a base theme + accent + hands preset.
 * Mirrors how the web's tokens.css resolves --accent / --hand-right / --hand-left
 * via data-* attributes on <html>.
 */
fun composeThemeColors(base: ThemeColors, accent: AccentPreset, hands: HandPreset): ThemeColors {
    return base.copy(
        accent = accent.color,
        melodyColor = hands.right,
        chordsColor = hands.left,
    )
}

val LocalThemeColors = compositionLocalOf { DarkTheme }

// ─── Preferences ─────────────────────────────────────────────────────────────
object ThemePrefs {
    private const val PREF_NAME = "piano_teacher_prefs"
    private const val KEY_THEME = "app_theme"
    private const val KEY_METRO_VOL = "metronome_volume"
    private const val KEY_RELEASE = "release_level"
    // Design system keys — mirror the web's localStorage entries so devices
    // sharing a backup can carry their preset over.
    private const val KEY_DESIGN_MODE = "piano-teacher-design-theme"     // dark | light
    private const val KEY_DESIGN_ACCENT = "piano-teacher-design-accent"  // blue | violet | emerald | amber
    private const val KEY_DESIGN_HANDS = "piano-teacher-design-hands"    // classic | ocean | forest | sunset | mono

    fun getTheme(context: Context): AppTheme {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        // Prefer the new design key when present
        val designMode = prefs.getString(KEY_DESIGN_MODE, null)
        if (designMode != null) {
            return if (designMode == "light") AppTheme.LIGHT else AppTheme.DARK
        }
        return try { AppTheme.valueOf(prefs.getString(KEY_THEME, "DARK") ?: "DARK") } catch (_: Exception) { AppTheme.DARK }
    }

    fun setTheme(context: Context, theme: AppTheme) {
        val designMode = when (theme) {
            AppTheme.LIGHT -> "light"
            else -> "dark"
        }
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_THEME, theme.name)
            .putString(KEY_DESIGN_MODE, designMode)
            .apply()
    }

    fun getAccent(context: Context): AccentPreset {
        val key = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .getString(KEY_DESIGN_ACCENT, "blue") ?: "blue"
        return accentByKey(key)
    }

    fun setAccent(context: Context, accent: AccentPreset) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_DESIGN_ACCENT, accent.key).apply()
    }

    fun getHands(context: Context): HandPreset {
        val key = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .getString(KEY_DESIGN_HANDS, "classic") ?: "classic"
        return handsByKey(key)
    }

    fun setHands(context: Context, hands: HandPreset) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_DESIGN_HANDS, hands.key).apply()
    }

    fun getMetronomeVolume(context: Context): Int {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getInt(KEY_METRO_VOL, 1)
    }

    fun setMetronomeVolume(context: Context, level: Int) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit().putInt(KEY_METRO_VOL, level.coerceIn(0, 2)).apply()
    }

    fun getReleaseLevel(context: Context): Int {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getInt(KEY_RELEASE, 1)
    }

    fun setReleaseLevel(context: Context, level: Int) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit().putInt(KEY_RELEASE, level.coerceIn(0, 2)).apply()
    }
}

// ─── ThemeState — global reactive state ──────────────────────────────────────
object ThemeState {
    val current = mutableStateOf(AppTheme.DARK)
    val accent = mutableStateOf(AccentBlue)
    val hands = mutableStateOf(HandsClassic)

    fun init(context: Context) {
        current.value = ThemePrefs.getTheme(context)
        accent.value = ThemePrefs.getAccent(context)
        hands.value = ThemePrefs.getHands(context)
    }

    fun setTheme(context: Context, theme: AppTheme) {
        ThemePrefs.setTheme(context, theme)
        current.value = theme
    }

    fun setAccent(context: Context, value: AccentPreset) {
        ThemePrefs.setAccent(context, value)
        accent.value = value
    }

    fun setHands(context: Context, value: HandPreset) {
        ThemePrefs.setHands(context, value)
        hands.value = value
    }

    // Backward-compat alias used by existing MainActivity wiring.
    fun set(context: Context, theme: AppTheme) = setTheme(context, theme)
}
