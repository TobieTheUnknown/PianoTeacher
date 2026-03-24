package com.tobietheunknown.pianoteacher.ui.synthesia

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand
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
                .clipToBounds()
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
            minPitch = state.minPitch,
            maxPitch = state.maxPitch,
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
        )

        SynthesiaControls(
            isPlaying = state.isPlaying,
            isLooping = state.isLooping,
            isWaitMode = state.isWaitMode,
            audioEnabled = state.audioEnabled,
            metronomeEnabled = state.metronomeEnabled,
            playbackSpeed = state.playbackSpeed,
            currentBeat = state.currentBeat,
            totalBeats = state.totalBeats,
            selectedHand = state.selectedHand,
            onPlayPause = vm::togglePlayPause,
            onRestart = vm::restart,
            onSpeedChange = vm::setSpeed,
            onLoopToggle = vm::toggleLoop,
            onWaitModeToggle = vm::toggleWaitMode,
            onAudioToggle = vm::toggleAudio,
            onMetronomeToggle = vm::toggleMetronome,
            onSeek = vm::seekToBeat,
            onHandChange = vm::setHand
        )
    }
}

@Composable
private fun SynthesiaCanvas(state: SynthesiaUiState) {
    // Pre-allocate Paint object outside the draw loop to avoid per-frame allocation
    val noteTextPaint = remember {
        android.graphics.Paint().apply {
            color = android.graphics.Color.WHITE
            textSize = 28f // will be overridden with sp below
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }
    }
    val measureTextPaint = remember {
        android.graphics.Paint().apply {
            color = android.graphics.Color.argb(100, 255, 255, 255)
            textSize = 24f
            textAlign = android.graphics.Paint.Align.LEFT
            isAntiAlias = true
        }
    }
    val density = androidx.compose.ui.platform.LocalDensity.current
    val noteTextSizePx = with(density) { 10.sp.toPx() }
    val measureTextSizePx = with(density) { 9.sp.toPx() }
    val minNoteHeightForText = with(density) { 16.dp.toPx() }
    val textOffsetY = with(density) { 4.dp.toPx() }
    val thickStroke = with(density) { 2.dp.toPx() }

    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .graphicsLayer { }
    ) {
        val canvasWidth = size.width
        val canvasHeight = size.height
        val minPitch = state.minPitch
        val maxPitch = state.maxPitch
        val noteRangeSize = maxPitch - minPitch + 1
        val noteWidth = canvasWidth / noteRangeSize
        val beatsPerPixel = canvasHeight / VISIBLE_BEATS

        // Measure and beat grid lines
        state.song?.let { song ->
            val bpm = song.beatsPerMeasure.toDouble()
            val firstBeat = (state.currentBeat - 1.0).toInt()
            val lastBeat = (state.currentBeat + VISIBLE_BEATS + 1.0).toInt()

            for (beatIndex in firstBeat..lastBeat) {
                val beatValue = beatIndex.toDouble()
                val y = canvasHeight - ((beatValue - state.currentBeat) * beatsPerPixel).toFloat()
                if (y in 0f..canvasHeight) {
                    val isMeasureBoundary = beatIndex >= 0 && beatIndex % song.beatsPerMeasure == 0
                    if (isMeasureBoundary) {
                        // Measure boundary: thicker line, higher alpha
                        drawLine(
                            color = Color.White.copy(alpha = 0.15f),
                            start = Offset(0f, y),
                            end = Offset(canvasWidth, y),
                            strokeWidth = thickStroke
                        )
                        // Draw measure number on the left
                        val measureNum = beatIndex / song.beatsPerMeasure + 1
                        measureTextPaint.textSize = measureTextSizePx
                        drawContext.canvas.nativeCanvas.drawText(
                            "$measureNum",
                            4f,
                            y - 4f,
                            measureTextPaint
                        )
                    } else {
                        // Regular beat line
                        drawLine(
                            color = Color.White.copy(alpha = 0.05f),
                            start = Offset(0f, y),
                            end = Offset(canvasWidth, y),
                            strokeWidth = 1f
                        )
                    }
                }
            }
        }

        // Falling notes (top = future, bottom = hit zone)
        noteTextPaint.textSize = noteTextSizePx
        state.visibleNotes.forEach { noteWithHand ->
            val note = noteWithHand.note
            val baseColor = if (noteWithHand.isRightHand) CyanMelody else PinkChords
            // Auto-play (backing track) notes are dimmer
            val color = if (noteWithHand.isAutoPlay) baseColor.copy(alpha = 0.35f) else baseColor

            val noteIndex = note.pitch - minPitch
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

            // French note name on falling notes (only if note is tall enough)
            if (noteBottom - noteTop > minNoteHeightForText) {
                val noteName = com.tobietheunknown.pianoteacher.utils.midiToFrench(noteWithHand.note.pitch, showOctave = false)
                drawContext.canvas.nativeCanvas.drawText(
                    noteName,
                    x + noteWidth / 2f,
                    noteTop + (noteBottom - noteTop) / 2f + textOffsetY,
                    noteTextPaint
                )
            }
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
    minPitch: Int = 21,
    maxPitch: Int = 108,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.background(Color(0xFF0D0F14))) {
        val noteCount = maxPitch - minPitch + 1
        val keyWidth = size.width / noteCount
        val keyHeight = size.height

        // White keys first
        for (i in 0 until noteCount) {
            val midi = minPitch + i
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
            val midi = minPitch + i
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
    metronomeEnabled: Boolean,
    playbackSpeed: Float,
    currentBeat: Double,
    totalBeats: Double,
    selectedHand: PlaybackHand,
    onPlayPause: () -> Unit,
    onRestart: () -> Unit,
    onSpeedChange: (Float) -> Unit,
    onLoopToggle: () -> Unit,
    onWaitModeToggle: () -> Unit,
    onAudioToggle: () -> Unit,
    onMetronomeToggle: () -> Unit,
    onSeek: (Double) -> Unit,
    onHandChange: (PlaybackHand) -> Unit
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

            // Hand selector
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                SynthesiaHandButton("MG", selectedHand == PlaybackHand.LEFT, PinkChords) { onHandChange(PlaybackHand.LEFT) }
                SynthesiaHandButton("2", selectedHand == PlaybackHand.BOTH, IndigoAccent) { onHandChange(PlaybackHand.BOTH) }
                SynthesiaHandButton("MD", selectedHand == PlaybackHand.RIGHT, CyanMelody) { onHandChange(PlaybackHand.RIGHT) }
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
                // Metronome toggle
                IconButton(onClick = onMetronomeToggle) {
                    Text(
                        "\u2669",
                        color = if (metronomeEnabled) AmberWarning else Color(0xFF475569),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
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

@Composable
private fun SynthesiaHandButton(label: String, selected: Boolean, activeColor: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (selected) activeColor.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.06f))
            .then(
                if (selected) Modifier.border(1.dp, activeColor, RoundedCornerShape(6.dp))
                else Modifier
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 5.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            label,
            fontSize = 11.sp,
            color = if (selected) activeColor else Color(0xFF64748B),
            fontWeight = FontWeight.Bold
        )
    }
}
