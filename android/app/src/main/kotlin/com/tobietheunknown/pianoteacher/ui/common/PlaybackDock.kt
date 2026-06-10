package com.tobietheunknown.pianoteacher.ui.common

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.NavigateBefore
import androidx.compose.material.icons.automirrored.filled.NavigateNext
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.theme.*

enum class HandMode { LEFT, BOTH, RIGHT, LISTEN }

/** Phrase reference used by the loop editor's quick-pick dropdown. */
data class PhraseRange(val name: String, val startMeasure: Int, val endMeasure: Int)

/**
 * PlaybackDock — shared playback control bar across all music pages in
 * the APK. Mirrors the web's PlaybackDock exactly.
 */
@Composable
fun PlaybackDock(
    playing: Boolean,
    onPlayPause: () -> Unit,
    speed: Int = 100,
    onSpeed: (Int) -> Unit = {},
    handMode: HandMode = HandMode.BOTH,
    onHandMode: (HandMode) -> Unit = {},
    metronome: Boolean = false,
    onMetronome: () -> Unit = {},
    loop: Boolean = false,
    onLoop: () -> Unit = {},
    loopRange: IntRange = 1..1,
    onLoopRangeChange: (IntRange) -> Unit = {},
    loopEditorOpen: Boolean = false,
    onToggleLoopEditor: () -> Unit = {},
    totalMeasures: Int = 1,
    phrases: List<PhraseRange> = emptyList(),
    onPrev: () -> Unit = {},
    onNext: () -> Unit = {},
) {
    Surface(color = Surface) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (loopEditorOpen) {
                LoopRangeEditor(
                    range = loopRange,
                    totalMeasures = totalMeasures,
                    phrases = phrases,
                    onChange = onLoopRangeChange,
                    onClose = onToggleLoopEditor,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                HandPill(handMode = handMode, onHandMode = onHandMode)
                SpeedCluster(speed = speed, onSpeed = onSpeed)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                ToggleIconBtn(active = metronome, onClick = onMetronome, icon = Icons.Default.Timer)

                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TransportBtn(onClick = onPrev, icon = Icons.AutoMirrored.Filled.NavigateBefore)
                    PlayPauseButton(playing = playing, onClick = onPlayPause)
                    TransportBtn(onClick = onNext, icon = Icons.AutoMirrored.Filled.NavigateNext)
                }

                ToggleIconBtn(active = loop, onClick = onLoop, icon = Icons.Default.Refresh)
            }

            if (loop) {
                LoopActiveStrip(range = loopRange, onClick = onToggleLoopEditor)
            }
        }
    }
}

@Composable
private fun HandPill(handMode: HandMode, onHandMode: (HandMode) -> Unit) {
    Surface(
        color = SurfaceVariant,
        border = BorderStroke(1.dp, BorderColor),
        shape = RoundedCornerShape(50)
    ) {
        Row(
            modifier = Modifier.padding(2.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            HandSegment("G", handMode == HandMode.LEFT, PinkChords) { onHandMode(HandMode.LEFT) }
            HandSegment(
                if (handMode == HandMode.LISTEN) "🔊" else "2",
                handMode == HandMode.BOTH || handMode == HandMode.LISTEN,
                IndigoAccent,
            ) { onHandMode(if (handMode == HandMode.LISTEN) HandMode.BOTH else HandMode.LISTEN) }
            HandSegment("D", handMode == HandMode.RIGHT, CyanMelody) { onHandMode(HandMode.RIGHT) }
        }
    }
}

@Composable
private fun HandSegment(label: String, active: Boolean, activeColor: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(width = 30.dp, height = 24.dp)
            .clip(CircleShape)
            .background(if (active) activeColor else Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            color = if (active) TextPrimary else TextTertiary
        )
    }
}

@Composable
private fun SpeedCluster(speed: Int, onSpeed: (Int) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(Icons.Default.Speed, null, tint = TextTertiary, modifier = Modifier.size(14.dp))
        Row {
            Text(
                "$speed",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                fontFamily = FontFamily.Monospace
            )
            Text(
                "%",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = TextTertiary,
                fontFamily = FontFamily.Monospace
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            PixelBtn("−", enabled = speed > 20) { onSpeed((speed - 10).coerceAtLeast(20)) }
            PixelBtn("+", enabled = speed < 150) { onSpeed((speed + 10).coerceAtMost(150)) }
        }
    }
}

@Composable
private fun PixelBtn(label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(SurfaceVariant)
            .border(1.dp, BorderColor, RoundedCornerShape(6.dp))
            .alpha(if (enabled) 1f else 0.3f)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
    }
}

@Composable
private fun TransportBtn(onClick: () -> Unit, icon: ImageVector) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(SurfaceVariant)
            .border(1.dp, BorderColor, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = TextSecondary, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun PlayPauseButton(playing: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(CircleShape)
            .background(IndigoAccent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            if (playing) Icons.Default.Pause else Icons.Default.PlayArrow,
            null,
            tint = Color.White,
            modifier = Modifier.size(24.dp)
        )
    }
}

@Composable
private fun ToggleIconBtn(active: Boolean, onClick: () -> Unit, icon: ImageVector) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(if (active) IndigoAccent.copy(alpha = 0.16f) else SurfaceVariant)
            .border(1.dp, if (active) IndigoAccent else BorderColor, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            null,
            tint = if (active) IndigoAccent else TextTertiary,
            modifier = Modifier.size(18.dp)
        )
    }
}

@Composable
private fun LoopActiveStrip(range: IntRange, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(IndigoAccent.copy(alpha = 0.12f))
            .border(1.dp, IndigoAccent, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Default.Refresh, null, tint = IndigoAccent, modifier = Modifier.size(12.dp))
                Text("BOUCLE ACTIVE", color = IndigoAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${range.first}", color = TextPrimary, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(" → ", color = TextTertiary, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                Text("${range.last}", color = TextPrimary, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("Modifier", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Icon(Icons.Default.KeyboardArrowDown, null, tint = TextTertiary, modifier = Modifier.size(11.dp))
            }
        }
    }
}

@Composable
private fun LoopRangeEditor(
    range: IntRange,
    totalMeasures: Int,
    phrases: List<PhraseRange>,
    onChange: (IntRange) -> Unit,
    onClose: () -> Unit,
) {
    val from = range.first
    val to = range.last

    Surface(
        color = Surface,
        border = BorderStroke(1.dp, BorderColor),
        shape = RoundedCornerShape(10.dp),
        shadowElevation = 12.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("PLAGE DE BOUCLE", color = TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                IconButton(onClick = onClose, modifier = Modifier.size(22.dp)) {
                    Icon(Icons.Default.Close, null, tint = TextTertiary, modifier = Modifier.size(14.dp))
                }
            }
            if (phrases.isNotEmpty()) {
                PhrasePicker(phrases = phrases, currentRange = from..to, onPick = onChange)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RangeStepper(
                    label = "De",
                    value = from,
                    min = 1,
                    max = to - 1,
                    onChange = { v -> onChange(v..to) },
                    modifier = Modifier.weight(1f),
                )
                Text("→", color = TextTertiary)
                RangeStepper(
                    label = "À",
                    value = to,
                    min = from + 1,
                    max = totalMeasures,
                    onChange = { v -> onChange(from..v) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PhrasePicker(
    phrases: List<PhraseRange>,
    currentRange: IntRange,
    onPick: (IntRange) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val matchIdx = phrases.indexOfFirst {
        it.startMeasure == currentRange.first && it.endMeasure == currentRange.last
    }
    val display = if (matchIdx >= 0) {
        val p = phrases[matchIdx]
        "${p.name} (m. ${p.startMeasure}–${p.endMeasure})"
    } else {
        "Sélectionner une phrase…"
    }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Phrase", fontSize = 10.sp, color = TextTertiary, fontWeight = FontWeight.SemiBold)
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded },
        ) {
            Surface(
                color = SurfaceVariant,
                border = BorderStroke(1.dp, BorderColor),
                shape = RoundedCornerShape(6.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        display,
                        color = if (matchIdx >= 0) IndigoAccent else TextSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Icon(
                        Icons.Default.KeyboardArrowDown, null,
                        tint = TextSecondary,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
            ) {
                phrases.forEachIndexed { i, p ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                "${p.name} (m. ${p.startMeasure}–${p.endMeasure})",
                                fontSize = 13.sp,
                            )
                        },
                        onClick = {
                            onPick(p.startMeasure..p.endMeasure)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun RangeStepper(
    label: String,
    value: Int,
    min: Int,
    max: Int,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    // Tap the number → switch to inline TextField for direct entry.
    var editing by remember { mutableStateOf(false) }
    var draft by remember(value, editing) { mutableStateOf(value.toString()) }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 10.sp, color = TextTertiary, fontWeight = FontWeight.SemiBold)
        Surface(
            color = SurfaceVariant,
            border = BorderStroke(1.dp, BorderColor),
            shape = RoundedCornerShape(6.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                PixelBtn("−", enabled = value > min) { onChange(value - 1) }
                if (editing) {
                    androidx.compose.foundation.text.BasicTextField(
                        value = draft,
                        onValueChange = { s -> draft = s.filter { it.isDigit() }.take(4) },
                        textStyle = androidx.compose.ui.text.TextStyle(
                            color = IndigoAccent,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        ),
                        singleLine = true,
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(IndigoAccent),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                            imeAction = androidx.compose.ui.text.input.ImeAction.Done,
                        ),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                            onDone = {
                                val v = draft.toIntOrNull()
                                if (v != null) onChange(v.coerceIn(min, max))
                                editing = false
                            },
                        ),
                        modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                    )
                } else {
                    Text(
                        "$value",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = IndigoAccent,
                        modifier = Modifier
                            .clickable { editing = true }
                            .padding(horizontal = 12.dp),
                    )
                }
                PixelBtn("+", enabled = value < max) { onChange(value + 1) }
            }
        }
    }
}
