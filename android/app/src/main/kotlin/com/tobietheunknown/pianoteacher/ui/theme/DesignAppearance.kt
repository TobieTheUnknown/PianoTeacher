package com.tobietheunknown.pianoteacher.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Theme + accent + hand-color picker for Settings.
 *
 * Direct port of the web's DesignAppearance.jsx — three rows (Thème,
 * Couleur d'accent, Couleurs des mains) writing back to ThemeState which
 * persists to SharedPreferences using the same keys as the web app's
 * localStorage entries.
 */
@Composable
fun DesignAppearanceSection(
    currentTheme: AppTheme,
    onThemeChange: (AppTheme) -> Unit,
) {
    val context = LocalContext.current
    val accent by ThemeState.accent
    val hands by ThemeState.hands

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionLabel("Apparence")

        // Thème row
        PickerRow(label = "Thème") {
            ThemeSwatch(
                label = "Sombre",
                background = Color(0xFF0A0C10),
                selected = currentTheme == AppTheme.DARK || (currentTheme != AppTheme.LIGHT),
                onClick = { onThemeChange(AppTheme.DARK) },
            )
            ThemeSwatch(
                label = "Clair",
                background = Color(0xFFF7F8FA),
                selected = currentTheme == AppTheme.LIGHT,
                onClick = { onThemeChange(AppTheme.LIGHT) },
                hasBorder = true,
            )
        }

        // Couleur d'accent row
        PickerRow(label = "Couleur d'accent") {
            AllAccents.forEach { a ->
                AccentDot(
                    color = a.color,
                    selected = accent.key == a.key,
                    onClick = { ThemeState.setAccent(context, a) },
                )
            }
        }

        // Couleurs des mains row
        PickerRow(label = "Couleurs des mains", wrap = true) {
            AllHands.forEach { h ->
                HandSwatch(
                    label = handLabel(h.key),
                    right = h.right,
                    left = h.left,
                    selected = hands.key == h.key,
                    onClick = { ThemeState.setHands(context, h) },
                )
            }
        }
    }
}

private fun handLabel(key: String): String = when (key) {
    "classic" -> "Classique"
    "ocean" -> "Océan"
    "forest" -> "Forêt"
    "sunset" -> "Coucher"
    "mono" -> "Mono"
    else -> key
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF6B7280),
        letterSpacing = 0.08.em,
    )
}

private val Double.em get() = this.sp.value.let { androidx.compose.ui.unit.TextUnit(it.toFloat(), androidx.compose.ui.unit.TextUnitType.Em) }

@Composable
private fun PickerRow(
    label: String,
    wrap: Boolean = false,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFFA8AEBD),
        )
        if (wrap) {
            // 3 columns flow
            val items = mutableListOf<@Composable () -> Unit>()
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                content()
            }
        } else {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                content()
            }
        }
    }
}

@Composable
private fun ThemeSwatch(
    label: String,
    background: Color,
    selected: Boolean,
    onClick: () -> Unit,
    hasBorder: Boolean = false,
) {
    val accent by ThemeState.accent
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) accent.color.copy(alpha = 0.16f) else Color.Transparent)
            .border(
                width = 1.dp,
                color = if (selected) accent.color else Color.Transparent,
                shape = RoundedCornerShape(10.dp),
            )
            .clickable(onClick = onClick)
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier = Modifier
                .size(width = 40.dp, height = 28.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(background)
                .then(
                    if (hasBorder) Modifier.border(1.dp, Color(0x33000000), RoundedCornerShape(6.dp))
                    else Modifier
                )
        )
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (selected) accent.color else Color(0xFFA8AEBD),
        )
    }
}

@Composable
private fun AccentDot(
    color: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(color)
            .border(
                width = if (selected) 3.dp else 0.dp,
                color = if (selected) Color(0xFFE8EAF0) else Color.Transparent,
                shape = CircleShape,
            )
            .clickable(onClick = onClick)
    )
}

@Composable
private fun HandSwatch(
    label: String,
    right: Color,
    left: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val accent by ThemeState.accent
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) accent.color.copy(alpha = 0.16f) else Color.Transparent)
            .border(
                width = 1.dp,
                color = if (selected) accent.color else Color.Transparent,
                shape = RoundedCornerShape(10.dp),
            )
            .clickable(onClick = onClick)
            .padding(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            modifier = Modifier
                .size(width = 40.dp, height = 22.dp)
                .clip(RoundedCornerShape(6.dp)),
        ) {
            Box(modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .background(left))
            Box(modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .background(right))
        }
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (selected) accent.color else Color(0xFFA8AEBD),
        )
    }
}
