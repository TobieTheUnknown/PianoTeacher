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
        border = BorderStroke(1.dp, Color(0x14FFFFFF)),
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
            color = if (active) Color.White else Color(0xFF64748B)
        )
    }
}

@Composable
private fun SpeedCluster(speed: Int, onSpeed: (Int) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(Icons.Default.Speed, null, tint = Color(0xFF64748B), modifier = Modifier.size(14.dp))
        Row {
            Text(
                "$speed",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                fontFamily = FontFamily.Monospace
            )
            Text(
                "%",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF64748B),
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
            .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(6.dp))
            .alpha(if (enabled) 1f else 0.3f)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8))
    }
}

@Composable
private fun TransportBtn(onClick: () -> Unit, icon: ImageVector) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(SurfaceVariant)
            .border(1.dp, Color(0x14FFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(20.dp))
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
            .border(1.dp, if (active) IndigoAccent else Color(0x14FFFFFF), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            null,
            tint = if (active) IndigoAccent else Color(0xFF64748B),
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
                Text("${range.first}", color = Color.White, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(" → ", color = Color(0xFF64748B), fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                Text("${range.last}", color = Color.White, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("Modifier", color = Color(0xFF64748B), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Icon(Icons.Default.KeyboardArrowDown, null, tint = Color(0xFF64748B), modifier = Modifier.size(11.dp))
            }
        }
    }
}

@Composable
private fun LoopRangeEditor(
    range: IntRange,
    totalMeasures: Int,
    onChange: (IntRange) -> Unit,
    onClose: () -> Unit,
) {
    val from = range.first
    val to = range.last

    Surface(
        color = Surface,
        border = BorderStroke(1.dp, Color(0x14FFFFFF)),
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
                Text("PLAGE DE BOUCLE", color = Color(0xFF94A3B8), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                IconButton(onClick = onClose, modifier = Modifier.size(22.dp)) {
                    Icon(Icons.Default.Close, null, tint = Color(0xFF64748B), modifier = Modifier.size(14.dp))
                }
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
                Text("→", color = Color(0xFF64748B))
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

@Composable
private fun RangeStepper(
    label: String,
    value: Int,
    min: Int,
    max: Int,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 10.sp, color = Color(0xFF64748B), fontWeight = FontWeight.SemiBold)
        Surface(
            color = SurfaceVariant,
            border = BorderStroke(1.dp, Color(0x14FFFFFF)),
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
                Text("$value", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = IndigoAccent)
                PixelBtn("+", enabled = value < max) { onChange(value + 1) }
            }
        }
    }
}
