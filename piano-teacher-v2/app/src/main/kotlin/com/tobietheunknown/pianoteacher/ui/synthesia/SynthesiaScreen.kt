package com.tobietheunknown.pianoteacher.ui.synthesia

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.ui.theme.*
import kotlin.math.roundToInt

private const val MIDI_LOW = 21    // A0
private const val MIDI_HIGH = 108  // C8
internal const val VISIBLE_BEATS = 8.0  // How many beats visible on screen

@Composable
fun SynthesiaScreen(
    songId: String,
    initialPhraseIndex: Int = 0,
    onBack: () -> Unit,
    vm: SynthesiaViewModel = viewModel(
        factory = SynthesiaViewModel.Factory(LocalContext.current, songId, initialPhraseIndex)
    )
) {
    val state by vm.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
    ) {
        // Top bar
        SynthesiaTopBar(
            title = state.song?.title ?: "",
            phraseLabel = state.currentPhrase?.name ?: "",
            onBack = onBack,
            onSettings = { /* TODO */ }
        )

        // Main Synthesia canvas (takes most space)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            SynthesiaCanvas(
                state = state,
                onTap = { x, y -> vm.onCanvasTap(x, y) }
            )

            // Playback speed badge
            SpeedBadge(speed = state.playbackSpeed, modifier = Modifier.align(Alignment.TopEnd))
        }

        // Piano keyboard
        PianoKeyboard(
            pressedKeys = state.pressedKeys,
            expectedKeys = state.expectedKeys,
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
        )

        // Controls
        SynthesiaControls(
            isPlaying = state.isPlaying,
            isLooping = state.isLooping,
            playbackSpeed = state.playbackSpeed,
            currentBeat = state.currentBeat,
            totalBeats = state.totalBeats,
            onPlayPause = vm::togglePlayPause,
            onRestart = vm::restart,
            onSpeedChange = vm::setSpeed,
            onLoopToggle = vm::toggleLoop,
            onSeek = vm::seekToBeat
        )
    }
}

@Composable
private fun SynthesiaCanvas(
    state: SynthesiaUiState,
    onTap: (Float, Float) -> Unit
) {
    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures { offset -> onTap(offset.x, offset.y) }
            }
    ) {
        val canvasWidth = size.width
        val canvasHeight = size.height
        val noteRangeSize = MIDI_HIGH - MIDI_LOW + 1
        val noteWidth = canvasWidth / noteRangeSize
        val beatsPerPixel = canvasHeight / VISIBLE_BEATS

        // Background grid lines (measures) — notes fall DOWN, future = top, past = bottom
        state.song?.let { song ->
            val bpm = song.beatsPerMeasure.toDouble()
            val firstMeasure = (state.currentBeat / bpm).toInt() - 1
            val lastMeasure = ((state.currentBeat + VISIBLE_BEATS) / bpm).toInt() + 1

            for (measure in firstMeasure..lastMeasure) {
                val measureBeat = measure.toDouble() * bpm
                val y = canvasHeight - ((measureBeat - state.currentBeat) * beatsPerPixel).toFloat()
                if (y in 0f..canvasHeight) {
                    drawLine(
                        color = Color.White.copy(alpha = 0.07f),
                        start = Offset(0f, y),
                        end = Offset(canvasWidth, y),
                        strokeWidth = 1f
                    )
                }
            }
        }

        // Draw falling notes (top = future, bottom = hit zone)
        state.visibleNotes.forEach { noteWithHand ->
            val note = noteWithHand.note
            val color = if (noteWithHand.isRightHand) CyanMelody else PinkChords

            val noteIndex = note.pitch - MIDI_LOW
            if (noteIndex < 0 || noteIndex >= noteRangeSize) return@forEach

            val x = noteIndex * noteWidth
            // Bottom of note = when it should be played (at canvasHeight = hit zone)
            val noteBottom = canvasHeight - ((note.startTime - state.currentBeat) * beatsPerPixel).toFloat()
            val noteHeight = (note.duration * beatsPerPixel).toFloat().coerceAtLeast(4f)
            val noteTop = noteBottom - noteHeight

            // Only draw if any part is on screen
            if (noteTop > canvasHeight || noteBottom < 0) return@forEach

            drawRoundRect(
                color = if (noteWithHand.isActive) color else color.copy(alpha = 0.75f),
                topLeft = Offset(x + 1f, noteTop),
                size = Size(noteWidth - 2f, noteHeight),
                cornerRadius = CornerRadius(3f, 3f)
            )
        }

        // Hit line at the bottom — piano keyboard is just below
        drawLine(
            color = IndigoAccent.copy(alpha = 0.6f),
            start = Offset(0f, canvasHeight),
            end = Offset(canvasWidth, canvasHeight),
            strokeWidth = 3f
        )
    }
}

@Composable
private fun PianoKeyboard(
    pressedKeys: Set<Int>,
    expectedKeys: Set<Int>,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.background(Color(0xFF0D0F14))) {
        val noteCount = MIDI_HIGH - MIDI_LOW + 1
        val keyWidth = size.width / noteCount
        val keyHeight = size.height

        for (i in 0 until noteCount) {
            val midi = MIDI_LOW + i
            val isBlack = isBlackKey(midi)
            if (isBlack) continue  // Draw white first

            val x = i * keyWidth
            val isPressed = midi in pressedKeys
            val isExpected = midi in expectedKeys

            val color = when {
                isPressed -> CyanMelody
                isExpected -> AmberWarning.copy(alpha = 0.6f)
                else -> Color(0xFFE8ECF0)
            }

            drawRoundRect(
                color = color,
                topLeft = Offset(x + 0.5f, 0f),
                size = Size(keyWidth - 1f, keyHeight),
                cornerRadius = CornerRadius(2f, 2f)
            )
        }

        // Draw black keys on top
        for (i in 0 until noteCount) {
            val midi = MIDI_LOW + i
            if (!isBlackKey(midi)) continue

            val x = i * keyWidth - keyWidth * 0.3f
            val blackWidth = keyWidth * 0.6f
            val blackHeight = keyHeight * 0.62f

            val isPressed = midi in pressedKeys
            val isExpected = midi in expectedKeys

            val color = when {
                isPressed -> CyanMelody.copy(alpha = 0.85f)
                isExpected -> AmberWarning.copy(alpha = 0.7f)
                else -> Color(0xFF1A1A1A)
            }

            drawRoundRect(
                color = color,
                topLeft = Offset(x, 0f),
                size = Size(blackWidth, blackHeight),
                cornerRadius = CornerRadius(2f, 2f)
            )
        }
    }
}

private fun isBlackKey(midi: Int): Boolean {
    return when (midi % 12) { 1, 3, 6, 8, 10 -> true else -> false }
}

@Composable
private fun SynthesiaTopBar(
    title: String,
    phraseLabel: String,
    onBack: () -> Unit,
    onSettings: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, "Retour", tint = Color.White)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp)
            if (phraseLabel.isNotBlank()) {
                Text(phraseLabel, fontSize = 12.sp, color = CyanMelody)
            }
        }
        IconButton(onClick = onSettings) {
            Icon(Icons.Default.Tune, "Réglages", tint = Color(0xFF94A3B8))
        }
    }
}

@Composable
private fun SpeedBadge(speed: Float, modifier: Modifier = Modifier) {
    if (speed == 1.0f) return
    Box(
        modifier = modifier
            .padding(8.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(AmberWarning.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            "${(speed * 100).roundToInt()}%",
            color = AmberWarning,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun SynthesiaControls(
    isPlaying: Boolean,
    isLooping: Boolean,
    playbackSpeed: Float,
    currentBeat: Double,
    totalBeats: Double,
    onPlayPause: () -> Unit,
    onRestart: () -> Unit,
    onSpeedChange: (Float) -> Unit,
    onLoopToggle: () -> Unit,
    onSeek: (Double) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
            .padding(12.dp)
    ) {
        // Timeline scrubber
        Slider(
            value = if (totalBeats > 0) (currentBeat / totalBeats).toFloat() else 0f,
            onValueChange = { onSeek(it * totalBeats) },
            colors = SliderDefaults.colors(
                thumbColor = IndigoAccent,
                activeTrackColor = IndigoAccent,
                inactiveTrackColor = SurfaceVariant
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: restart + play
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconButton(onClick = onRestart) {
                    Icon(Icons.Default.SkipPrevious, "Début", tint = Color(0xFF94A3B8))
                }
                FloatingActionButton(
                    onClick = onPlayPause,
                    modifier = Modifier.size(48.dp),
                    containerColor = IndigoAccent,
                    contentColor = Color.White
                ) {
                    Icon(
                        if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        if (isPlaying) "Pause" else "Play"
                    )
                }
            }

            // Speed control
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                IconButton(
                    onClick = { onSpeedChange((playbackSpeed - 0.1f).coerceIn(0.25f, 2.0f)) }
                ) {
                    Text("-", color = Color.White, fontWeight = FontWeight.Bold)
                }
                Text(
                    "${(playbackSpeed * 100).roundToInt()}%",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp
                )
                IconButton(
                    onClick = { onSpeedChange((playbackSpeed + 0.1f).coerceIn(0.25f, 2.0f)) }
                ) {
                    Text("+", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }

            // Loop toggle
            IconButton(onClick = onLoopToggle) {
                Icon(
                    Icons.Default.Repeat,
                    "Loop",
                    tint = if (isLooping) CyanMelody else Color(0xFF475569)
                )
            }
        }
    }
}
