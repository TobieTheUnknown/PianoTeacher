package com.tobietheunknown.pianoteacher.ui.common

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.theme.CyanMelody
import com.tobietheunknown.pianoteacher.ui.theme.PinkChords

// File-level palette: hoisted out of the Canvas DrawScope so we don't
// allocate Color objects on every frame.
private val MK_BG_DARK = Color(0xFF0F1218)
private val MK_BORDER = Color(0x14FFFFFF)
private val MK_LABEL_GRAY = Color(0xFF6B7280)
private val MK_DIVIDER_GRAY = Color(0xFF334155)
private val MK_ICON_GRAY = Color(0xFF94A3B8)
private val MK_KEY_WHITE = Color(0xFFE8EAF0)
private val MK_KEY_WHITE_SHADOW = Color(0xFFCBD0D8)
private val MK_KEY_BLACK = Color(0xFF1A1D24)

private val NOTE_NAMES_FR = arrayOf(
    "Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"
)
private fun noteNameFr(pitch: Int): String =
    NOTE_NAMES_FR[((pitch % 12) + 12) % 12]

/**
 * Compute the fixed pitch-window size (in semitones) the keyboard should
 * display so every measure in the song fits without changing zoom level.
 * Pass the per-measure (melody + chord) pitch pairs as a flat list of
 * (min, max). Returns at minimum 12 semitones (one octave).
 */
fun fixedKeyboardRange(perMeasureRanges: List<Pair<Int, Int>>): Int {
    if (perMeasureRanges.isEmpty()) return 24 // 2 octaves default
    var widest = 12
    var minP = Int.MAX_VALUE
    var maxP = Int.MIN_VALUE
    for ((a, b) in perMeasureRanges) {
        widest = maxOf(widest, b - a + 1)
        minP = minOf(minP, a)
        maxP = maxOf(maxP, b)
    }
    // Pad a bit and round up to the next octave boundary so keys land on
    // natural C-to-C windows. Capped to the actual song span so we don't
    // show empty octaves on either side.
    return (widest + 8).coerceAtMost(maxP - minP + 1).coerceAtLeast(12)
}

/**
 * MiniKeyboard — full-screen-width strip pinned above the dock.
 *
 * The window size (`fixedRange` semitones) stays constant for the whole
 * song; only the start pitch shifts by octaves to keep the currently
 * focused notes visible. This avoids the "zoom dance" of an auto-fitting
 * keyboard that re-scales on every measure change.
 *
 * Notes from the right hand (melody) light up cyan, left hand (chords)
 * pink. The header shows the active note labels and a chevron to collapse.
 */
@Composable
fun MiniKeyboard(
    activeRight: Set<Int>,
    activeLeft: Set<Int>,
    fixedRange: Int = 36,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(true) }

    val rightLabels = remember(activeRight) {
        activeRight.sorted().map { noteNameFr(it) }.distinct()
    }
    val leftLabels = remember(activeLeft) {
        activeLeft.sorted().map { noteNameFr(it) }.distinct()
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MK_BG_DARK)
            .border(1.dp, MK_BORDER, RoundedCornerShape(0.dp))
    ) {
        // Header strip — labels + collapse toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                "CLAVIER",
                color = MK_LABEL_GRAY,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.08.sp,
            )
            if (rightLabels.isNotEmpty()) {
                Text(
                    rightLabels.joinToString(" · "),
                    color = CyanMelody,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (leftLabels.isNotEmpty()) {
                Text("·", color = MK_DIVIDER_GRAY, fontSize = 10.sp)
                Text(
                    leftLabels.joinToString(" · "),
                    color = PinkChords,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            } else {
                Box(modifier = Modifier.weight(1f))
            }
            IconButton(
                onClick = { expanded = !expanded },
                modifier = Modifier.size(28.dp),
            ) {
                Icon(
                    if (expanded) Icons.Default.KeyboardArrowDown
                    else Icons.Default.KeyboardArrowUp,
                    contentDescription = if (expanded) "Réduire" else "Afficher",
                    tint = MK_ICON_GRAY,
                    modifier = Modifier.size(18.dp),
                )
            }
        }

        if (expanded) {
            val rangeSemis = fixedRange.coerceAtLeast(12)
            // Round up to the next multiple of 12 so we always start on a C.
            val windowSemis = ((rangeSemis + 11) / 12) * 12

            // Persistent window start: only shifts when an active note actually
            // spills outside the current viewport. Same-octave content across
            // measures keeps the keyboard fixed — no octave jumps for a hand
            // whose notes were already visible.
            var startMidi by remember(fixedRange) {
                mutableStateOf(48 - windowSemis / 2 - ((48 - windowSemis / 2) % 12).let {
                    if (it < 0) it + 12 else it
                })
            }
            LaunchedEffect(activeRight, activeLeft, fixedRange) {
                val active = activeRight + activeLeft
                if (active.isEmpty()) return@LaunchedEffect
                var s = startMidi
                // Only adjust by octaves to bring spilled notes back into view.
                while (active.max() > s + windowSemis - 1) s += 12
                while (active.min() < s) s -= 12
                val clamped = s.coerceIn(12, 108 - windowSemis)
                if (clamped != startMidi) startMidi = clamped
            }
            val endMidi = startMidi + windowSemis - 1

            val isBlack = { m: Int -> (m % 12) in listOf(1, 3, 6, 8, 10) }
            val whiteCount = (startMidi..endMidi).count { !isBlack(it) }
            val blackWidthRatio = 0.6f

            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
            ) {
                val w = size.width
                val h = size.height
                val whiteWidth = w / whiteCount.toFloat()
                val blackWidth = whiteWidth * blackWidthRatio
                val blackHeight = h * 0.62f
                val cyan = CyanMelody
                val pink = PinkChords

                // White keys
                var wi = 0
                for (m in startMidi..endMidi) {
                    if (isBlack(m)) continue
                    val x = wi * whiteWidth
                    val fill = when {
                        m in activeRight -> cyan
                        m in activeLeft -> pink
                        else -> MK_KEY_WHITE
                    }
                    drawRect(color = fill, topLeft = Offset(x, 0f), size = Size(whiteWidth - 0.5f, h))
                    drawRect(
                        color = MK_KEY_WHITE_SHADOW,
                        topLeft = Offset(x + whiteWidth - 0.5f, 0f),
                        size = Size(0.5f, h),
                    )
                    wi++
                }
                // Black keys
                wi = 0
                for (m in startMidi..endMidi) {
                    if (!isBlack(m)) {
                        wi++
                        continue
                    }
                    val x = wi * whiteWidth - blackWidth / 2f
                    val fill = when {
                        m in activeRight -> cyan
                        m in activeLeft -> pink
                        else -> MK_KEY_BLACK
                    }
                    drawRect(color = fill, topLeft = Offset(x, 0f), size = Size(blackWidth, blackHeight))
                }
            }
        }
    }
}
