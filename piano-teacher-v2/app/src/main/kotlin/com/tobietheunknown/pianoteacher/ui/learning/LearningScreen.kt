package com.tobietheunknown.pianoteacher.ui.learning

import android.app.Activity
import android.content.res.Configuration
import android.view.WindowManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand
import com.tobietheunknown.pianoteacher.ui.theme.*
import com.tobietheunknown.pianoteacher.utils.ArpeggioMotifResult
import com.tobietheunknown.pianoteacher.utils.KeySignature as MusicKeySignature
import com.tobietheunknown.pianoteacher.utils.ChordWithReps
import com.tobietheunknown.pianoteacher.utils.firstArpeggioCycle
import com.tobietheunknown.pianoteacher.utils.midiToFrench
import kotlin.math.abs

// ─── Diatonic pitch helpers ───────────────────────────────────────────────────

private val CHROMATIC_TO_DIATONIC_SHARP = intArrayOf(0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6)
private val CHROMATIC_TO_DIATONIC_FLAT  = intArrayOf(0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6)

private fun midiToDiatonic(pitch: Int, useFlats: Boolean = false): Int {
    val octave = pitch / 12
    val chroma = pitch % 12
    val step = if (useFlats) CHROMATIC_TO_DIATONIC_FLAT[chroma] else CHROMATIC_TO_DIATONIC_SHARP[chroma]
    return octave * 7 + step
}

private fun isBlackKey(midi: Int): Boolean =
    when (midi % 12) { 1, 3, 6, 8, 10 -> true else -> false }

// ─── Staff clef configuration ────────────────────────────────────────────────

private data class StaffClefConfig(
    val name: String,
    val glyph: String,
    val keyDiatonic: Int,
    val keyLineFromTop: Int,
    val lines: IntArray,       // 5 diatonic values, BOTTOM to TOP
    val anchorFrac: Float,
    val fontScale: Float,
    val extraYOffset: Float = 0f  // dp
)

private val TREBLE_CLEF = StaffClefConfig(
    name = "Sol", glyph = "\uD834\uDD1E",
    keyDiatonic = 39, keyLineFromTop = 3,
    lines = intArrayOf(37, 39, 41, 43, 45),  // E4, G4, B4, D5, F5
    anchorFrac = 0.62f, fontScale = 0.533f
)

private val BASS_CLEF = StaffClefConfig(
    name = "Fa", glyph = "\uD834\uDD22",
    keyDiatonic = 31, keyLineFromTop = 1,
    lines = intArrayOf(25, 27, 29, 31, 33),  // G2, B2, D3, F3, A3
    anchorFrac = 0.20f, fontScale = 0.64f, extraYOffset = 11f
)

private val ALTO_CLEF = StaffClefConfig(
    name = "Ut3", glyph = "\uD834\uDD21",
    keyDiatonic = 35, keyLineFromTop = 2,
    lines = intArrayOf(31, 33, 35, 37, 39),  // F3, A3, C4, E4, G4
    anchorFrac = 0.50f, fontScale = 0.55f
)

private val TENOR_CLEF = StaffClefConfig(
    name = "Ut4", glyph = "\uD834\uDD21",
    keyDiatonic = 35, keyLineFromTop = 1,
    lines = intArrayOf(29, 31, 33, 35, 37),  // D3, F3, A3, C4, E4
    anchorFrac = 0.50f, fontScale = 0.55f
)

private val ALL_CLEFS = listOf(TREBLE_CLEF, BASS_CLEF, ALTO_CLEF, TENOR_CLEF)

private fun selectClef(notes: List<NoteEvent>, useFlats: Boolean): StaffClefConfig {
    if (notes.isEmpty()) return TREBLE_CLEF
    val diatonics = notes.map { midiToDiatonic(it.pitch, useFlats) }
    return ALL_CLEFS.minByOrNull { clef ->
        val top = clef.lines.last()
        val bottom = clef.lines.first()
        diatonics.sumOf { d ->
            when {
                d > top -> (d - top + 1) / 2
                d < bottom -> (bottom - d + 1) / 2
                else -> 0
            }
        }
    } ?: TREBLE_CLEF
}

// ─── Key signature accidental positions (diatonic) ───────────────────────────

// Sharp order positions on treble staff: F5, C5, G5, D5, A4, E5, B4
private val TREBLE_SHARP_POS = intArrayOf(45, 42, 46, 43, 40, 44, 41)
// Flat order positions on treble staff: B4, E5, A4, D5, G4, C5, F4
private val TREBLE_FLAT_POS = intArrayOf(41, 44, 40, 43, 39, 42, 38)
// Bass = treble - 14 (two octaves lower)
private val BASS_SHARP_POS = intArrayOf(31, 28, 32, 29, 26, 30, 27)
private val BASS_FLAT_POS = intArrayOf(27, 30, 26, 29, 25, 28, 24)

private fun keySignatureAccidentalCount(keySig: MusicKeySignature?): Int {
    if (keySig == null) return 0
    val majorRoot = if (keySig.isMinor) (keySig.root + 3) % 12 else keySig.root
    return if (keySig.useFlats) {
        when (majorRoot) { 5 -> 1; 10 -> 2; 3 -> 3; 8 -> 4; 1 -> 5; 6 -> 6; else -> 0 }
    } else {
        when (majorRoot) { 7 -> 1; 2 -> 2; 9 -> 3; 4 -> 4; 11 -> 5; 6 -> 6; else -> 0 }
    }
}

// ─── Main screen ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearningScreen(
    songId: String,
    onBack: () -> Unit,
    vm: LearningViewModel = viewModel(
        factory = LearningViewModel.Factory(LocalContext.current, songId)
    )
) {
    val configuration = LocalConfiguration.current
    val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

    // Full immersive mode for landscape
    val context = LocalContext.current
    val window = (context as? Activity)?.window
    DisposableEffect(isLandscape) {
        if (isLandscape && window != null) {
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

    val song by vm.song.collectAsState()
    val sections by vm.sections.collectAsState()
    val allMeasures by vm.allMeasures.collectAsState()
    val isPlaying by vm.isPlaying.collectAsState()
    val playingMeasure by vm.playingMeasureIndex.collectAsState()
    val focusedMeasure by vm.focusedMeasureIndex.collectAsState()
    val hand by vm.playbackHand.collectAsState()
    val tempoPercent by vm.tempoPercent.collectAsState()
    val isLooping by vm.isLooping.collectAsState()
    val loopStart by vm.loopStart.collectAsState()
    val loopEnd by vm.loopEnd.collectAsState()
    val showDetails by vm.showDetails.collectAsState()
    val showOctaves by vm.showOctaves.collectAsState()
    val keySignature by vm.keySignature.collectAsState()
    val isMetronomeEnabled by vm.metronomeEnabled.collectAsState()
    val clefMode by vm.clefMode.collectAsState()
    val pressedKeys by vm.pressedKeys.collectAsState()
    val waitMode by vm.waitMode.collectAsState()
    val listenMode by vm.listenMode.collectAsState()
    val useFlats = keySignature?.useFlats ?: false

    val listState = rememberLazyListState()

    // Smart octave shift — analyse whole song to reduce ledger lines
    val lowerStaffOctaveShift = remember(allMeasures, clefMode, useFlats) {
        val chordDiatonics = allMeasures.flatMap { it.chordNotes }
            .map { midiToDiatonic(it.pitch, useFlats) }
        if (chordDiatonics.isEmpty()) 0 else {
            val median = chordDiatonics.sorted()[chordDiatonics.size / 2]
            when (clefMode) {
                ClefMode.TREBLE_X2 -> {
                    val deficit = TREBLE_CLEF.lines.first() - median
                    when {
                        deficit >= 14 -> 14  // 15mb
                        deficit >= 7 -> 7    // 8vb
                        else -> 0
                    }
                }
                ClefMode.STANDARD -> {
                    val staffCenter = (BASS_CLEF.lines.first() + BASS_CLEF.lines.last()) / 2
                    val surplus = median - staffCenter
                    when {
                        surplus >= 14 -> -14  // 15ma — notes sound higher than written
                        surplus >= 7 -> -7    // 8va
                        surplus <= -14 -> 14  // 15mb
                        surplus <= -7 -> 7    // 8vb
                        else -> 0
                    }
                }
                else -> 0
            }
        }
    }
    val upperStaffOctaveShift = remember(allMeasures, clefMode, useFlats) {
        if (clefMode != ClefMode.STANDARD) 0 else {
            val melodyDiatonics = allMeasures.flatMap { it.melodyNotes }
                .map { midiToDiatonic(it.pitch, useFlats) }
            if (melodyDiatonics.isEmpty()) 0 else {
                val median = melodyDiatonics.sorted()[melodyDiatonics.size / 2]
                val staffCenter = (TREBLE_CLEF.lines.first() + TREBLE_CLEF.lines.last()) / 2
                val surplus = median - staffCenter
                when {
                    surplus >= 14 -> -14
                    surplus >= 7 -> -7
                    surplus <= -14 -> 14
                    surplus <= -7 -> 7
                    else -> 0
                }
            }
        }
    }

    // Dialog states
    var showRenameSongDialog by remember { mutableStateOf(false) }
    var showRenamePhraseDialog by remember { mutableStateOf<Int?>(null) }
    var showSplitDialog by remember { mutableStateOf<Int?>(null) }

    // Grid state hoisted so the auto-scroll effect can reach it.
    val gridState = androidx.compose.foundation.lazy.grid.rememberLazyGridState()

    // Auto-scroll when playing measure changes — keeps the active row in view.
    LaunchedEffect(playingMeasure) {
        if (playingMeasure >= 0) {
            val cols = if (isLandscape) 4 else 2
            // Scroll the row containing the playing measure into view a bit
            // above centre so we always see the next measure incoming.
            val rowStart = (playingMeasure / cols) * cols
            val currentFirst = gridState.firstVisibleItemIndex
            if (rowStart < currentFirst) {
                gridState.scrollToItem(rowStart)
            } else {
                gridState.animateScrollToItem(rowStart)
            }
        }
    }

    // Auto-focus center measure when scrolling while paused
    LaunchedEffect(listState.firstVisibleItemIndex, isPlaying) {
        if (!isPlaying) {
            val info = listState.layoutInfo
            val viewCenter = info.viewportStartOffset + info.viewportSize.width / 2f
            val centerItem = info.visibleItemsInfo
                .minByOrNull { abs((it.offset + it.size / 2f) - viewCenter) }
            centerItem?.let { vm.focusMeasure(it.index) }
        }
    }

    val focusedMeasureData = allMeasures.getOrNull(focusedMeasure)

    // Piano keyboard range: 2 octaves centered on lowest note of focused measure
    val pianoFocusOctave = remember(focusedMeasureData, hand, isLandscape) {
        val notes = when (hand) {
            PlaybackHand.LEFT  -> focusedMeasureData?.chordNotes
            PlaybackHand.RIGHT -> focusedMeasureData?.melodyNotes
            PlaybackHand.BOTH  -> focusedMeasureData?.let { it.melodyNotes + it.chordNotes }
        }
        val pitches = notes?.map { it.pitch } ?: emptyList()
        if (pitches.isEmpty()) 4
        else if (isLandscape) {
            (pitches.min() + pitches.max()) / 2 / 12  // center on range
        } else {
            pitches.min() / 12  // scroll to lowest
        }
    }

    Scaffold(
        containerColor = Background,
        topBar = {
            if (!isLandscape) {
                Column {
                    TopAppBar(
                        title = {
                            Column(modifier = Modifier.clickable { showRenameSongDialog = true }) {
                                Text(
                                    song?.title ?: "",
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    fontSize = 18.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                // Dot-separated metadata mirroring web partition header
                                val keySigText = keySignature?.name
                                val tsText = song?.timeSignature?.let { "${it.numerator}/${it.denominator}" }
                                val parts = listOfNotNull(
                                    song?.let { "${it.totalMeasures} mesures" },
                                    keySigText,
                                    song?.let { "${it.tempo} BPM" },
                                    tsText,
                                )
                                Text(
                                    parts.joinToString("  ·  "),
                                    fontSize = 11.sp,
                                    color = Color(0xFF94A3B8),
                                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        },
                        navigationIcon = {
                            IconButton(onClick = onBack) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
                            }
                        },
                        actions = {
                            TextButton(onClick = vm::cycleClefMode) {
                                Text(
                                    when (clefMode) {
                                        ClefMode.STANDARD -> "Sol+Fa"
                                        ClefMode.TREBLE_X2 -> "Sol×2"
                                        ClefMode.AUTO -> "Auto"
                                    },
                                    color = IndigoAccent,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            TextButton(onClick = vm::toggleOctaves) {
                                Text(
                                    "Oct",
                                    color = if (showOctaves) IndigoAccent else Color(0xFF64748B),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            TextButton(onClick = vm::toggleDetails) {
                                Text(
                                    "Détails",
                                    color = if (showDetails) IndigoAccent else Color(0xFF64748B),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = Surface)
                    )
                }
            }
        },
        bottomBar = {
            if (allMeasures.isNotEmpty()) {
                Column {
                    LearningPianoKeyboard(
                        activeRightPitches = focusedMeasureData?.melodyNotes?.map { it.pitch }?.toSet() ?: emptySet(),
                        activeLeftPitches = focusedMeasureData?.chordNotes?.map { it.pitch }?.toSet() ?: emptySet(),
                        pressedKeys = pressedKeys,
                        focusOctave = pianoFocusOctave,
                        isLandscape = isLandscape,
                        modifier = Modifier.fillMaxWidth().height(if (isLandscape) 56.dp else 90.dp)
                    )

                    // Shared PlaybackDock (same look as the web app)
                    var loopEditorOpen by remember { mutableStateOf(false) }
                    com.tobietheunknown.pianoteacher.ui.common.PlaybackDock(
                        playing = isPlaying,
                        onPlayPause = { if (isPlaying) vm.stop() else vm.play() },
                        speed = (tempoPercent * 100).toInt(),
                        onSpeed = { pct ->
                            val newTempo = pct / 100f
                            vm.adjustTempo(newTempo - tempoPercent)
                        },
                        handMode = when {
                            listenMode -> com.tobietheunknown.pianoteacher.ui.common.HandMode.LISTEN
                            hand == com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.LEFT -> com.tobietheunknown.pianoteacher.ui.common.HandMode.LEFT
                            hand == com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.RIGHT -> com.tobietheunknown.pianoteacher.ui.common.HandMode.RIGHT
                            else -> com.tobietheunknown.pianoteacher.ui.common.HandMode.BOTH
                        },
                        onHandMode = { m ->
                            when (m) {
                                com.tobietheunknown.pianoteacher.ui.common.HandMode.LEFT -> {
                                    vm.setHand(com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.LEFT)
                                }
                                com.tobietheunknown.pianoteacher.ui.common.HandMode.RIGHT -> {
                                    vm.setHand(com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.RIGHT)
                                }
                                com.tobietheunknown.pianoteacher.ui.common.HandMode.LISTEN -> {
                                    // Force BOTH (so vm doesn't auto-disable listen) then enable listen.
                                    vm.setHand(com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.BOTH)
                                    if (!listenMode) vm.toggleListenMode()
                                }
                                else -> {
                                    // BOTH — clear listen if it was on.
                                    if (listenMode) vm.toggleListenMode()
                                    vm.setHand(com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.BOTH)
                                }
                            }
                        },
                        metronome = isMetronomeEnabled,
                        onMetronome = vm::toggleMetronome,
                        loop = isLooping,
                        onLoop = vm::toggleLoop,
                        // vm loop indices are 0-based; the dock displays 1-based measure numbers.
                        loopRange = ((loopStart ?: 0) + 1)..((loopEnd ?: 0) + 1),
                        onLoopRangeChange = { r -> vm.setLoopRange(r.first - 1, r.last - 1) },
                        loopEditorOpen = loopEditorOpen,
                        onToggleLoopEditor = { loopEditorOpen = !loopEditorOpen },
                        totalMeasures = allMeasures.size,
                        onPrev = { /* TODO: prev measure/phrase */ },
                        onNext = { /* TODO: next measure/phrase */ },
                    )

                    /* OLD TransportBar — kept as fallback during dev */
                    if (false) TransportBar(
                        isPlaying = isPlaying,
                        hand = hand,
                        tempoPercent = tempoPercent,
                        isLooping = isLooping,
                        loopStart = loopStart,
                        loopEnd = loopEnd,
                        totalMeasures = allMeasures.size,
                        isMetronomeEnabled = isMetronomeEnabled,
                        onPlay = vm::play,
                        onStop = vm::stop,
                        onHandChange = vm::setHand,
                        onTempoAdjust = vm::adjustTempo,
                        onToggleLoop = vm::toggleLoop,
                        onLoopRangeChange = vm::setLoopRange,
                        onToggleMetronome = vm::toggleMetronome,
                        onSplit = { showSplitDialog = focusedMeasure },
                        isLandscape = isLandscape,
                        showDetails = showDetails,
                        onToggleDetails = vm::toggleDetails,
                        clefMode = clefMode,
                        onCycleClef = vm::cycleClefMode,
                        waitMode = waitMode,
                        onToggleWaitMode = vm::toggleWaitMode,
                        listenMode = listenMode,
                        onToggleListenMode = vm::toggleListenMode
                    )
                }
            }
        }
    ) { padding ->
        when {
            song == null -> Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator(color = IndigoAccent) }

            song!!.phrases.isEmpty() -> Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.MusicOff, null, modifier = Modifier.size(48.dp), tint = Color(0xFF334155))
                    Spacer(Modifier.height(12.dp))
                    Text("Aucune phrase trouvée", color = Color(0xFF64748B), fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(4.dp))
                    Text("Supprime ce morceau et réimporte-le", fontSize = 12.sp, color = Color(0xFF475569))
                }
            }

            else -> Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                // Vertical 2-col grid in portrait (4-col in landscape) so
                // the user sees several measures at once and doesn't need
                // to follow a fast horizontal scroll.
                val cols = if (isLandscape) 4 else 2
                androidx.compose.foundation.lazy.grid.LazyVerticalGrid(
                    columns = androidx.compose.foundation.lazy.grid.GridCells.Fixed(cols),
                    state = gridState,
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 6.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(
                        count = allMeasures.size,
                        key = { allMeasures[it].globalIndex }
                    ) { idx ->
                        val measure = allMeasures[idx]
                        val isPlaying = measure.globalIndex == playingMeasure
                        val isFocused = measure.globalIndex == focusedMeasure
                        // Show clefs on the first card of each row so every
                        // line of the grid reads as a system.
                        val showClefs = (idx % cols == 0) || idx == 0 || (clefMode == ClefMode.AUTO && idx > 0 && run {
                            val prev = allMeasures[idx - 1]
                            selectClef(prev.melodyNotes, useFlats).name != selectClef(measure.melodyNotes, useFlats).name ||
                            selectClef(prev.chordNotes, useFlats).name != selectClef(measure.chordNotes, useFlats).name
                        })
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(if (isLandscape) 180.dp else 280.dp)
                                .clickable {
                                    vm.focusMeasure(measure.globalIndex)
                                }
                        ) {
                            // Compact measure-number header (replaces the
                            // duplicated mini timeline that was eating
                            // ~80dp of card height).
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 4.dp, vertical = 2.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    String.format("%02d", measure.globalIndex + 1),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPlaying) IndigoAccent else Color(0xFF475569),
                                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                )
                                if (isFocused || isPlaying) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(RoundedCornerShape(50))
                                            .background(if (isPlaying) IndigoAccent else Color.White.copy(alpha = 0.3f))
                                    )
                                }
                            }
                            Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                                GrandStaffCanvas(
                                    melodyNotes = measure.melodyNotes,
                                    chordNotes = measure.chordNotes,
                                    beatsPerMeasure = song!!.beatsPerMeasure,
                                    useFlats = useFlats,
                                    showClefs = showClefs,
                                    isPlaying = isPlaying,
                                    isFocused = isFocused,
                                    measureNumber = measure.globalIndex + 1,
                                    clefMode = clefMode,
                                    lowerOctaveShift = lowerStaffOctaveShift,
                                    upperOctaveShift = upperStaffOctaveShift,
                                    isLandscape = isLandscape,
                                    keySig = keySignature,
                                    modifier = Modifier.fillMaxSize()
                                )
                                // Animated playhead — vertical accent line
                                // that traverses the measure left→right in
                                // sync with the current beat.
                                if (isPlaying && song != null) {
                                    val beatMs = (60_000.0 / (song!!.tempo * tempoPercent)).toLong()
                                    val measureDurMs = beatMs * song!!.beatsPerMeasure
                                    val frac by produceState(initialValue = 0f, isPlaying, measureDurMs) {
                                        val start = android.os.SystemClock.elapsedRealtime()
                                        while (true) {
                                            val elapsed = android.os.SystemClock.elapsedRealtime() - start
                                            value = ((elapsed.toFloat() / measureDurMs) % 1f).coerceIn(0f, 1f)
                                            kotlinx.coroutines.delay(16)
                                        }
                                    }
                                    // Hoist the .copy() outside DrawScope so 60Hz frame loop
                                    // doesn't allocate two Color objects per frame.
                                    val haloColor = remember(IndigoAccent) { IndigoAccent.copy(alpha = 0.10f) }
                                    val lineColor = remember(IndigoAccent) { IndigoAccent.copy(alpha = 0.95f) }
                                    androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
                                        // skip the clef area when showing clefs (~22dp)
                                        val clefSkip = if (showClefs) size.width * 0.18f else 0f
                                        val noteArea = size.width - clefSkip
                                        val x = clefSkip + frac * noteArea
                                        drawRect(
                                            color = haloColor,
                                            topLeft = androidx.compose.ui.geometry.Offset(x - size.width * 0.04f, 0f),
                                            size = androidx.compose.ui.geometry.Size(size.width * 0.08f, size.height),
                                        )
                                        drawRect(
                                            color = lineColor,
                                            topLeft = androidx.compose.ui.geometry.Offset(x - 1f, 0f),
                                            size = androidx.compose.ui.geometry.Size(2f, size.height),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                // NoteLabelsStrip: always in portrait, toggle via Détails in landscape
                if (!isLandscape || showDetails) {
                    NoteLabelsStrip(
                        measure = focusedMeasureData,
                        useFlats = useFlats,
                        showOctaves = showOctaves,
                        showDetails = showDetails,
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                    )
                }
            }
        }
    }

    // ─── Dialogs ──────────────────────────────────────────────────────────────

    if (showRenameSongDialog && song != null) {
        var text by remember { mutableStateOf(song!!.title) }
        AlertDialog(
            onDismissRequest = { showRenameSongDialog = false },
            title = { Text("Renommer le morceau") },
            text = {
                TextField(
                    value = text,
                    onValueChange = { text = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = { vm.renameSong(text); showRenameSongDialog = false }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showRenameSongDialog = false }) { Text("Annuler") }
            }
        )
    }

    showRenamePhraseDialog?.let { phraseIdx ->
        val phrase = song?.phrases?.getOrNull(phraseIdx)
        if (phrase != null) {
            var text by remember { mutableStateOf(phrase.name) }
            val canDelete = phraseIdx > 0 && (song?.phrases?.size ?: 0) > 1
            AlertDialog(
                onDismissRequest = { showRenamePhraseDialog = null },
                title = { Text("Renommer la phrase") },
                text = {
                    TextField(value = text, onValueChange = { text = it }, singleLine = true, modifier = Modifier.fillMaxWidth())
                },
                confirmButton = {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { vm.deletePhrase(phraseIdx); showRenamePhraseDialog = null }, enabled = canDelete) {
                            Text("Supprimer", color = if (canDelete) Color(0xFFEF4444) else Color(0xFF64748B))
                        }
                        TextButton(onClick = { vm.renamePhrase(phraseIdx, text); showRenamePhraseDialog = null }) { Text("OK") }
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showRenamePhraseDialog = null }) { Text("Annuler") }
                }
            )
        }
    }

    showSplitDialog?.let { globalIdx ->
        var text by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showSplitDialog = null },
            title = { Text("Diviser la phrase") },
            text = {
                Column {
                    Text("Diviser à la mesure ${globalIdx + 1}", fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    TextField(
                        value = text,
                        onValueChange = { text = it },
                        singleLine = true,
                        label = { Text("Nom de la nouvelle phrase (optionnel)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { vm.splitPhraseAtMeasure(globalIdx, text.ifBlank { null }); showSplitDialog = null }) { Text("Diviser") }
            },
            dismissButton = {
                TextButton(onClick = { showSplitDialog = null }) { Text("Annuler") }
            }
        )
    }
}


// ─── Timeline beat row (used in mini strip) ───────────────────────────────────

@Composable
private fun TimelineBeatRow(
    notes: List<NoteEvent>,
    color: Color,
    beatsPerMeasure: Int,
    showOctaves: Boolean,
    useFlats: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth().height(20.dp),
        horizontalArrangement = Arrangement.spacedBy(1.dp)
    ) {
        for (beat in 0 until beatsPerMeasure) {
            val beatNotes = notes.filter { it.startTime.toInt() == beat }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(2.dp))
                    .background(if (beatNotes.isNotEmpty()) color.copy(alpha = 0.18f) else Color.Transparent),
                contentAlignment = Alignment.Center
            ) {
                if (beatNotes.isNotEmpty()) {
                    Text(
                        text = midiToFrench(beatNotes.first().pitch, showOctaves, useFlats),
                        fontSize = 7.5.sp,
                        color = color,
                        maxLines = 1,
                        overflow = TextOverflow.Clip
                    )
                }
            }
        }
    }
}

// ─── Mini measure card (top portion of each combined item) ───────────────────

@Composable
private fun MiniMeasureCard(
    measure: MeasureData,
    beatsPerMeasure: Int,
    isPlaying: Boolean,
    isFocused: Boolean,
    useFlats: Boolean,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp))
            .background(
                when {
                    isPlaying -> IndigoAccent.copy(alpha = 0.18f)
                    isFocused -> Color.White.copy(alpha = 0.05f)
                    else -> Surface
                }
            )
            .border(
                width = if (isPlaying) 1.dp else if (isFocused) 0.5.dp else 0.dp,
                color = if (isPlaying) IndigoAccent else if (isFocused) Color.White.copy(alpha = 0.15f) else Color.Transparent,
                shape = RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp)
            )
            .padding(horizontal = 4.dp, vertical = 3.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            "${measure.globalIndex + 1}",
            fontSize = 9.sp,
            color = if (isPlaying) IndigoAccent else Color(0xFF475569),
            fontWeight = if (isPlaying) FontWeight.Bold else FontWeight.Normal
        )
        Spacer(Modifier.height(2.dp))
        TimelineBeatRow(
            notes = measure.melodyNotes,
            color = CyanMelody,
            beatsPerMeasure = beatsPerMeasure,
            showOctaves = false,
            useFlats = useFlats
        )
        Spacer(Modifier.height(1.dp))
        TimelineBeatRow(
            notes = measure.chordNotes,
            color = PinkChords,
            beatsPerMeasure = beatsPerMeasure,
            showOctaves = false,
            useFlats = useFlats
        )
    }
}

// ─── Grand staff canvas ───────────────────────────────────────────────────────

private const val STAFF_NUM_AREA_DP = 22f
private const val STAFF_BOTTOM_PAD_DP = 8f
private const val STAFF_H_MAX_DP = 120f

@Composable
private fun GrandStaffCanvas(
    melodyNotes: List<NoteEvent>,
    chordNotes: List<NoteEvent>,
    beatsPerMeasure: Int,
    useFlats: Boolean,
    showClefs: Boolean,
    isPlaying: Boolean,
    isFocused: Boolean,
    measureNumber: Int,
    clefMode: ClefMode = ClefMode.STANDARD,
    lowerOctaveShift: Int = 0,
    upperOctaveShift: Int = 0,
    isLandscape: Boolean = false,
    keySig: MusicKeySignature? = null,
    modifier: Modifier = Modifier
) {
    val textMeasurer = rememberTextMeasurer()

    Canvas(
        modifier = modifier.background(
            when {
                isPlaying -> IndigoAccent.copy(alpha = 0.10f)
                isFocused -> Color.White.copy(alpha = 0.03f)
                else -> Color.Transparent
            }
        )
    ) {
        val w = size.width
        val h = size.height

        val numAreaH  = STAFF_NUM_AREA_DP.dp.toPx()
        val topPad    = numAreaH + 8.dp.toPx()
        val bottomPad = STAFF_BOTTOM_PAD_DP.dp.toPx()

        // 2 staves of 4 lineSpacings + gap of 2 lineSpacings = 10 lineSpacings total
        val totalAvail   = h - topPad - bottomPad
        val staffHMax    = if (isLandscape) 70.dp.toPx() else STAFF_H_MAX_DP.dp.toPx()
        val staffH       = (totalAvail / 2.5f).coerceAtMost(staffHMax)
        val lineSpacing  = staffH / 4f
        val gap          = lineSpacing * 2f  // exactly 2 line spacings → middle C falls between staves
        val totalStavesH = staffH * 2 + gap
        val stavesOriginY = topPad + (totalAvail - totalStavesH) / 2f

        // Key signature width: only for fixed clef modes (STANDARD, TREBLE_X2)
        val showKeySig = showClefs && clefMode != ClefMode.AUTO
        val numAccidentals = if (showKeySig) keySignatureAccidentalCount(keySig) else 0
        val ksW = if (numAccidentals > 0) numAccidentals * 7.dp.toPx() + 4.dp.toPx() else 0f
        val clefW    = if (showClefs) (staffH * 0.26f).coerceAtLeast(22.dp.toPx()) + ksW else 0f
        val barPad   = 10.dp.toPx()
        val dotR     = lineSpacing * (if (isLandscape) 0.38f else 0.32f)

        // ── Resolve clefs + note assignment per mode ──────────────────────
        val upperClef: StaffClefConfig
        val lowerClef: StaffClefConfig
        val upperNotes: List<Pair<NoteEvent, Color>>
        val lowerNotes: List<Pair<NoteEvent, Color>>

        when (clefMode) {
            ClefMode.STANDARD -> {
                upperClef = TREBLE_CLEF; lowerClef = BASS_CLEF
                // Hand-based split: melody → treble, chords → bass (with smart octave shift)
                upperNotes = melodyNotes.map { it to CyanMelody.copy(alpha = 0.72f) }
                lowerNotes = chordNotes.map { it to PinkChords.copy(alpha = 0.72f) }
            }
            ClefMode.TREBLE_X2 -> {
                upperClef = TREBLE_CLEF; lowerClef = TREBLE_CLEF
                upperNotes = melodyNotes.map { it to CyanMelody.copy(alpha = 0.72f) }
                lowerNotes = chordNotes.map { it to PinkChords.copy(alpha = 0.72f) }
            }
            ClefMode.AUTO -> {
                upperClef = selectClef(melodyNotes, useFlats)
                lowerClef = selectClef(chordNotes, useFlats)
                upperNotes = melodyNotes.map { it to CyanMelody.copy(alpha = 0.72f) }
                lowerNotes = chordNotes.map { it to PinkChords.copy(alpha = 0.72f) }
            }
        }
        val staffClefs = arrayOf(upperClef, lowerClef)
        val staffNotesList = arrayOf(upperNotes, lowerNotes)

        // ── Measure number ─────────────────────────────────────────────────
        val numStyle = TextStyle(
            fontSize = 13.sp,
            color = if (isPlaying) IndigoAccent else Color(0xFF64748B),
            fontWeight = if (isPlaying) FontWeight.Bold else FontWeight.Normal
        )
        val numLayout = textMeasurer.measure("$measureNumber", numStyle)
        drawText(numLayout, topLeft = Offset((w - numLayout.size.width) / 2f, 4.dp.toPx()))

        // ── Left bracket ──────────────────────────────────────────────────
        val bracketX = if (isLandscape) 0f else 1.dp.toPx()
        drawLine(
            color = Color.White.copy(alpha = 0.35f),
            start = Offset(bracketX, stavesOriginY),
            end   = Offset(bracketX, stavesOriginY + totalStavesH),
            strokeWidth = 3.dp.toPx()
        )

        // ── Draw both staves (si=0: upper, si=1: lower) ───────────────────
        val staffTops = floatArrayOf(stavesOriginY, stavesOriginY + staffH + gap)

        staffTops.forEachIndexed { si, staffTop ->
            val clef = staffClefs[si]
            val lineTop = staffTop
            val topDiatonic = clef.lines.last()
            val bottomDiatonic = clef.lines.first()

            // ── Staff lines ─────────────────────────────────────────────
            for (li in 0..4) {
                val y = lineTop + li * lineSpacing
                val lineDiatonic = clef.lines[4 - li]
                val isKey = (lineDiatonic == clef.keyDiatonic)
                val keyColor = if (si == 0) CyanMelody.copy(alpha = 0.72f) else PinkChords.copy(alpha = 0.72f)
                drawLine(
                    color = if (isKey) keyColor else Color.White.copy(alpha = 0.62f),
                    start = Offset(bracketX + 2.dp.toPx(), y),
                    end   = Offset(w, y),
                    strokeWidth = if (isKey) 1.6f else 1.2f
                )
            }

            // ── Clef glyph ──────────────────────────────────────────────
            val pureClefW = clefW - ksW  // clef zone without key signature
            if (showClefs) {
                val clefFontPx = staffH * clef.fontScale
                val clefStyle = TextStyle(
                    fontSize = (clefFontPx / density).sp,
                    color = Color.White.copy(alpha = 0.35f)
                )
                val clefLayout = textMeasurer.measure(clef.glyph, clefStyle)
                val keyY = lineTop + clef.keyLineFromTop * lineSpacing
                val bassAdj = when {
                    clef.name == "Fa" && isLandscape -> 2.dp.toPx()   // lower in landscape
                    clef.name == "Fa" && !isLandscape -> 1.dp.toPx()  // lower in portrait
                    else -> 0f
                }
                val clefY = keyY - clefLayout.size.height * clef.anchorFrac - clef.extraYOffset.dp.toPx() + bassAdj
                val clefX = (pureClefW - clefLayout.size.width) / 2f
                drawText(clefLayout, topLeft = Offset(clefX.coerceAtLeast(2.dp.toPx()), clefY))

                // ── Key signature accidentals ─────────────────────────────
                if (numAccidentals > 0 && keySig != null) {
                    val isTreble = (clef.name == "Sol")
                    val positions = if (keySig.useFlats) {
                        if (isTreble) TREBLE_FLAT_POS else BASS_FLAT_POS
                    } else {
                        if (isTreble) TREBLE_SHARP_POS else BASS_SHARP_POS
                    }
                    val accLabel = if (keySig.useFlats) "♭" else "♯"
                    val accStyle = TextStyle(
                        fontSize = (lineSpacing * 0.9f / density).sp,
                        color = Color.White.copy(alpha = 0.6f),
                        fontWeight = FontWeight.Bold
                    )
                    val topD = clef.lines.last()
                    for (i in 0 until numAccidentals) {
                        val d = positions[i]
                        val accLayout = textMeasurer.measure(accLabel, accStyle)
                        val ax = pureClefW + 2.dp.toPx() + i * 7.dp.toPx()
                        val ay = lineTop + (topD - d) * (lineSpacing / 2f) - accLayout.size.height * 0.45f
                        drawText(accLayout, topLeft = Offset(ax, ay))
                    }
                }
            }

            // ── Octave shift label (8va/8vb/15ma/15mb) ─────────────
            val octShift = if (si == 1) lowerOctaveShift else upperOctaveShift
            if (showClefs && octShift != 0) {
                val octLabel = when {
                    octShift >= 14 -> "15mb"
                    octShift >= 7 -> "8vb"
                    octShift <= -14 -> "15ma"
                    octShift <= -7 -> "8va"
                    else -> ""
                }
                if (octLabel.isNotEmpty()) {
                    val octStyle = TextStyle(fontSize = 9.sp, color = Color.White.copy(alpha = 0.45f), fontWeight = FontWeight.Bold)
                    val octLayout = textMeasurer.measure(octLabel, octStyle)
                    val labelY = if (octShift > 0) {
                        lineTop + 4 * lineSpacing + 3.dp.toPx()  // below staff
                    } else {
                        lineTop - octLayout.size.height - 2.dp.toPx()  // above staff
                    }
                    drawText(octLayout, topLeft = Offset(2.dp.toPx(), labelY))
                }
            }

            // ── Notes ───────────────────────────────────────────────────
            staffNotesList[si].forEach { (note, color) ->
                val d = midiToDiatonic(note.pitch, useFlats) + octShift
                val frac = (note.startTime / beatsPerMeasure).toFloat().coerceIn(0f, 1f)
                val leftPad = barPad + dotR * 2f  // extra space from left bar line
                val noteAreaStart = clefW + leftPad
                val noteAreaEnd = w - barPad - dotR
                val x = noteAreaStart + frac * (noteAreaEnd - noteAreaStart)
                val y = lineTop + (topDiatonic - d) * (lineSpacing / 2f)

                drawCircle(color = color, radius = dotR, center = Offset(x, y))

                // Ledger lines (only when note is ≥2 diatonic steps outside staff)
                if (d > topDiatonic + 1) {
                    var ld = topDiatonic + 2
                    while (ld <= d) {
                        val ly = lineTop + (topDiatonic - ld) * (lineSpacing / 2f)
                        drawLine(Color.White.copy(alpha = 0.5f),
                            Offset(x - dotR * 1.5f, ly), Offset(x + dotR * 1.5f, ly), 0.9f)
                        ld += 2
                    }
                }
                if (d < bottomDiatonic - 1) {
                    var ld = bottomDiatonic - 2
                    while (ld >= d) {
                        val ly = lineTop + (topDiatonic - ld) * (lineSpacing / 2f)
                        drawLine(Color.White.copy(alpha = 0.5f),
                            Offset(x - dotR * 1.5f, ly), Offset(x + dotR * 1.5f, ly), 0.9f)
                        ld -= 2
                    }
                }

                // Accidental (#/b)
                if (isBlackKey(note.pitch)) {
                    val label = if (useFlats) "b" else "#"
                    val labelLayout = textMeasurer.measure(
                        label,
                        TextStyle(fontSize = 9.sp, color = color.copy(alpha = 0.95f), fontWeight = FontWeight.Bold)
                    )
                    drawText(labelLayout, topLeft = Offset(
                        x + dotR * 1.3f,
                        y - dotR - labelLayout.size.height
                    ))
                }
            }
        }

        // ── Bar line ───────────────────────────────────────────────────────
        val barMargin = 4.dp.toPx()
        drawLine(
            color = Color.White.copy(alpha = 0.28f),
            start = Offset(w - 1f, stavesOriginY + barMargin),
            end   = Offset(w - 1f, stavesOriginY + totalStavesH - barMargin),
            strokeWidth = 1f
        )
    }
}

// ─── Note labels strip ────────────────────────────────────────────────────────

@Composable
private fun NoteLabelsStrip(
    measure: MeasureData?,
    useFlats: Boolean,
    showOctaves: Boolean,
    showDetails: Boolean = false,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(true) }

    Column(
        modifier = modifier.background(Background.copy(alpha = 0.45f))
    ) {
        // Header row : contenu MD/MG + bouton collapse
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                if (expanded && measure != null) {
                    if (measure.melodyNotes.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text("MD", fontSize = 11.sp, color = CyanMelody.copy(alpha = 0.7f), fontWeight = FontWeight.Bold)
                            measure.melodyNotes.map { it.pitch }.distinct()
                                .forEach { pitch -> NoteChip(midiToFrench(pitch, showOctaves, useFlats), CyanMelody) }
                        }
                    }
                    if (measure.chordInfo != null || measure.chordNotes.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text("MG", fontSize = 11.sp, color = PinkChords.copy(alpha = 0.7f), fontWeight = FontWeight.Bold)
                            if (measure.chordInfo != null) {
                                ChordChip(
                                    chordInfo = measure.chordInfo,
                                    chordNotes = measure.chordNotes,
                                    showDetails = showDetails,
                                    showOctaves = showOctaves,
                                    useFlats = useFlats,
                                    arpeggioResult = measure.arpeggioMotif
                                )
                            } else {
                                measure.chordNotes.map { it.pitch }.distinct()
                                    .forEach { pitch -> NoteChip(midiToFrench(pitch, showOctaves, useFlats), PinkChords) }
                            }
                        }
                    }
                }
            }
            // Bouton collapse ▼/▲
            IconButton(onClick = { expanded = !expanded }, modifier = Modifier.size(28.dp)) {
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Rétracter" else "Développer",
                    tint = Color.White.copy(alpha = 0.5f),
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

// ─── Piano keyboard — scrollable, snap on C (DO) ─────────────────────────────

private const val PIANO_MIN_OCT = 1   // C1 = MIDI 12
private const val PIANO_MAX_OCT = 8   // C8 = MIDI 96

@Composable
private fun LearningPianoKeyboard(
    activeRightPitches: Set<Int>,
    activeLeftPitches: Set<Int>,
    pressedKeys: Set<Int> = emptySet(),
    focusOctave: Int,
    isLandscape: Boolean = false,
    modifier: Modifier = Modifier
) {
    val numOctaves = PIANO_MAX_OCT - PIANO_MIN_OCT + 1
    val listState = rememberLazyListState()
    val snapBehavior = rememberSnapFlingBehavior(listState)
    // Landscape: show ~5.5 octaves at once, portrait: 2
    val octaveFrac = if (isLandscape) 0.18f else 0.5f

    LaunchedEffect(focusOctave, isLandscape) {
        val centerOffset = if (isLandscape) 2 else 0  // center in 5-octave viewport
        val idx = (focusOctave - PIANO_MIN_OCT - centerOffset).coerceIn(0, numOctaves - 1)
        listState.scrollToItem(idx)
    }

    LazyRow(
        state = listState,
        flingBehavior = snapBehavior,
        modifier = modifier,
        userScrollEnabled = true
    ) {
        items(numOctaves) { i ->
            OctaveKeys(
                cMidi = (PIANO_MIN_OCT + i) * 12,
                activeRightPitches = activeRightPitches,
                activeLeftPitches = activeLeftPitches,
                pressedKeys = pressedKeys,
                modifier = Modifier.fillParentMaxWidth(octaveFrac).fillParentMaxHeight()
            )
        }
    }
}

@Composable
private fun OctaveKeys(
    cMidi: Int,
    activeRightPitches: Set<Int>,
    activeLeftPitches: Set<Int>,
    pressedKeys: Set<Int> = emptySet(),
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier.background(Background)) {
        val wkW = size.width / 7f
        val bkW = wkW * 0.6f
        val bkH = size.height * 7f / 12f

        // White keys: C D E F G A B  (semitones 0,2,4,5,7,9,11)
        intArrayOf(0, 2, 4, 5, 7, 9, 11).forEachIndexed { wi, semi ->
            val midi = cMidi + semi
            val color = when {
                midi in pressedKeys        -> Color(0xFF4ADE80)            // green for MIDI input
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.52f)
                midi in activeLeftPitches  -> PinkChords.copy(alpha = 0.52f)
                else                       -> Color(0xFFE8ECF0)
            }
            drawRoundRect(color, Offset(wi * wkW + 0.5f, 0f), Size(wkW - 1f, size.height), CornerRadius(2f))
        }

        // Black keys — (semitone, rightWhiteIndex) pairs
        listOf(1 to 1, 3 to 2, 6 to 4, 8 to 5, 10 to 6).forEach { (semi, rw) ->
            val midi = cMidi + semi
            val color = when {
                midi in pressedKeys        -> Color(0xFF4ADE80).copy(alpha = 0.40f) // green tint, stays dark
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.18f)
                midi in activeLeftPitches  -> PinkChords.copy(alpha = 0.18f)
                else                       -> Color(0xFF1A1A1A)
            }
            val x = rw * wkW - bkW / 2f
            drawRoundRect(color, Offset(x, 0f), Size(bkW, bkH), CornerRadius(2f))
        }
    }
}


@Composable
private fun ChordChip(
    chordInfo: com.tobietheunknown.pianoteacher.utils.ChordInfo,
    chordNotes: List<NoteEvent>,
    showDetails: Boolean,
    showOctaves: Boolean,
    useFlats: Boolean = false,
    arpeggioResult: ArpeggioMotifResult? = null
) {
    Column {
        if (arpeggioResult != null && arpeggioResult.chords.isNotEmpty()) {
            if (arpeggioResult.isArpeggio) {
                Text(arpeggioResult.header, fontSize = 9.sp, color = PinkChords.copy(alpha = 0.5f), fontWeight = FontWeight.Medium)
                Spacer(Modifier.height(2.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for (cwr in arpeggioResult.chords) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        ArpeggioChordBadge(cwr)
                        if (showDetails) {
                            Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(start = 8.dp)) {
                                cwr.cycleNotes.forEach { pitch -> NoteChip(midiToFrench(pitch, showOctaves, useFlats), PinkChords) }
                            }
                        }
                    }
                }
            }
        } else {
            Row(
                modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(PinkChords.copy(alpha = 0.12f))
                    .border(1.dp, PinkChords.copy(alpha = 0.3f), RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically
            ) {
                if (chordInfo.isArpeggio) Icon(Icons.Default.MusicNote, null, tint = PinkChords, modifier = Modifier.size(9.dp))
                val displayName = if (chordInfo.bassNote != null) "${chordInfo.name} / ${chordInfo.bassNote}" else chordInfo.name
                Text(displayName, fontSize = 11.sp, color = PinkChords, fontWeight = FontWeight.SemiBold)
                if (chordInfo.isArpeggio) Text("arp.", fontSize = 9.sp, color = PinkChords.copy(alpha = 0.6f))
            }
            if (showDetails && chordNotes.isNotEmpty()) {
                Spacer(Modifier.height(2.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    firstArpeggioCycle(chordNotes).map { midiToFrench(it.pitch, showOctaves, useFlats) }.forEach { NoteChip(it, PinkChords) }
                }
            }
        }
    }
}

@Composable
private fun ArpeggioChordBadge(cwr: ChordWithReps) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(PinkChords.copy(alpha = 0.12f))
            .border(1.dp, PinkChords.copy(alpha = 0.3f), RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically
    ) {
        Text(cwr.name, fontSize = 11.sp, color = PinkChords, fontWeight = FontWeight.SemiBold)
        if (cwr.suffix.isNotEmpty()) Text(cwr.suffix, fontSize = 9.sp, color = PinkChords.copy(alpha = 0.7f))
        if (cwr.bassNote != null) Text("/${cwr.bassNote}", fontSize = 10.sp, color = PinkChords.copy(alpha = 0.6f))
        if (cwr.repetitions > 1) Text("x${cwr.repetitions}", fontSize = 9.sp, color = PinkChords.copy(alpha = 0.5f))
    }
}

@Composable
private fun NoteChip(name: String, color: Color) {
    Box(
        modifier = Modifier.clip(RoundedCornerShape(3.dp)).background(color.copy(alpha = 0.1f)).padding(horizontal = 4.dp, vertical = 1.dp)
    ) {
        Text(name, fontSize = 13.sp, color = color, fontWeight = FontWeight.Medium)
    }
}


// ─── Transport bar ────────────────────────────────────────────────────────────

@Composable
private fun TransportBar(
    isPlaying: Boolean,
    hand: PlaybackHand,
    tempoPercent: Float,
    isLooping: Boolean,
    loopStart: Int,
    loopEnd: Int,
    totalMeasures: Int,
    isMetronomeEnabled: Boolean,
    onPlay: () -> Unit,
    onStop: () -> Unit,
    onHandChange: (PlaybackHand) -> Unit,
    onTempoAdjust: (Float) -> Unit,
    onToggleLoop: () -> Unit,
    onLoopRangeChange: (Int, Int) -> Unit,
    onToggleMetronome: () -> Unit,
    onSplit: () -> Unit = {},
    isLandscape: Boolean = false,
    showDetails: Boolean = false,
    onToggleDetails: () -> Unit = {},
    clefMode: ClefMode = ClefMode.STANDARD,
    onCycleClef: () -> Unit = {},
    waitMode: Boolean = false,
    onToggleWaitMode: () -> Unit = {},
    listenMode: Boolean = true,
    onToggleListenMode: () -> Unit = {}
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: Hand selector + clef mode (landscape only)
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                HandButton("MG", hand == PlaybackHand.LEFT, PinkChords) { onHandChange(PlaybackHand.LEFT) }
                HandButton(
                    if (listenMode && hand == PlaybackHand.BOTH) "🔊" else "2🎹",
                    hand == PlaybackHand.BOTH,
                    if (listenMode && hand == PlaybackHand.BOTH) AmberWarning else IndigoAccent
                ) {
                    if (hand == PlaybackHand.BOTH) onToggleListenMode()
                    else onHandChange(PlaybackHand.BOTH)
                }
                HandButton("MD", hand == PlaybackHand.RIGHT, CyanMelody) { onHandChange(PlaybackHand.RIGHT) }
                if (isLandscape) {
                    HandButton(
                        when (clefMode) {
                            ClefMode.STANDARD -> "Sol+Fa"
                            ClefMode.TREBLE_X2 -> "Sol×2"
                            ClefMode.AUTO -> "Auto"
                        },
                        selected = true, activeColor = IndigoAccent, onClick = onCycleClef
                    )
                }
            }

            // Center: Tempo control + métronome + loop + wait
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                IconButton(onClick = onToggleMetronome, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.MusicNote, "Métronome", tint = if (isMetronomeEnabled) IndigoAccent else Color(0xFF475569), modifier = Modifier.size(14.dp))
                }
                val tempoTint = if (isPlaying) Color(0xFF334155) else Color(0xFF94A3B8)
                IconButton(onClick = { onTempoAdjust(-0.1f) }, enabled = !isPlaying, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Remove, null, tint = tempoTint, modifier = Modifier.size(14.dp))
                }
                Text(
                    "${(tempoPercent * 100).toInt()}%",
                    color = if (tempoPercent != 1.0f) IndigoAccent else Color.White,
                    fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.widthIn(min = 36.dp), textAlign = TextAlign.Center
                )
                IconButton(onClick = { onTempoAdjust(0.1f) }, enabled = !isPlaying, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Add, null, tint = tempoTint, modifier = Modifier.size(14.dp))
                }
                IconButton(onClick = onToggleLoop, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Repeat, "Boucle", tint = if (isLooping) AmberWarning else Color(0xFF475569), modifier = Modifier.size(14.dp))
                }
                IconButton(onClick = onToggleWaitMode, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.PanTool, "Attente", tint = if (waitMode) Color(0xFF4ADE80) else Color(0xFF475569), modifier = Modifier.size(14.dp))
                }
            }

            // Right: Playback controls (no individual backgrounds except Play)
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.End),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isLandscape) {
                    IconButton(
                        onClick = onToggleDetails,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(Icons.Default.Info, "Détails", tint = if (showDetails) IndigoAccent else Color(0xFF64748B), modifier = Modifier.size(14.dp))
                    }
                }
                IconButton(
                    onClick = onStop,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(Icons.Default.Stop, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(14.dp))
                }
                IconButton(
                    onClick = onPlay,
                    modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(IndigoAccent)
                ) {
                    Icon(if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(18.dp))
                }
                IconButton(
                    onClick = onSplit,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(Icons.Default.ContentCut, "Diviser", tint = Color(0xFF64748B), modifier = Modifier.size(14.dp))
                }
            }
        }

        if (isLooping) {
            LoopRangeRow(loopStart, loopEnd, totalMeasures, onLoopRangeChange)
        }
    }
}

@Composable
private fun HandButton(label: String, selected: Boolean, activeColor: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (selected) activeColor.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.06f))
            .then(if (selected) Modifier.border(1.dp, activeColor, RoundedCornerShape(6.dp)) else Modifier)
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 5.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, fontSize = 11.sp, color = if (selected) activeColor else Color(0xFF64748B), fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LoopRangeRow(loopStart: Int, loopEnd: Int, totalMeasures: Int, onRangeChange: (Int, Int) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Text("Boucle", fontSize = 10.sp, color = AmberWarning, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(8.dp))
        Text("m.", fontSize = 10.sp, color = Color(0xFF64748B))
        Spacer(Modifier.width(4.dp))
        MeasureStepper(
            value = loopStart + 1,
            onDecrement = { if (loopStart > 0) onRangeChange(loopStart - 1, loopEnd) },
            onIncrement = { if (loopStart < loopEnd) onRangeChange(loopStart + 1, loopEnd) }
        )
        Text("→", fontSize = 10.sp, color = Color(0xFF64748B), modifier = Modifier.padding(horizontal = 6.dp))
        MeasureStepper(
            value = loopEnd + 1,
            onDecrement = { if (loopEnd > loopStart) onRangeChange(loopStart, loopEnd - 1) },
            onIncrement = { if (loopEnd < totalMeasures - 1) onRangeChange(loopStart, loopEnd + 1) }
        )
        Spacer(Modifier.width(4.dp))
        Text("/ $totalMeasures", fontSize = 10.sp, color = Color(0xFF475569))
    }
}

@Composable
private fun MeasureStepper(value: Int, onDecrement: () -> Unit, onIncrement: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onDecrement, modifier = Modifier.size(24.dp)) {
            Icon(Icons.Default.Remove, null, tint = AmberWarning, modifier = Modifier.size(11.dp))
        }
        Text("$value", fontSize = 12.sp, color = AmberWarning, fontWeight = FontWeight.Bold, modifier = Modifier.widthIn(min = 22.dp), textAlign = TextAlign.Center)
        IconButton(onClick = onIncrement, modifier = Modifier.size(24.dp)) {
            Icon(Icons.Default.Add, null, tint = AmberWarning, modifier = Modifier.size(11.dp))
        }
    }
}
