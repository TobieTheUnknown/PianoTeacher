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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.theme.*

// File-level palette: hoisted out of the Canvas DrawScope so we don't
// allocate Color objects on every frame. Routed through design tokens.
private val MK_BG_DARK = Color(0xFF0F1218)
private val MK_BORDER = BorderColor
private val MK_LABEL_GRAY = TextTertiary
private val MK_DIVIDER_GRAY = TextMuted
private val MK_ICON_GRAY = TextSecondary
private val MK_KEY_WHITE = KeyWhite
private val MK_KEY_WHITE_SHADOW = KeyWhiteShadow
private val MK_KEY_BLACK = KeyBlack
private val MK_KEY_BORDER = TokenBackground

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
 *
 * The result is rounded UP to the next multiple of 12 (whole octaves) so the
 * window always starts on a natural C. We do NOT cap at songSpan — doing so
 * can yield a window exactly equal to the widest single-measure span, which
 * makes the octave-aligned window unable to contain notes that straddle an
 * octave boundary (e.g. Si2+Sol3 at the edge of a 12-semitone window).
 * Instead we pad by at least 4 semitones beyond the widest span so the
 * C-aligned window always has room to accommodate boundary-straddling measures.
 */
fun fixedKeyboardRange(perMeasureRanges: List<Pair<Int, Int>>): Int {
    if (perMeasureRanges.isEmpty()) return 24 // 2 octaves default
    var widest = 12
    for ((a, b) in perMeasureRanges) {
        widest = maxOf(widest, b - a + 1)
    }
    // Add at least 4 semitones of padding so C-aligned windows never exclude
    // notes sitting just past an octave boundary. Round up to whole octave.
    val padded = widest + 4
    return ((padded + 11) / 12) * 12
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
            //
            // Initial position: centre the window around C4 (midi 60), aligned
            // to the nearest C below (i.e. a multiple-of-12 MIDI value).
            var startMidi by remember(fixedRange) {
                mutableStateOf(run {
                    val raw = 60 - windowSemis / 2
                    // Round DOWN to the nearest C (multiple of 12).
                    raw - ((raw % 12 + 12) % 12)
                })
            }
            LaunchedEffect(activeRight, activeLeft, fixedRange) {
                val active = activeRight + activeLeft
                if (active.isEmpty()) return@LaunchedEffect
                val lo = active.min()
                val hi = active.max()
                // If both lo and hi are already within the current window, no shift needed.
                if (lo >= startMidi && hi <= startMidi + windowSemis - 1) return@LaunchedEffect
                // Compute a single stable target: the lowest C-aligned position that
                // covers both lo and hi. We start from the C just below `lo` and
                // move up by whole octaves until hi fits. This avoids the two-step
                // up-then-down oscillation where each while undoes the other.
                val cBase = lo - ((lo % 12 + 12) % 12)   // C just at or below lo
                var s = cBase
                while (s + windowSemis - 1 < hi) s += 12   // shift up until hi fits
                // If lo is still below s (shouldn't happen for sane widths, but guard):
                while (lo < s) s -= 12
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
                    drawRect(
                        color = MK_KEY_BORDER,
                        topLeft = Offset(x, 0f),
                        size = Size(blackWidth, blackHeight),
                        style = Stroke(width = 1f),
                    )
                }

                // ── Edge overflow indicators ──────────────────────────────────
                // If any active note is still outside the visible window (can happen
                // when the song span exceeds the window, e.g. very wide-range songs),
                // draw a small filled triangle at the keyboard edge in the hand color.
                // Right hand (cyan) takes priority if both hands overflow the same edge.
                val edgeW = 10.dp.toPx()
                val edgeH = 10.dp.toPx()
                val edgeMidY = h * 0.40f  // within white-key area

                val leftOverflowRight  = activeRight.any { it < startMidi }
                val leftOverflowLeft   = activeLeft.any  { it < startMidi }
                val rightOverflowRight = activeRight.any { it > endMidi }
                val rightOverflowLeft  = activeLeft.any  { it > endMidi }

                if (leftOverflowRight || leftOverflowLeft) {
                    val arrowColor = if (leftOverflowRight) cyan else pink
                    // Left-pointing triangle at the left edge.
                    val path = androidx.compose.ui.graphics.Path().apply {
                        moveTo(0f, edgeMidY)
                        lineTo(edgeW, edgeMidY - edgeH / 2f)
                        lineTo(edgeW, edgeMidY + edgeH / 2f)
                        close()
                    }
                    drawPath(path, arrowColor)
                }
                if (rightOverflowRight || rightOverflowLeft) {
                    val arrowColor = if (rightOverflowRight) cyan else pink
                    // Right-pointing triangle at the right edge.
                    val path = androidx.compose.ui.graphics.Path().apply {
                        moveTo(w, edgeMidY)
                        lineTo(w - edgeW, edgeMidY - edgeH / 2f)
                        lineTo(w - edgeW, edgeMidY + edgeH / 2f)
                        close()
                    }
                    drawPath(path, arrowColor)
                }
            }
        }
    }
}
