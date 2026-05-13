package com.tobietheunknown.pianoteacher.ui.common

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text

/**
 * SongCover — procedural square cover.
 *
 * Mirrors the web Cover.jsx: stable color gradient derived from the title
 * hash, big bold initials centered, "piano stripe" repeating-vertical-line
 * overlay for the signature visual.
 */
@Composable
fun SongCover(
    title: String,
    size: Dp = 56.dp,
    cornerRadius: Dp = 10.dp,
) {
    val gradient = remember(title) { coverGradient(title) }
    val initials = remember(title) { coverInitials(title) }

    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(cornerRadius))
            .background(brush = gradient),
        contentAlignment = Alignment.Center,
    ) {
        // Piano stripe overlay — thin vertical lines every 14-16dp
        Canvas(modifier = Modifier.matchParentSize()) {
            val stripeColor = Color(0x10FFFFFF) // ~6% white
            val period = 16f
            val stripeWidth = 2f
            var x = 14f
            while (x < this.size.width) {
                drawRect(
                    color = stripeColor,
                    topLeft = Offset(x, 0f),
                    size = Size(stripeWidth, this.size.height),
                )
                x += period
            }
        }
        Text(
            text = initials,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value / 2.4f).sp,
        )
    }
}

private fun coverInitials(title: String): String {
    val t = title.trim()
    if (t.isEmpty()) return "?"
    val words = t.split("\\s+".toRegex()).filter { it.isNotEmpty() }
    return when {
        words.size >= 2 -> "${words[0].first()}${words[1].first()}".uppercase()
        else -> t.take(2).uppercase()
    }
}

private val COVER_PALETTES = listOf(
    listOf(Color(0xFFE45D5D), Color(0xFFE0A05A)), // red → orange
    listOf(Color(0xFFE0A05A), Color(0xFFE6C870)), // orange → amber
    listOf(Color(0xFF22D3EE), Color(0xFF60A5FA)), // cyan → blue
    listOf(Color(0xFF8B5CF6), Color(0xFFC084FC)), // violet → lilac
    listOf(Color(0xFF10B981), Color(0xFF34D399)), // emerald → mint
    listOf(Color(0xFFEC4899), Color(0xFFF472B6)), // pink → rose
    listOf(Color(0xFF6366F1), Color(0xFF8B5CF6)), // indigo → violet
    listOf(Color(0xFFF59E0B), Color(0xFFFB923C)), // amber → tangerine
)

private fun coverGradient(title: String): Brush {
    var hash = 0
    for (c in title) hash = (hash * 31 + c.code) and 0x7FFFFFFF
    val palette = COVER_PALETTES[hash % COVER_PALETTES.size]
    return Brush.linearGradient(
        colors = listOf(palette[0], palette[1]),
        start = Offset(0f, 0f),
        end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
    )
}
