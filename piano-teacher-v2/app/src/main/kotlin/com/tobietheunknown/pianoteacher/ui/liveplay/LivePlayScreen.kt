package com.tobietheunknown.pianoteacher.ui.liveplay

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.app.Activity
import android.content.res.Configuration
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand
import com.tobietheunknown.pianoteacher.ui.theme.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.runtime.snapshots.SnapshotStateList
import kotlin.math.roundToInt

private data class HitEffect(val x: Float, val color: Color, val timestamp: Long)

private const val MIDI_LOW = 21    // A0
private const val MIDI_HIGH = 108  // C8
internal const val VISIBLE_BEATS = 5.0

@Composable
fun LivePlayScreen(
    songId: String,
    initialPhraseIndex: Int = -1,
    onBack: () -> Unit,
    vm: LivePlayViewModel = viewModel(
        factory = LivePlayViewModel.Factory(LocalContext.current, songId, initialPhraseIndex)
    )
) {
    val state by vm.state.collectAsState()
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    // Full immersive mode (always, portrait + landscape)
    val context = LocalContext.current
    val window = (context as? Activity)?.window
    DisposableEffect(Unit) {
        if (window != null) {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowInsetsControllerCompat(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            window.setFlags(
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
            )
        }
        onDispose {
            if (window != null) {
                WindowCompat.setDecorFitsSystemWindows(window, true)
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.show(WindowInsetsCompat.Type.systemBars())
                window.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
            }
        }
    }

    // State for landscape overlay
    var showOverlay by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var hideJob by remember { mutableStateOf<Job?>(null) }

    val tapModifier = if (isLandscape) {
        Modifier.pointerInput(Unit) {
            detectTapGestures {
                showOverlay = !showOverlay
                hideJob?.cancel()
                if (showOverlay) {
                    hideJob = scope.launch { delay(4000); showOverlay = false }
                }
            }
        }
    } else Modifier

    // Compute active autoplay pitches (notes currently sounding) with hand info
    val activeRightPitches = remember(state.visibleNotes) {
        state.visibleNotes.filter { it.isActive && it.isRightHand }.map { it.note.pitch }.toSet()
    }
    val activeLeftPitches = remember(state.visibleNotes) {
        state.visibleNotes.filter { it.isActive && !it.isRightHand }.map { it.note.pitch }.toSet()
    }

    @Composable
    fun controlsBlock() {
        LivePlayControls(
            isPlaying = state.isPlaying,
            isLooping = state.isLooping,
            isWaitMode = state.isWaitMode,
            audioEnabled = state.audioEnabled,
            metronomeSubdivision = state.metronomeSubdivision,
            isListenMode = state.isListenMode,
            playbackSpeed = state.playbackSpeed,
            currentBeat = state.currentBeat,
            totalBeats = state.totalBeats,
            loopStartBeat = state.loopStartBeat,
            loopEndBeat = state.loopEndBeat,
            beatsPerMeasure = state.song?.beatsPerMeasure ?: 4,
            selectedHand = state.selectedHand,
            onPlayPause = vm::togglePlayPause,
            onRestart = vm::restart,
            onSpeedChange = vm::setSpeed,
            onLoopToggle = vm::toggleLoop,
            onWaitModeToggle = vm::toggleWaitMode,
            onAudioToggle = vm::toggleAudio,
            onMetronomeToggle = vm::toggleMetronome,
            onListenModeToggle = vm::toggleListenMode,
            onSeek = vm::seekToBeat,
            onHandChange = vm::setHand,
            onLoopRangeChange = vm::setLoopRange
        )
    }

    // Hit effect tracking
    val hitEffects = remember { mutableStateListOf<HitEffect>() }
    val previouslyActive = remember { mutableSetOf<String>() }

    LaunchedEffect(state.visibleNotes) {
        val now = System.currentTimeMillis()
        for (noteWithHand in state.visibleNotes) {
            if (noteWithHand.isActive) {
                val key = noteWithHand.note.id
                if (key !in previouslyActive) {
                    previouslyActive.add(key)
                    val noteIndex = noteWithHand.note.pitch - state.minPitch
                    val noteRangeSize = state.maxPitch - state.minPitch + 1
                    val color = if (noteWithHand.isRightHand) CyanMelody else PinkChords
                    hitEffects.add(HitEffect(noteIndex.toFloat() / noteRangeSize, color, now))
                }
            }
        }
        previouslyActive.removeAll { key -> state.visibleNotes.none { it.note.id == key && it.isActive } }
        hitEffects.removeAll { now - it.timestamp > 400 }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
            .safeDrawingPadding()
    ) {
        if (!isLandscape) LivePlayTopBar(
            title = state.song?.title ?: "",
            phraseIndex = state.currentPhraseIndex,
            phraseCount = state.songPhraseCount,
            isWaiting = state.isWaiting,
            onBack = onBack,
            onPrev = vm::prevPhrase,
            onNext = vm::nextPhrase
        )

        Box(modifier = Modifier.fillMaxWidth().weight(1f).then(tapModifier)) {
            Column(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clipToBounds()
                ) {
                    LivePlayCanvas(
                        state = state,
                        hitEffects = hitEffects,
                        onVisibleBeatsChange = vm::setVisibleBeats
                    )

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
                    activeRightPitches = activeRightPitches,
                    activeLeftPitches = activeLeftPitches,
                    minPitch = state.minPitch,
                    maxPitch = state.maxPitch,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(80.dp)
                )
            }

            // Landscape overlay controls
            if (isLandscape && showOverlay) {
                androidx.compose.material3.Surface(
                    color = Color.Black.copy(alpha = 0.7f),
                    modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                ) {
                    controlsBlock()
                }
            }
        }

        // In portrait, show controls normally (not as overlay)
        if (!isLandscape) {
            controlsBlock()
        }
    }
}

@Composable
private fun LivePlayCanvas(
    state: LivePlayUiState,
    hitEffects: SnapshotStateList<HitEffect> = mutableStateListOf(),
    onVisibleBeatsChange: (Double) -> Unit = {}
) {
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

    val currentBeats by rememberUpdatedState(state.visibleBeats)
    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
            .graphicsLayer { }
            .pointerInput(Unit) {
                detectTransformGestures { _, _, zoom, _ ->
                    val newBeats = (currentBeats / zoom.toDouble()).coerceIn(3.0, 12.0)
                    onVisibleBeatsChange(newBeats)
                }
            }
    ) {
        val canvasWidth = size.width
        val canvasHeight = size.height
        val minPitch = state.minPitch
        val maxPitch = state.maxPitch
        val whiteKeyMidis = (minPitch..maxPitch).filter { midi -> midi % 12 !in listOf(1, 3, 6, 8, 10) }
        val whiteKeyCount = whiteKeyMidis.size.coerceAtLeast(1)
        val whiteKeyWidth = canvasWidth / whiteKeyCount
        val beatsPerPixel = canvasHeight / state.visibleBeats

        // Column lanes for each MIDI pitch using white-key-based layout
        for (pitch in minPitch..maxPitch) {
            val isBlack = pitch % 12 in listOf(1, 3, 6, 8, 10)
            val x: Float
            val laneWidth: Float
            if (!isBlack) {
                val whiteIndex = whiteKeyMidis.indexOf(pitch)
                x = whiteIndex * whiteKeyWidth
                laneWidth = whiteKeyWidth
            } else {
                val whitesBefore = (minPitch until pitch).count { it % 12 !in listOf(1, 3, 6, 8, 10) }
                x = whitesBefore * whiteKeyWidth - whiteKeyWidth * 0.3f
                laneWidth = whiteKeyWidth * 0.6f
            }
            // Background fill
            drawRect(
                color = if (isBlack) Color.White.copy(alpha = 0.012f) else Color.White.copy(alpha = 0.025f),
                topLeft = Offset(x, 0f),
                size = Size(laneWidth, canvasHeight)
            )
            // Separator line at left boundary (white keys only)
            if (!isBlack) {
                drawLine(
                    color = Color.White.copy(alpha = 0.04f),
                    start = Offset(x, 0f),
                    end = Offset(x, canvasHeight),
                    strokeWidth = 0.5f
                )
            }
        }

        // Measure and beat grid lines
        state.song?.let { song ->
            val bpm = song.beatsPerMeasure.toDouble()
            val firstBeat = (state.currentBeat - 1.0).toInt()
            val lastBeat = (state.currentBeat + state.visibleBeats + 1.0).toInt()

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

        // Falling notes (top = future, bottom = hit zone) — use white-key-based layout
        noteTextPaint.textSize = noteTextSizePx
        val visibleNotes = state.visibleNotes
        for (i in visibleNotes.indices) {
            val noteWithHand = visibleNotes[i]
            val note = noteWithHand.note
            val baseColor = if (noteWithHand.isRightHand) CyanMelody else PinkChords
            // Auto-play (backing track) notes are dimmer
            val color = if (noteWithHand.isAutoPlay) baseColor.copy(alpha = 0.35f) else baseColor

            val pitch = note.pitch
            if (pitch < minPitch || pitch > maxPitch) continue

            val isBlack = pitch % 12 in listOf(1, 3, 6, 8, 10)
            val x: Float
            val noteWidth: Float
            if (!isBlack) {
                val whiteIndex = whiteKeyMidis.indexOf(pitch)
                x = whiteIndex * whiteKeyWidth
                noteWidth = whiteKeyWidth
            } else {
                val whitesBefore = (minPitch until pitch).count { it % 12 !in listOf(1, 3, 6, 8, 10) }
                x = whitesBefore * whiteKeyWidth - whiteKeyWidth * 0.3f
                noteWidth = whiteKeyWidth * 0.6f
            }

            val noteBottom = canvasHeight - ((note.startTime - state.currentBeat) * beatsPerPixel).toFloat()
            val noteHeight = (note.duration * beatsPerPixel).toFloat().coerceAtLeast(4f)
            val noteTop = noteBottom - noteHeight

            if (noteTop > canvasHeight || noteBottom < 0) continue

            // Gradient: brighter at bottom (near hit line)
            val noteColor = if (noteWithHand.isActive) color else color.copy(alpha = 0.75f)
            drawRoundRect(
                brush = Brush.verticalGradient(
                    colors = listOf(noteColor.copy(alpha = noteColor.alpha * 0.6f), noteColor),
                    startY = noteTop,
                    endY = noteBottom
                ),
                topLeft = Offset(x + 1f, noteTop),
                size = Size(noteWidth - 2f, noteHeight),
                cornerRadius = CornerRadius(3f, 3f)
            )

            // French note name on falling notes (only if note is tall enough)
            if (noteBottom - noteTop > minNoteHeightForText) {
                val noteName = com.tobietheunknown.pianoteacher.utils.midiToFrench(noteWithHand.note.pitch, showOctave = false, useFlats = state.useFlats)
                drawContext.canvas.nativeCanvas.drawText(
                    noteName,
                    x + noteWidth / 2f,
                    noteTop + (noteBottom - noteTop) / 2f + textOffsetY,
                    noteTextPaint
                )
            }
        }

        // Hit line (indigo) at bottom — glow behind, then main line
        drawLine(
            color = IndigoAccent.copy(alpha = 0.15f),
            start = Offset(0f, canvasHeight),
            end = Offset(canvasWidth, canvasHeight),
            strokeWidth = 12f
        )
        drawLine(
            color = IndigoAccent.copy(alpha = 0.3f),
            start = Offset(0f, canvasHeight),
            end = Offset(canvasWidth, canvasHeight),
            strokeWidth = 8f
        )
        drawLine(
            color = IndigoAccent.copy(alpha = 0.8f),
            start = Offset(0f, canvasHeight),
            end = Offset(canvasWidth, canvasHeight),
            strokeWidth = 4f
        )

        // Hit effects
        val now = System.currentTimeMillis()
        for (effect in hitEffects) {
            val age = (now - effect.timestamp) / 400f
            if (age > 1f) continue
            val x = effect.x * canvasWidth
            val radius = 6f + age * 24f
            val alpha = (1f - age) * 0.5f
            drawCircle(
                color = effect.color.copy(alpha = alpha),
                radius = radius,
                center = Offset(x, canvasHeight)
            )
            // Horizontal glow
            drawLine(
                color = effect.color.copy(alpha = alpha * 0.3f),
                start = Offset(x - radius * 2, canvasHeight),
                end = Offset(x + radius * 2, canvasHeight),
                strokeWidth = 4f
            )
        }
    }
}

@Composable
private fun PianoKeyboard(
    pressedKeys: Set<Int>,
    expectedKeys: Set<Int>,
    wrongKeys: Set<Int>,
    activeRightPitches: Set<Int> = emptySet(),
    activeLeftPitches: Set<Int> = emptySet(),
    minPitch: Int = 21,
    maxPitch: Int = 108,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.background(Background)) {
        val keyHeight = size.height
        val whiteKeyMidis = (minPitch..maxPitch).filter { !isBlackKey(it) }
        val whiteKeyWidth = size.width / whiteKeyMidis.size.coerceAtLeast(1)

        // Pass 1: White keys
        whiteKeyMidis.forEachIndexed { whiteIndex, midi ->
            val x = whiteIndex * whiteKeyWidth
            val color = when {
                midi in wrongKeys -> Color(0xFFFF6B6B)
                midi in pressedKeys && midi in expectedKeys -> CyanMelody
                midi in pressedKeys -> CyanMelody.copy(alpha = 0.7f)
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.7f)
                midi in activeLeftPitches -> PinkChords.copy(alpha = 0.7f)
                midi in expectedKeys -> AmberWarning.copy(alpha = 0.6f)
                else -> Color(0xFFE8ECF0)
            }
            drawRoundRect(color, Offset(x + 0.5f, 0f), Size(whiteKeyWidth - 1f, keyHeight), CornerRadius(2f))
        }

        // Pass 2: Black keys (shorter, positioned between white keys)
        val blackHeight = keyHeight * 7f / 12f
        for (midi in minPitch..maxPitch) {
            if (!isBlackKey(midi)) continue
            val whitesBefore = (minPitch until midi).count { !isBlackKey(it) }
            val x = whitesBefore * whiteKeyWidth - whiteKeyWidth * 0.3f
            val bw = whiteKeyWidth * 0.6f

            val color = when {
                midi in wrongKeys -> Color(0xFFFF6B6B).copy(alpha = 0.9f)
                midi in pressedKeys && midi in expectedKeys -> CyanMelody.copy(alpha = 0.85f)
                midi in pressedKeys -> CyanMelody.copy(alpha = 0.6f)
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.7f)
                midi in activeLeftPitches -> PinkChords.copy(alpha = 0.7f)
                midi in expectedKeys -> AmberWarning.copy(alpha = 0.7f)
                else -> Color(0xFF1A1A1A)
            }
            drawRoundRect(color, Offset(x, 0f), Size(bw, blackHeight), CornerRadius(2f))
        }
    }
}

private fun isBlackKey(midi: Int): Boolean =
    when (midi % 12) { 1, 3, 6, 8, 10 -> true else -> false }

@Composable
private fun LivePlayTopBar(
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
private fun LivePlayControls(
    isPlaying: Boolean,
    isLooping: Boolean,
    isWaitMode: Boolean,
    audioEnabled: Boolean,
    metronomeSubdivision: Int,
    isListenMode: Boolean,
    playbackSpeed: Float,
    currentBeat: Double,
    totalBeats: Double,
    loopStartBeat: Double,
    loopEndBeat: Double,
    beatsPerMeasure: Int,
    selectedHand: PlaybackHand,
    onPlayPause: () -> Unit,
    onRestart: () -> Unit,
    onSpeedChange: (Float) -> Unit,
    onLoopToggle: () -> Unit,
    onWaitModeToggle: () -> Unit,
    onAudioToggle: () -> Unit,
    onMetronomeToggle: () -> Unit,
    onListenModeToggle: () -> Unit,
    onSeek: (Double) -> Unit,
    onHandChange: (PlaybackHand) -> Unit,
    onLoopRangeChange: (Double, Double) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
            .verticalScroll(rememberScrollState())
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

        // Loop range slider
        if (isLooping && totalBeats > 0) {
            RangeSlider(
                value = loopStartBeat.toFloat()..loopEndBeat.toFloat(),
                onValueChange = { range ->
                    onLoopRangeChange(range.start.toDouble(), range.endInclusive.toDouble())
                },
                valueRange = 0f..totalBeats.toFloat(),
                steps = ((totalBeats / beatsPerMeasure).toInt() - 1).coerceAtLeast(0),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
            )
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("m.${(loopStartBeat / beatsPerMeasure).toInt() + 1}", color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
                Text("m.${(loopEndBeat / beatsPerMeasure).toInt() + 1}", color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
            }
        }

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

            // Hand selector + listen mode
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                LivePlayHandButton("🔊", isListenMode, AmberWarning) { onListenModeToggle() }
                LivePlayHandButton("MG", !isListenMode && selectedHand == PlaybackHand.LEFT, PinkChords) { onHandChange(PlaybackHand.LEFT) }
                LivePlayHandButton("2", !isListenMode && selectedHand == PlaybackHand.BOTH, IndigoAccent) { onHandChange(PlaybackHand.BOTH) }
                LivePlayHandButton("MD", !isListenMode && selectedHand == PlaybackHand.RIGHT, CyanMelody) { onHandChange(PlaybackHand.RIGHT) }
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
                // Metronome toggle (cycles: off → quarter → eighth → off)
                IconButton(onClick = onMetronomeToggle) {
                    Text(
                        when (metronomeSubdivision) {
                            1 -> "\u2669"    // ♩ quarter notes
                            2 -> "\u266A\u266A" // ♪♪ eighth notes
                            else -> "\u2669"  // show quarter note symbol even when off
                        },
                        color = when (metronomeSubdivision) {
                            1 -> AmberWarning
                            2 -> Color(0xFFFFB300) // bright amber
                            else -> Color(0xFF475569) // gray when off
                        },
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
private fun LivePlayHandButton(label: String, selected: Boolean, activeColor: Color, onClick: () -> Unit) {
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
