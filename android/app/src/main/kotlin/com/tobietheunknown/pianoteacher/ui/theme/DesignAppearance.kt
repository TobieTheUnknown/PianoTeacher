package com.tobietheunknown.pianoteacher.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
                    label = a.key,
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

@OptIn(ExperimentalLayoutApi::class)
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
            color = TextSecondary,
        )
        if (wrap) {
            FlowRow(
                modifier = Modifier.selectableGroup(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                maxItemsInEachRow = 3,
            ) {
                content()
            }
        } else {
            Row(
                modifier = Modifier.selectableGroup(),
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
            .selectable(
                selected = selected,
                onClick = onClick,
                role = Role.RadioButton,
            )
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
            color = if (selected) accent.color else TextSecondary,
        )
    }
}

@Composable
private fun AccentDot(
    label: String,
    color: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .selectable(
                selected = selected,
                onClick = onClick,
                role = Role.RadioButton,
            )
            .semantics {
                contentDescription = "Couleur d’accent $label"
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(color)
                .border(
                    width = if (selected) 3.dp else 0.dp,
                    color = if (selected) TextPrimary else Color.Transparent,
                    shape = CircleShape,
                )
        )
    }
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
            .selectable(
                selected = selected,
                onClick = onClick,
                role = Role.RadioButton,
            )
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
            color = if (selected) accent.color else TextSecondary,
        )
    }
}
