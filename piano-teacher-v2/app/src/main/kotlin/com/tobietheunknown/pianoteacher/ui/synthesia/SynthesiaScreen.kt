package com.tobietheunknown.pianoteacher.ui.synthesia

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.NavigateBefore
import androidx.compose.material.icons.automirrored.filled.NavigateNext
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.ui.theme.*
import kotlin.math.roundToInt

private const val MIDI_LOW = 21    // A0
private const val MIDI_HIGH = 108  // C8
internal const val VISIBLE_BEATS = 8.0

@Composable
fun SynthesiaScreen(
    songId: String,
    initialPhraseIndex: Int = -1,
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
            .safeDrawingPadding()
    ) {
        SynthesiaTopBar(
            title = state.song?.title ?: "",
            phraseIndex = state.currentPhraseIndex,
            phraseCount = state.songPhraseCount,
            isWaiting = state.isWaiting,
            onBack = onBack,
            onPrev = vm::prevPhrase,
            onNext = vm::nextPhrase
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            SynthesiaCanvas(state = state)

            // Empty state overlay
            val totalNotes = state.song?.phrases
                ?.sumOf { it.tracks.melody.size + it.tracks.chords.size } ?: -1
            if (state.song != null && totalNotes == 0) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Aucune note trouvée", color = Color(0xFF64748B), fontSize = 14.sp)
                    Text("Vérifie que le fichier MIDI est valide", color = Color(0xFF475569), fontSize = 12.sp)
                }
            }

            // Wait mode indicator
            if (state.isWaiting) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(AmberWarning.copy(alpha = 0.15f))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text("En attente…", color = AmberWarning, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }

            SpeedBadge(speed = state.playbackSpeed, modifier = Modifier.align(Alignment.TopEnd))
        }

        PianoKeyboard(
            pressedKeys = state.pressedKeys,
            expectedKeys = state.expectedKeys,
            wrongKeys = state.wrongKeys,
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
        )

        SynthesiaControls(
            isPlaying = state.isPlaying,
            isLooping = state.isLooping,
            isWaitMode = state.isWaitMode,
            audioEnabled = state.audioEnabled,
            playbackSpeed = state.playbackSpeed,
            currentBeat = state.currentBeat,
            totalBeats = state.totalBeats,
            onPlayPause = vm::togglePlayPause,
            onRestart = vm::restart,
            onSpeedChange = vm::setSpeed,
            onLoopToggle = vm::toggleLoop,
            onWaitModeToggle = vm::toggleWaitMode,
            onAudioToggle = vm::toggleAudio,
            onSeek = vm::seekToBeat
        )
    }
}

@Composable
private fun SynthesiaCanvas(state: SynthesiaUiState) {
    Canvas(modifier = Modifier.fillMaxSize()) {
        val canvasWidth = size.width
        val canvasHeight = size.height
        val noteRangeSize = MIDI_HIGH - MIDI_LOW + 1
        val noteWidth = canvasWidth / noteRangeSize
        val beatsPerPixel = canvasHeight / VISIBLE_BEATS

        // Measure grid lines
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

        // Falling notes (top = future, bottom = hit zone)
        state.visibleNotes.forEach { noteWithHand ->
            val note = noteWithHand.note
            val color = if (noteWithHand.isRightHand) CyanMelody else PinkChords

            val noteIndex = note.pitch - MIDI_LOW
            if (noteIndex < 0 || noteIndex >= noteRangeSize) return@forEach

            val x = noteIndex * noteWidth
            val noteBottom = canvasHeight - ((note.startTime - state.currentBeat) * beatsPerPixel).toFloat()
            val noteHeight = (note.duration * beatsPerPixel).toFloat().coerceAtLeast(4f)
            val noteTop = noteBottom - noteHeight

            if (noteTop > canvasHeight || noteBottom < 0) return@forEach

            drawRoundRect(
                color = if (noteWithHand.isActive) color else color.copy(alpha = 0.75f),
                topLeft = Offset(x + 1f, noteTop),
                size = Size(noteWidth - 2f, noteHeight),
                cornerRadius = CornerRadius(3f, 3f)
            )
        }

        // Hit line (indigo) at bottom
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
    wrongKeys: Set<Int>,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.background(Color(0xFF0D0F14))) {
        val noteCount = MIDI_HIGH - MIDI_LOW + 1
        val keyWidth = size.width / noteCount
        val keyHeight = size.height

        // White keys first
        for (i in 0 until noteCount) {
            val midi = MIDI_LOW + i
            if (isBlackKey(midi)) continue

            val x = i * keyWidth
            val isPressed = midi in pressedKeys
            val isExpected = midi in expectedKeys
            val isWrong = midi in wrongKeys

            val color = when {
                isWrong -> Color(0xFFFF6B6B)
                isPressed && isExpected -> CyanMelody
                isPressed -> CyanMelody.copy(alpha = 0.7f)
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

        // Black keys on top
        for (i in 0 until noteCount) {
            val midi = MIDI_LOW + i
            if (!isBlackKey(midi)) continue

            val x = i * keyWidth - keyWidth * 0.3f
            val blackWidth = keyWidth * 0.6f
            val blackHeight = keyHeight * 0.62f

            val isPressed = midi in pressedKeys
            val isExpected = midi in expectedKeys
            val isWrong = midi in wrongKeys

            val color = when {
                isWrong -> Color(0xFFFF6B6B).copy(alpha = 0.9f)
                isPressed && isExpected -> CyanMelody.copy(alpha = 0.85f)
                isPressed -> CyanMelody.copy(alpha = 0.6f)
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

private fun isBlackKey(midi: Int): Boolean =
    when (midi % 12) { 1, 3, 6, 8, 10 -> true else -> false }

@Composable
private fun SynthesiaTopBar(
    title: String,
    phraseIndex: Int,
    phraseCount: Int,
    isWaiting: Boolean,
    onBack: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
            .padding(horizontal = 4.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp, maxLines = 1)
            if (phraseIndex >= 0 && phraseCount > 0) {
                Text(
                    "Phrase ${phraseIndex + 1} / $phraseCount",
                    fontSize = 11.sp,
                    color = if (isWaiting) AmberWarning else CyanMelody
                )
            } else if (phraseIndex < 0) {
                Text("Morceau entier", fontSize = 11.sp, color = Color(0xFF64748B))
            }
        }

        // Phrase navigation (only in phrase-by-phrase mode)
        if (phraseIndex >= 0 && phraseCount > 1) {
            IconButton(onClick = onPrev, enabled = phraseIndex > 0) {
                Icon(
                    Icons.AutoMirrored.Filled.NavigateBefore,
                    "Phrase précédente",
                    tint = if (phraseIndex > 0) Color.White else Color(0xFF334155)
                )
            }
            IconButton(onClick = onNext, enabled = phraseIndex < phraseCount - 1) {
                Icon(
                    Icons.AutoMirrored.Filled.NavigateNext,
                    "Phrase suivante",
                    tint = if (phraseIndex < phraseCount - 1) Color.White else Color(0xFF334155)
                )
            }
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
    isWaitMode: Boolean,
    audioEnabled: Boolean,
    playbackSpeed: Float,
    currentBeat: Double,
    totalBeats: Double,
    onPlayPause: () -> Unit,
    onRestart: () -> Unit,
    onSpeedChange: (Float) -> Unit,
    onLoopToggle: () -> Unit,
    onWaitModeToggle: () -> Unit,
    onAudioToggle: () -> Unit,
    onSeek: (Double) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
            .padding(horizontal = 12.dp, vertical = 4.dp)
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
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onRestart) {
                    Icon(Icons.Default.SkipPrevious, "Début", tint = Color(0xFF94A3B8))
                }
                FloatingActionButton(
                    onClick = onPlayPause,
                    modifier = Modifier.size(44.dp),
                    containerColor = IndigoAccent,
                    contentColor = Color.White
                ) {
                    Icon(
                        if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        if (isPlaying) "Pause" else "Play"
                    )
                }
            }

            // Center: speed
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                IconButton(
                    onClick = { onSpeedChange((playbackSpeed - 0.1f).coerceIn(0.25f, 2.0f)) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Text("-", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
                Text(
                    "${(playbackSpeed * 100).roundToInt()}%",
                    color = if (playbackSpeed == 1.0f) Color(0xFF64748B) else AmberWarning,
                    fontSize = 12.sp,
                    modifier = Modifier.widthIn(min = 36.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                IconButton(
                    onClick = { onSpeedChange((playbackSpeed + 0.1f).coerceIn(0.25f, 2.0f)) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Text("+", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            // Right: toggles
            Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                // Wait mode toggle
                IconButton(onClick = onWaitModeToggle) {
                    Icon(
                        Icons.Default.TouchApp,
                        "Mode attente",
                        tint = if (isWaitMode) AmberWarning else Color(0xFF475569),
                        modifier = Modifier.size(20.dp)
                    )
                }
                // Loop toggle
                IconButton(onClick = onLoopToggle) {
                    Icon(
                        Icons.Default.Repeat,
                        "Boucle",
                        tint = if (isLooping) CyanMelody else Color(0xFF475569),
                        modifier = Modifier.size(20.dp)
                    )
                }
                // Audio toggle
                IconButton(onClick = onAudioToggle) {
                    Icon(
                        if (audioEnabled) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
                        "Audio",
                        tint = if (audioEnabled) Color(0xFF94A3B8) else Color(0xFF475569),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
