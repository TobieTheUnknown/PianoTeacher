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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
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

// Flat-name table (no sharps/flats for now; enharmonics handled by keySignature
// on the full note-name path, but for overflow labels we use the sharp spelling).
private val NOTE_NAMES_FR = arrayOf(
    "Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"
)
// Flat-preferred names for note classes that are typically written flat.
// This matches the enharmonic convention used on the web side.
private val NOTE_NAMES_FR_FLAT = arrayOf(
    "Do", "Réb", "Ré", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"
)

fun noteNameFr(pitch: Int, useFlats: Boolean = false): String {
    val idx = ((pitch % 12) + 12) % 12
    return if (useFlats) NOTE_NAMES_FR_FLAT[idx] else NOTE_NAMES_FR[idx]
}

/** Result of [fixedKeyboardRange] — carries both the window size and the
 *  density-anchored initial scroll position (C-aligned MIDI start). */
data class KeyboardRangeResult(val windowSemis: Int, val densityAnchor: Int)

/**
 * Compute the fixed pitch-window size (in semitones) the keyboard should
 * display so every measure in the song fits without changing zoom level.
 * Pass the per-measure (melody + chord) pitch pairs as a flat list of
 * (min, max) AND a flat list of every note pitch across the whole song
 * (both hands) for the density vote.
 *
 * The result is rounded UP to the next multiple of 12 (whole octaves) so the
 * window always starts on a natural C. We do NOT cap at songSpan — doing so
 * can yield a window exactly equal to the widest single-measure span, which
 * makes the octave-aligned window unable to contain notes that straddle an
 * octave boundary (e.g. Si2+Sol3 at the edge of a 12-semitone window).
 * Instead we pad by at least 4 semitones beyond the widest span so the
 * C-aligned window always has room to accommodate boundary-straddling measures.
 *
 * Density vote: sweep all C-aligned start positions covering the song range
 * and pick the one that contains the most note events. This anchors the
 * keyboard over the busiest register (e.g. the left-hand chord cluster for
 * Departure) rather than the lowest or highest extreme.
 *
 * @param perMeasureRanges per-measure (min, max) MIDI pitch pairs (both hands)
 * @param allPitches flat list of every note pitch across the whole song (both hands)
 */
fun fixedKeyboardRange(
    perMeasureRanges: List<Pair<Int, Int>>,
    allPitches: List<Int> = emptyList(),
): KeyboardRangeResult {
    if (perMeasureRanges.isEmpty()) return KeyboardRangeResult(24, 36) // C3

    var globalMin = Int.MAX_VALUE
    var widest = 12
    var globalMax = Int.MIN_VALUE
    for ((a, b) in perMeasureRanges) {
        widest = maxOf(widest, b - a + 1)
        if (a < globalMin) globalMin = a
        if (b > globalMax) globalMax = b
    }
    // Add at least 4 semitones of padding so C-aligned windows never exclude
    // notes sitting just past an octave boundary. Round up to whole octave.
    val padded = widest + 4
    val windowSemis = ((padded + 11) / 12) * 12

    // Density vote: sweep C-aligned start positions that could cover any note
    // in the global range. For each position count how many note events fall
    // within [pos, pos+windowSemis-1]; pick the max.
    val firstC = globalMin - ((globalMin % 12 + 12) % 12)
    var bestStart = maxOf(12, firstC)
    var bestCount = 0
    var s = maxOf(12, firstC)
    while (s <= globalMax && s <= 108 - windowSemis) {
        val endS = s + windowSemis - 1
        val count = allPitches.count { it in s..endS }
        if (count > bestCount) {
            bestCount = count
            bestStart = s
        }
        s += 12
    }
    val densityAnchor = bestStart.coerceIn(12, 108 - windowSemis)
    return KeyboardRangeResult(windowSemis, densityAnchor)
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
    /** C-aligned MIDI start for the density-anchored initial scroll position.
     *  When null the keyboard falls back to centring around C4. */
    globalAnchor: Int? = null,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(true) }
    val textMeasurer = rememberTextMeasurer()

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
            // Initial position: use the density-anchored C-aligned start from
            // fixedKeyboardRange (globalAnchor) so the keyboard is pre-positioned
            // over the busiest register rather than always centred on C4.
            var startMidi by remember(fixedRange, globalAnchor) {
                mutableStateOf(
                    if (globalAnchor != null) {
                        globalAnchor.coerceIn(12, 108 - windowSemis)
                    } else {
                        val raw = 60 - windowSemis / 2
                        // Round DOWN to the nearest C (multiple of 12).
                        raw - ((raw % 12 + 12) % 12)
                    }
                )
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

                // ── Octave-fold key rendering ─────────────────────────────────
                // For every note of the current measure that falls outside
                // [startMidi..endMidi], fold it into the window by shifting ±12
                // repeatedly. The landing key is colored in the hand's color and
                // gets a "+N" / "−N" label (Unicode minus) showing octave offset.
                //
                // Collision rules:
                //  • Fold key has a real note of the OTHER hand → split top/bottom.
                //  • Fold key has a real note of the SAME hand → single color + label.
                //  • Multiple folds on same key → stack labels; split if diff hands.

                // foldEntries: foldMidi → list of (hand color, octave offset)
                data class FoldEntry(val color: Color, val hand: String, val octaves: Int)
                val foldEntries = mutableMapOf<Int, MutableList<FoldEntry>>()

                fun collectFolds(pitchSet: Set<Int>, color: Color, hand: String) {
                    for (p in pitchSet) {
                        if (p in startMidi..endMidi) continue
                        var folded = p
                        if (p < startMidi) { while (folded < startMidi) folded += 12 }
                        else               { while (folded > endMidi)   folded -= 12 }
                        if (folded !in startMidi..endMidi) continue
                        val octaves = (p - folded) / 12 // positive = real note above fold key
                        val list = foldEntries.getOrPut(folded) { mutableListOf() }
                        if (list.none { it.hand == hand && it.octaves == octaves }) {
                            list.add(FoldEntry(color, hand, octaves))
                        }
                    }
                }
                collectFolds(activeRight, cyan, "right")
                collectFolds(activeLeft,  pink, "left")

                // Helper: format label text (Unicode minus U+2212 for negative)
                fun octaveLabel(octaves: Int): String = when {
                    octaves > 0 -> "+$octaves"
                    octaves < 0 -> "−${-octaves}"
                    else        -> ""
                }

                // Label style: small monospace, 8sp
                val foldLabelStyle = TextStyle(
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                )

                // Helper to resolve colors for a key given real/fold sources.
                // Returns (topColor, bottomColor, needsSplit).
                data class KeySource(val color: Color, val hand: String, val isFold: Boolean)
                fun resolveColors(m: Int): Triple<Color?, Color?, Boolean> {
                    val folds = foldEntries[m] ?: emptyList()
                    val realRight = m in activeRight
                    val realLeft  = m in activeLeft
                    val sources = mutableListOf<KeySource>()
                    if (realRight) sources.add(KeySource(cyan, "right", false))
                    if (realLeft)  sources.add(KeySource(pink, "left",  false))
                    for (fe in folds) {
                        val alreadyReal = (fe.hand == "right" && realRight) || (fe.hand == "left" && realLeft)
                        if (!alreadyReal) sources.add(KeySource(fe.color, fe.hand, true))
                    }
                    val hasRight = sources.any { it.hand == "right" }
                    val hasLeft  = sources.any { it.hand == "left"  }
                    val split    = hasRight && hasLeft
                    val foldSrc  = sources.firstOrNull { it.isFold }
                    val realSrc  = sources.firstOrNull { !it.isFold }
                    val top    = if (split) (foldSrc?.color ?: cyan) else sources.firstOrNull()?.color
                    val bottom = if (split) (realSrc?.color ?: pink) else null
                    return Triple(top, bottom, split)
                }

                // Pass 1: white keys (drawn first so black keys overlay their edges)
                var wi = 0
                for (m in startMidi..endMidi) {
                    if (isBlack(m)) continue
                    val x = wi * whiteWidth
                    val (topColor, bottomColor, needsSplit) = resolveColors(m)
                    if (needsSplit && topColor != null && bottomColor != null) {
                        drawRect(color = topColor,         topLeft = Offset(x, 0f),     size = Size(whiteWidth - 0.5f, h / 2f))
                        drawRect(color = bottomColor,      topLeft = Offset(x, h / 2f), size = Size(whiteWidth - 0.5f, h / 2f))
                        drawRect(color = MK_KEY_WHITE_SHADOW, topLeft = Offset(x + whiteWidth - 0.5f, 0f), size = Size(0.5f, h))
                    } else {
                        drawRect(color = topColor ?: MK_KEY_WHITE, topLeft = Offset(x, 0f), size = Size(whiteWidth - 0.5f, h))
                        drawRect(color = MK_KEY_WHITE_SHADOW,      topLeft = Offset(x + whiteWidth - 0.5f, 0f), size = Size(0.5f, h))
                    }
                    wi++
                }

                // Pass 2: black keys (painted on top of white keys)
                wi = 0
                for (m in startMidi..endMidi) {
                    if (!isBlack(m)) { wi++; continue }
                    val x = wi * whiteWidth - blackWidth / 2f
                    val (topColor, bottomColor, needsSplit) = resolveColors(m)
                    if (needsSplit && topColor != null && bottomColor != null) {
                        drawRect(color = topColor,    topLeft = Offset(x, 0f),             size = Size(blackWidth, blackHeight / 2f))
                        drawRect(color = bottomColor, topLeft = Offset(x, blackHeight / 2f), size = Size(blackWidth, blackHeight / 2f))
                    } else {
                        drawRect(color = topColor ?: MK_KEY_BLACK, topLeft = Offset(x, 0f), size = Size(blackWidth, blackHeight))
                    }
                    drawRect(color = MK_KEY_BORDER, topLeft = Offset(x, 0f), size = Size(blackWidth, blackHeight), style = Stroke(width = 1f))
                }

                // Pass 3: octave-fold labels drawn last (on top of all keys)
                wi = 0
                for (m in startMidi..endMidi) {
                    val isBlackKey = isBlack(m)
                    val folds = foldEntries[m] ?: emptyList()
                    if (!isBlackKey) wi++
                    if (folds.isEmpty()) continue
                    // Key center X
                    val keyCx: Float = if (!isBlackKey) {
                        (wi - 1) * whiteWidth + whiteWidth / 2f
                    } else {
                        wi * whiteWidth - blackWidth / 2f + blackWidth / 2f
                    }
                    // Label INSIDE the key at its bottom end — black on white keys,
                    // white on black keys (legibility over hand-colored text).
                    val labelColor = if (isBlackKey) Color.White else Color(0xFF0A0C10)
                    val keyBottom = if (isBlackKey) blackHeight else size.height
                    folds.forEachIndexed { stackIdx, fe ->
                        val label = octaveLabel(fe.octaves)
                        if (label.isEmpty()) return@forEachIndexed
                        val layout = textMeasurer.measure(label, foldLabelStyle.copy(color = labelColor))
                        val lx = keyCx - layout.size.width / 2f
                        val ly = keyBottom - layout.size.height - 2.dp.toPx() - stackIdx * (layout.size.height + 1.dp.toPx())
                        drawText(layout, topLeft = Offset(lx, ly))
                    }
                }
            }
        }
    }
}
