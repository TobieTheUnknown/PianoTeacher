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
import com.tobietheunknown.pianoteacher.utils.displayCycleLen
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import com.tobietheunknown.pianoteacher.utils.midiToFrench
import kotlin.math.abs
import androidx.compose.ui.graphics.drawscope.withTransform

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

// ─── Duration engraving (ported from web/src/utils/sheetMusic.js) ─────────────
//   filled — solid notehead (quarter and shorter) vs hollow (half / whole)
//   stem   — whether the note carries a stem (whole notes don't)
//   flags  — number of flags (0 = quarter+, 1 = eighth, 2 = sixteenth…)
private data class NoteDuration(
    val filled: Boolean,
    val stem: Boolean,
    val flags: Int,
    val dotted: Boolean,
)

private fun classifyDuration(durationBeats: Double): NoteDuration {
    val d = if (durationBeats > 0.0) durationBeats else 1.0
    // Base values in quarter-note beats: whole=4, half=2, quarter=1, eighth=0.5…
    data class Base(val beats: Double, val filled: Boolean, val stem: Boolean, val flags: Int)
    val bases = listOf(
        Base(4.0, false, false, 0),   // whole
        Base(2.0, false, true, 0),    // half
        Base(1.0, true, true, 0),     // quarter
        Base(0.5, true, true, 1),     // eighth
        Base(0.25, true, true, 2),    // sixteenth
        Base(0.125, true, true, 3),
    )
    var best = bases[2]
    var bestErr = Double.POSITIVE_INFINITY
    var dotted = false
    for (base in bases) {
        var err = abs(d - base.beats) / base.beats
        if (err < bestErr) { bestErr = err; best = base; dotted = false }
        err = abs(d - base.beats * 1.5) / (base.beats * 1.5)
        if (err < bestErr) { bestErr = err; best = base; dotted = true }
    }
    return NoteDuration(best.filled, best.stem, best.flags, dotted)
}

// ─── Beam grouping (ported from web/src/utils/sheetMusic.js) ──────────────────
//
// Partition a time-ordered list of beamable chord-items (eighth or shorter, i.e.
// dur.stem && dur.flags >= 1) into beam groups for a single staff. Each item
// exposes startBeat / durationBeats / flags; the result is a list of groups,
// each an ascending list of indices INTO `items`.
//
// A group ends (the next item starts a fresh group) when any cut rule holds:
//   (a) time gap: next.startBeat > cur.startBeat + cur.durationBeats + 0.03
//       — a rest or non-adjacent note sits between them. Non-beamable notes
//       (quarter or longer) are absent from `items`, so an intervening quarter
//       manifests here as a gap.
//   (b) beat-pair boundary: floor(startBeat / 2) changes — groups never cross
//       the 1-2 → 3-4 half-bar boundary in 4/4. Runs whose items are ALL
//       sixteenths-or-shorter (flags >= 2) cut per single beat instead.
private data class BeamItem(val startBeat: Double, val durationBeats: Double, val flags: Int)

private fun computeBeamGroups(items: List<BeamItem>): List<List<Int>> {
    val groups = mutableListOf<List<Int>>()
    var cur = mutableListOf<Int>()
    for (i in items.indices) {
        if (cur.isEmpty()) { cur = mutableListOf(i); continue }
        val prev = items[cur.last()]
        val it = items[i]
        // (a) time gap.
        val gap = it.startBeat > prev.startBeat + prev.durationBeats + 0.03
        // (b) beat boundary. Sixteenth-only runs cut per beat, else per beat-pair.
        val sixteenthRun = cur.all { items[it].flags >= 2 } && it.flags >= 2
        val beatUnit = if (sixteenthRun) 1.0 else 2.0
        val crossedBeat =
            kotlin.math.floor(it.startBeat / beatUnit) != kotlin.math.floor(prev.startBeat / beatUnit)
        if (gap || crossedBeat) {
            groups.add(cur)
            cur = mutableListOf(i)
        } else {
            cur.add(i)
        }
    }
    if (cur.isNotEmpty()) groups.add(cur)
    return groups
}

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

    // Fixed-zoom window size across the whole song so the bottom keyboard
    // doesn't re-scale every time the focused measure changes — same logic
    // as the Apprentissage screen.
    val keyboardSpan = remember(allMeasures) {
        com.tobietheunknown.pianoteacher.ui.common.fixedKeyboardRange(
            allMeasures.mapNotNull { m ->
                val all = m.melodyNotes + m.chordNotes
                if (all.isEmpty()) null
                else all.minOf { it.pitch } to all.maxOf { it.pitch }
            }
        )
    }
    val activeRightPitches = remember(focusedMeasureData) {
        focusedMeasureData?.melodyNotes?.map { it.pitch }?.toSet() ?: emptySet()
    }
    val activeLeftPitches = remember(focusedMeasureData) {
        focusedMeasureData?.chordNotes?.map { it.pitch }?.toSet() ?: emptySet()
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
                                    color = TextPrimary,
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
                                    color = TextSecondary,
                                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        },
                        navigationIcon = {
                            IconButton(onClick = onBack) {
                                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = TextPrimary)
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
                                    color = if (showOctaves) IndigoAccent else TextTertiary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            TextButton(onClick = vm::toggleDetails) {
                                Text(
                                    "Détails",
                                    color = if (showDetails) IndigoAccent else TextTertiary,
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
                    com.tobietheunknown.pianoteacher.ui.common.MiniKeyboard(
                        activeRight = activeRightPitches,
                        activeLeft = activeLeftPitches,
                        fixedRange = keyboardSpan,
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
                        phrases = remember(song) {
                            val list = song?.phrases ?: emptyList()
                            var start = 1
                            list.mapIndexed { i, p ->
                                val end = start + p.length - 1
                                val r = com.tobietheunknown.pianoteacher.ui.common.PhraseRange(
                                    p.name.ifBlank { "Phrase ${i + 1}" }, start, end,
                                )
                                start = end + 1
                                r
                            }
                        },
                        onPrev = { /* TODO: prev measure/phrase */ },
                        onNext = { /* TODO: next measure/phrase */ },
                        // Recommencer: stop playback and return to the first measure.
                        onRestart = {
                            vm.stop()
                            vm.focusMeasure(0)
                        },
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
                    Icon(Icons.Default.MusicOff, null, modifier = Modifier.size(48.dp), tint = TextMuted)
                    Spacer(Modifier.height(12.dp))
                    Text("Aucune phrase trouvée", color = TextTertiary, fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(4.dp))
                    Text("Supprime ce morceau et réimporte-le", fontSize = 12.sp, color = TextMuted)
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
                // Page-constant key-signature accidental count. Key signatures
                // only render in fixed-clef modes (not AUTO). Reserved as header
                // space on every card so all systems share one barline grid.
                val pageAccidentalCount =
                    if (clefMode != ClefMode.AUTO) keySignatureAccidentalCount(keySignature) else 0
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
                                    vm.playMeasureSingle(measure.globalIndex)
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
                                    color = if (isPlaying) IndigoAccent else TextMuted,
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
                                    showDetails = showDetails,
                                    pageAccidentalCount = pageAccidentalCount,
                                    timeSigNumerator = song!!.timeSignature.numerator,
                                    timeSigDenominator = song!!.timeSignature.denominator,
                                    isFirstSystem = idx == 0,
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
                                        // Replicate the EXACT same time→x mapping as GrandStaffCanvas
                                        // so the playhead tracks noteheads precisely even on clef cards.
                                        //
                                        // Formula mirrors GrandStaffCanvas (keep in sync if that changes):
                                        //   lineSpacing = (h / 17).clamp(7dp, staffHMax/4)
                                        //   staffH      = lineSpacing * 4
                                        //   pureClefW   = max(staffH * 0.26, 22dp)
                                        //   pageKsW     = pageAccidentalCount * 9dp + 5dp  (or 0)
                                        //   tsW         = lineSpacing * 2.4 + 6dp          (or 0, AUTO)
                                        //   trailingPad = 8dp
                                        //   headerWidth = pureClefW + pageKsW + tsW + trailingPad (clef cards)
                                        //                 0                                         (non-clef)
                                        //   barPad      = 10dp
                                        //   dotR        = lineSpacing * (landscape ? 0.45 : 0.42)
                                        //   leftPad     = barPad + dotR * 2
                                        //   noteAreaStart = headerWidth + leftPad
                                        //   noteAreaEnd   = w - barPad - dotR
                                        val w = size.width
                                        val h = size.height
                                        val numAreaH = STAFF_NUM_AREA_DP.dp.toPx()
                                        val topPad   = numAreaH + 8.dp.toPx()
                                        val botPad   = STAFF_BOTTOM_PAD_DP.dp.toPx()
                                        val avail    = h - topPad - botPad
                                        val staffHMax = if (isLandscape) 70.dp.toPx() else STAFF_H_MAX_DP.dp.toPx()
                                        val ls = (avail / 17f).coerceAtMost(staffHMax / 4f).coerceAtLeast(7.dp.toPx())
                                        val sH = ls * 4f
                                        val pClefW = (sH * 0.26f).coerceAtLeast(22.dp.toPx())
                                        val pKsW = if (pageAccidentalCount > 0) pageAccidentalCount * 9.dp.toPx() + 5.dp.toPx() else 0f
                                        val tW = if (clefMode != ClefMode.AUTO) ls * 2.4f + 6.dp.toPx() else 0f
                                        val hdrW = if (showClefs) pClefW + pKsW + tW + 8.dp.toPx() else 0f
                                        val bPad = 10.dp.toPx()
                                        val dR = ls * (if (isLandscape) 0.45f else 0.42f)
                                        val noteAreaStart = hdrW + bPad + dR * 2f
                                        val noteAreaEnd   = w - bPad - dR
                                        val x = noteAreaStart + frac * (noteAreaEnd - noteAreaStart)
                                        val haloW = 8.dp.toPx() * 2f
                                        drawRect(
                                            color = haloColor,
                                            topLeft = androidx.compose.ui.geometry.Offset(x - haloW / 2f, 0f),
                                            size = androidx.compose.ui.geometry.Size(haloW, size.height),
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
                            Text("Supprimer", color = if (canDelete) Error else TextTertiary)
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
            color = if (isPlaying) IndigoAccent else TextMuted,
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
    showDetails: Boolean = false,
    // Page-constant key-signature accidental count: reserved as header space on
    // EVERY card (even non-clef ones) so all 4 measures of a row share one grid.
    pageAccidentalCount: Int = 0,
    // Song time signature — drawn on the first system only, reserved everywhere.
    timeSigNumerator: Int = 4,
    timeSigDenominator: Int = 4,
    // True only for the very first measure of the page → actually draws the
    // time signature glyphs after the key signature.
    isFirstSystem: Boolean = false,
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

        // 2 staves of 4 lineSpacings + gap of 2 lineSpacings + 7 headroom steps = 17 lineSpacings total.
        // Web formula: lineSpacing = max(dp(7), min(totalAvail / (10 + 2 * 3.5), staffHMax / 4))
        //   i.e. totalAvail / 17, clamped to staffHMax/4 and floored at 7dp.
        val totalAvail   = h - topPad - bottomPad
        val staffHMax    = if (isLandscape) 70.dp.toPx() else STAFF_H_MAX_DP.dp.toPx()
        val lineSpacing  = (totalAvail / 17f).coerceAtMost(staffHMax / 4f).coerceAtLeast(7.dp.toPx())
        val staffH       = lineSpacing * 4f
        val gap          = lineSpacing * 2f  // exactly 2 line spacings → middle C falls between staves
        val totalStavesH = staffH * 2 + gap
        val stavesOriginY = topPad + (totalAvail - totalStavesH) / 2f

        // ── Header width (clef + armure + time signature) ──────────────────
        // The musical time→x mapping must start AFTER the clef + key signature
        // (+ time signature on system 1). To keep all 4 measures of a row the
        // SAME pixel width — so barlines form a clean 4-column grid aligned
        // across every system — we reserve ONE page-constant headerWidth on
        // EVERY card. Cards that draw clefs fill it with clef/armure/time-sig;
        // the others simply leave it empty.
        //
        //   pureClefW   = clef glyph zone        = max(staffH·0.26, 22dp)
        //   ksW         = key-sig accidental zone = count·9dp + 5dp  (web parity)
        //   tsW         = time-signature zone     = lineSpacing·2.4 + 6dp (web parity)
        //   trailingPad = breathing room after TS = 8dp (web parity)
        //   headerWidth = pureClefW + ksW + tsW + trailingPad (reserved on every system)
        val pureClefW = (staffH * 0.26f).coerceAtLeast(22.dp.toPx())
        // numAccidentals = what THIS card actually draws (clef cards only).
        val showKeySig = showClefs && clefMode != ClefMode.AUTO
        val numAccidentals = if (showKeySig) keySignatureAccidentalCount(keySig) else 0
        // Page-constant key-sig zone (reserved everywhere, even where not drawn).
        // Web: count * dp(9) + dp(5) — aligned to sheetMusic.js keySigBlockWidth().
        val pageKsW = if (pageAccidentalCount > 0) pageAccidentalCount * 9.dp.toPx() + 5.dp.toPx() else 0f
        // Time-signature zone — reserved on every system (drawn on the first).
        // Web: lineSpacing * 2.4 + dp(6) — aligned to sheetMusic.js timeSigZoneWidth().
        val tsW = if (clefMode != ClefMode.AUTO) lineSpacing * 2.4f + 6.dp.toPx() else 0f
        // Trailing pad before the first note (web: dp(8)).
        val trailingPad = 8.dp.toPx()
        // Header reserved on every card so the 4-column barline grid lines up.
        val headerWidth = pureClefW + pageKsW + tsW + trailingPad
        val barPad   = 10.dp.toPx()
        // dotR: web uses lineSpacing * (landscape ? 0.45 : 0.42) — aligned.
        val dotR     = lineSpacing * (if (isLandscape) 0.45f else 0.42f)

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
            color = if (isPlaying) IndigoAccent else TextTertiary,
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
            // Web: all lines neutral (rgba 255,255,255,0.14); key-anchor line
            // is rgba(255,255,255,0.22) at 1.1dp. Hand identity comes from
            // notehead colour, not from line colour.
            for (li in 0..4) {
                val y = lineTop + li * lineSpacing
                val lineDiatonic = clef.lines[4 - li]
                val isKey = (lineDiatonic == clef.keyDiatonic)
                drawLine(
                    color = if (isKey) Color.White.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.14f),
                    start = Offset(bracketX + 2.dp.toPx(), y),
                    end   = Offset(w, y),
                    strokeWidth = if (isKey) 1.1.dp.toPx() else 0.9.dp.toPx()
                )
            }

            // ── Clef glyph ──────────────────────────────────────────────
            // pureClefW (clef zone, no key signature) is defined once at the
            // canvas top so the header grid stays page-constant.
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
                    // Web: lineSpacing * 1.9 px — aligned.
                    val accStyle = TextStyle(
                        fontSize = (lineSpacing * 1.9f / density).sp,
                        color = Color.White.copy(alpha = 0.6f),
                    )
                    // Web: ax = pureClefW + dp(3) + i * dp(9), ay uses textBaseline='middle'.
                    val topD = clef.lines.last()
                    for (i in 0 until numAccidentals) {
                        val d = positions[i]
                        val accLayout = textMeasurer.measure(accLabel, accStyle)
                        val ax = pureClefW + 3.dp.toPx() + i * 9.dp.toPx()
                        val ay = lineTop + (topD - d) * (lineSpacing / 2f) - accLayout.size.height * 0.45f
                        drawText(accLayout, topLeft = Offset(ax, ay))
                    }
                }

                // ── Time signature (FIRST system only) ────────────────────
                // Web: bold serif, lineSpacing*2 font; numerator centred at
                // staffMidY - lineSpacing, denominator at staffMidY + lineSpacing
                // (staffMidY = lineTop + 2*lineSpacing = the middle/3rd line).
                // tsW zone starts after the (page-constant) key signature + dp(2) gap.
                if (isFirstSystem && tsW > 0f) {
                    val tsStyle = TextStyle(
                        fontSize = (lineSpacing * 2f / density).sp,
                        color = Color.White.copy(alpha = 0.6f),
                        fontWeight = FontWeight.Bold,
                    )
                    val numLayout = textMeasurer.measure(timeSigNumerator.toString(), tsStyle)
                    val denLayout = textMeasurer.measure(timeSigDenominator.toString(), tsStyle)
                    val tsZoneStart = pureClefW + pageKsW + 2.dp.toPx()
                    // Center the digit column inside tsW, matching web's digitCenterX.
                    val tsCenterX = tsZoneStart + (tsW - 3.dp.toPx()) / 2f
                    // Web: numerator at staffMidY - lineSpacing, denominator at +lineSpacing
                    val staffMidY = lineTop + 2f * lineSpacing  // middle (3rd) line
                    drawText(
                        numLayout,
                        topLeft = Offset(
                            tsCenterX - numLayout.size.width / 2f,
                            staffMidY - lineSpacing - numLayout.size.height / 2f,
                        )
                    )
                    drawText(
                        denLayout,
                        topLeft = Offset(
                            tsCenterX - denLayout.size.width / 2f,
                            staffMidY + lineSpacing - denLayout.size.height / 2f,
                        )
                    )
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
            // Geometry helpers shared by every notehead on this staff.
            // Music starts after the page-constant headerWidth (clef + armure +
            // time-sig zone), NOT after this card's own clef — so all 4 measures
            // of a row are pixel-equal and barlines align across every system.
            val leftPad = barPad + dotR * 2f  // extra space from left bar line
            val noteAreaStart = headerWidth + leftPad
            val noteAreaEnd = w - barPad - dotR
            val midLineY = lineTop + 2 * lineSpacing  // middle (3rd) staff line

            // Per-note resolved geometry + duration class.
            val resolved = staffNotesList[si].map { (note, color) ->
                val d = midiToDiatonic(note.pitch, useFlats) + octShift
                val frac = (note.startTime / beatsPerMeasure).toFloat().coerceIn(0f, 1f)
                val x = noteAreaStart + frac * (noteAreaEnd - noteAreaStart)
                val y = lineTop + (topDiatonic - d) * (lineSpacing / 2f)
                // note.startTime is already measure-relative beats (0 ≤ t < beatsPerMeasure).
                StaffNote(d, x, y, classifyDuration(note.duration), note.pitch, color,
                    note.startTime, note.duration)
            }

            // Group notes sounding at the same beat into chords (shared stem).
            // Quantise x to a pixel so FP startTime noise still groups cleanly.
            val groups = resolved.groupBy { kotlin.math.round(it.x).toInt() }

            // On small Android cards the staff can compress to <8px line
            // spacing; scale the stem factor down like the web so stems don't
            // dwarf the noteheads. (≤8dp lineSpacing → 2.6× instead of 3.2×.)
            val isCompact = lineSpacing <= 8.dp.toPx()
            val stemFactor = if (isCompact) 2.6f else 3.2f
            val stemLenBase = lineSpacing * stemFactor

            // Notehead radii — web: headRx = dotR * 1.08, headRy = dotR * 0.84.
            // The notehead is an ellipse rotated -0.32 rad (≈18°) for the engraved look.
            val headRx = dotR * 1.08f
            val headRy = dotR * 0.84f

            // Helper: draw a rotated-ellipse notehead (web parity).
            // Compose Canvas doesn't support ellipse natively, so we use scale+circle.
            // Captures DrawScope explicitly so it can be called from nested lambdas.
            val hollowStrokeW = 1.7.dp.toPx()
            val scope: androidx.compose.ui.graphics.drawscope.DrawScope = this
            fun drawHead(cx: Float, cy: Float, filled: Boolean, headColor: Color) {
                scope.withTransform({
                    translate(cx, cy)
                    rotate(degrees = -18.35f, pivot = Offset.Zero)  // -0.32 rad ≈ -18.35°
                    scale(scaleX = headRx / headRy, scaleY = 1f, pivot = Offset.Zero)
                }) {
                    if (filled) {
                        drawCircle(color = headColor, radius = headRy, center = Offset.Zero)
                    } else {
                        drawCircle(
                            color = headColor, radius = headRy, center = Offset.Zero,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(width = hollowStrokeW),
                        )
                    }
                }
            }

            val chordRenders = mutableListOf<ChordRender>()

            groups.forEach { (_, chord) ->
                val items = chord.sortedBy { it.d }  // bottom → top
                val x = items.first().x

                // ── Stem direction (decided up-front so chord-second offsets
                // can push heads to the correct side of the stem). ──────────
                val anyStem = items.any { it.dur.stem }
                val centerY = items.map { it.y }.average().toFloat()
                val up = centerY >= midLineY

                // ── Chord-second resolution. Two noteheads on ADJACENT
                // diatonic steps (|Δd| == 1) collide if drawn at the same x.
                // Offset ONE of the pair to the OPPOSITE side of the stem:
                //   stem-up   → the UPPER note of the pair moves RIGHT of the stem
                //   stem-down → the LOWER note of the pair moves LEFT of the stem
                // Walk bottom→top; when the previous head wasn't itself offset
                // and this note is one step above it, offset whichever of the
                // pair the rule selects. headDx[i] = horizontal shift for head i.
                // Web: offset = headRx * 1.7 (full notehead width to the other side).
                val headDx = FloatArray(items.size)
                val headSecondOffset = headRx * 1.7f
                run {
                    var i = 1
                    while (i < items.size) {
                        val collides = (items[i].d - items[i - 1].d) == 1 &&
                            headDx[i - 1] == 0f
                        if (collides) {
                            if (up) headDx[i] = headSecondOffset      // upper → right
                            else    headDx[i - 1] = -headSecondOffset // lower → left
                            i += 2  // pair consumed
                        } else {
                            i += 1
                        }
                    }
                }

                // Noteheads + ledger lines + dots + accidentals per note.
                items.forEachIndexed { idx2, it2 ->
                    val hx = it2.x + headDx[idx2]   // head x after second-offset
                    // Notehead: filled (solid) for ≤ quarter, hollow (ring) for ≥ half.
                    // Each note of a chord uses its OWN duration's head style.
                    drawHead(hx, it2.y, it2.dur.filled, it2.color)  // rotated ellipse, web parity

                    // Ledger lines (only when note is ≥2 diatonic steps outside
                    // staff). Web: lx0 = min(x, x+headDx) - headRx - dp(2),
                    //              lx1 = max(x, x+headDx) + headRx + dp(2)
                    val lx0 = kotlin.math.min(it2.x, hx) - headRx - 2.dp.toPx()
                    val lx1 = kotlin.math.max(it2.x, hx) + headRx + 2.dp.toPx()
                    if (it2.d > topDiatonic + 1) {
                        var ld = topDiatonic + 2
                        while (ld <= it2.d) {
                            val ly = lineTop + (topDiatonic - ld) * (lineSpacing / 2f)
                            drawLine(Color.White.copy(alpha = 0.45f),
                                Offset(lx0, ly), Offset(lx1, ly), 1.dp.toPx())
                            ld += 2
                        }
                    }
                    if (it2.d < bottomDiatonic - 1) {
                        var ld = bottomDiatonic - 2
                        while (ld >= it2.d) {
                            val ly = lineTop + (topDiatonic - ld) * (lineSpacing / 2f)
                            drawLine(Color.White.copy(alpha = 0.45f),
                                Offset(lx0, ly), Offset(lx1, ly), 1.dp.toPx())
                            ld -= 2
                        }
                    }

                    // Augmentation dot (showDetails gate matches web's showStems check).
                    // Web: arc at x+headDx+headRx+dp(4), y + (onLine ? -lineSpacing/2 : 0),
                    //      radius dp(1.6). Line notes nudge dot up into nearest space.
                    if (showDetails && it2.dur.dotted) {
                        val onLine = ((topDiatonic - it2.d) % 2) == 0
                        val dotDy = if (onLine) -lineSpacing / 2f else 0f
                        drawCircle(
                            color = it2.color,
                            radius = 1.6f.dp.toPx(),
                            center = Offset(hx + headRx + 4.dp.toPx(), it2.y + dotDy),
                        )
                    }

                    // Accidental (♯/♭). Web: proper Unicode glyphs at
                    //   x = x + max(0,dx) + headRx + dp(1)
                    //   y = noteY − lineSpacing * 0.55  (alphabetic baseline)
                    //   font: lineSpacing * 1.3 px
                    if (isBlackKey(it2.pitch)) {
                        val accLabel = if (useFlats) "♭" else "♯"
                        val accStyle = TextStyle(
                            fontSize = (lineSpacing * 1.3f / density).sp,
                            color = it2.color,
                        )
                        val accLayout = textMeasurer.measure(accLabel, accStyle)
                        // Web positions with textBaseline='alphabetic'; approximate:
                        // alphabetic baseline ≈ topLeft.y + height * 0.8 (ascent fraction).
                        val baselineY = it2.y - lineSpacing * 0.55f
                        val accTopY = baselineY - accLayout.size.height * 0.8f
                        val accX = kotlin.math.max(hx, it2.x) + headRx + 1.dp.toPx()
                        drawText(accLayout, topLeft = Offset(accX, accTopY))
                    }
                }

                // Record stem geometry for this chord (decided once, consumed
                // by the stem/flag pass and the beam pass below). topY/botY are
                // the extremes of the STEMMED notes so the shared stem spans
                // lowest→highest notehead that actually carries a stem.
                val stemmed = items.filter { it.dur.stem }
                val refItems = if (stemmed.isNotEmpty()) stemmed else items
                chordRenders.add(
                    ChordRender(
                        items = items,
                        x = x,
                        startBeat = items.first().startBeat,
                        durBeats = items.first().durBeats,
                        flags = items.maxOf { it.dur.flags },
                        anyStem = anyStem,
                        stemColor = items.first().color,
                        centerY = centerY,
                        topY = refItems.maxByOrNull { it.d }!!.y,  // highest stemmed (smallest y)
                        botY = refItems.minByOrNull { it.d }!!.y,  // lowest stemmed (largest y)
                    )
                )
            }

            // ── Stems, flags & BEAMS — Détail layer only. ─────────────────
            if (showDetails) {
                drawStemsAndBeams(
                    chords = chordRenders,
                    midLineY = midLineY,
                    lineSpacing = lineSpacing,
                    headRx = headRx,
                    headRy = headRy,
                    stemLenBase = stemLenBase,
                    dpHalf = 0.5.dp.toPx(),
                    stemWidth = 0.9.dp.toPx(),  // deliberate: user requested 0.9dp thin stems
                    // Flag curve control points (web: dp(7), dp(5), dp(6)).
                    flag7 = 7.dp.toPx(),
                    flag5 = 5.dp.toPx(),
                    flag6 = 6.dp.toPx(),
                )
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

// ─── Stem / flag / beam render records & engraver ─────────────────────────────

// Per-note resolved geometry + duration class (one staff note on the canvas).
private data class StaffNote(
    val d: Int, val x: Float, val y: Float,
    val dur: NoteDuration, val pitch: Int, val color: Color,
    val startBeat: Double, val durBeats: Double,
)

// One shared-stem chord (notes quantised to the same x). Stem geometry is
// decided by the caller and consumed by the standalone-stem and beam passes.
private data class ChordRender(
    val items: List<StaffNote>,
    val x: Float,
    val startBeat: Double,
    val durBeats: Double,
    val flags: Int,
    val anyStem: Boolean,
    val stemColor: Color,
    val centerY: Float,   // avg notehead y — used for the majority vote
    val topY: Float,      // highest note (smallest y)
    val botY: Float,      // lowest note (largest y)
)

/**
 * Draw the Détail-layer stems, flags and beams for one staff.
 *
 * Mirrors the web beam spec:
 *  • Non-beamable stemmed chords (quarter/half, flags == 0) → plain shared stem.
 *  • Beamable chords (anyStem && flags ≥ 1), in time order → partitioned by
 *    computeBeamGroups. Singletons keep flags; groups ≥ 2 drop flags and get a
 *    beam: majority-vote direction (ties up), first/last stem tips anchor the
 *    beam line (slope clamped ≤ 0.5×lineSpacing), intermediate stems extend to
 *    the interpolated line, the whole beam pushes outward if any stem < 2.5×
 *    lineSpacing. Primary beam = filled quad ≈0.5×lineSpacing thick; secondary
 *    beam (flags ≥ 2) 0.75×lineSpacing inward between adjacent 16ths, isolated
 *    16th gets a 0.6×lineSpacing stub toward its neighbour.
 */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawStemsAndBeams(
    chords: List<ChordRender>,
    midLineY: Float,
    lineSpacing: Float,
    headRx: Float,     // notehead half-width (web: dotR * 1.08)
    headRy: Float,     // notehead half-height (web: dotR * 0.84)
    stemLenBase: Float,
    dpHalf: Float,
    stemWidth: Float,
    flag7: Float,
    flag5: Float,
    flag6: Float,
) {
    // Helper: where the stem meets the notehead block, given direction.
    // Web: yAttach = stemUp ? botY - headRy : topY + headRy
    fun attachY(c: ChordRender, up: Boolean) = if (up) c.topY - headRy else c.botY + headRy
    // Helper: the stem's x (right edge of head for up, left for down).
    // Web: stemX = stemUp ? x + headRx - dp(0.5) : x - headRx + dp(0.5)
    fun stemX(c: ChordRender, up: Boolean) = if (up) c.x + headRx - dpHalf else c.x - headRx + dpHalf
    // Nominal free-tip y for a standalone stem (clears the whole chord).
    fun nominalTip(c: ChordRender, up: Boolean) =
        if (up) c.botY - stemLenBase else c.topY + stemLenBase

    // Draw a plain shared stem (no flag) — quarters/halves and the trunk of any
    // chord whose flag/beam is handled separately.
    fun drawPlainStem(c: ChordRender, up: Boolean, tipY: Float) {
        drawLine(
            color = c.stemColor,
            start = Offset(stemX(c, up), attachY(c, up)),
            end = Offset(stemX(c, up), tipY),
            strokeWidth = stemWidth,
        )
    }

    // Draw the curved flag hook(s) at a standalone stem tip.
    fun drawFlags(c: ChordRender, up: Boolean, tipY: Float) {
        val dir = if (up) 1f else -1f
        val sx = stemX(c, up)
        for (f in 0 until c.flags) {
            val fy = tipY + f * lineSpacing * 0.9f * dir
            val flagPath = androidx.compose.ui.graphics.Path().apply {
                moveTo(sx, fy)
                quadraticTo(sx + flag7, fy + dir * lineSpacing * 0.5f, sx + flag5, fy + dir * lineSpacing * 1.3f)
                quadraticTo(sx + flag6, fy + dir * lineSpacing * 0.6f, sx, fy + dir * lineSpacing * 0.35f)
                close()
            }
            drawPath(flagPath, color = c.stemColor)
        }
    }

    // ── Non-beamable stemmed chords (flags == 0): plain stems. ──
    chords.filter { it.anyStem && it.flags == 0 }.forEach { c ->
        val up = c.centerY >= midLineY
        drawPlainStem(c, up, nominalTip(c, up))
    }

    // ── Beamable chords in time order. ──
    val beamable = chords.filter { it.anyStem && it.flags >= 1 }
        .sortedBy { it.startBeat }
    if (beamable.isEmpty()) return

    val beamItems = beamable.map { BeamItem(it.startBeat, it.durBeats, it.flags) }
    val groups = computeBeamGroups(beamItems)

    // Web: beamTh = lineSpacing * 0.5 — aligned.
    val beamThickness = lineSpacing * 0.5f

    for (group in groups) {
        val gChords = group.map { beamable[it] }

        if (gChords.size == 1) {
            // Singleton — keep the flag.
            val c = gChords[0]
            val up = c.centerY >= midLineY
            val tip = nominalTip(c, up)
            drawPlainStem(c, up, tip)
            drawFlags(c, up, tip)
            continue
        }

        // ── Group beam. Majority-vote direction (ties up). ──
        val upVotes = gChords.count { it.centerY >= midLineY }
        val up = upVotes * 2 >= gChords.size  // ties → up
        val dir = if (up) -1f else 1f         // beam offset direction from notehead

        // Anchor the beam line at the first and last nominal tips, then clamp
        // the slope to ≤ 0.5×lineSpacing total span.
        // Web: preserve the longer stem, adjust the shorter one.
        val first = gChords.first()
        val last = gChords.last()
        val x0 = stemX(first, up)
        val x1 = stemX(last, up)
        var y0 = nominalTip(first, up)
        var y1 = nominalTip(last, up)
        val maxSlope = lineSpacing * 0.5f
        val dy = y1 - y0
        if (kotlin.math.abs(dy) > maxSlope) {
            val target = kotlin.math.sign(dy) * maxSlope
            val lenFirst = kotlin.math.abs(y0 - attachY(first, up))
            val lenLast  = kotlin.math.abs(y1 - attachY(last, up))
            if (lenFirst <= lenLast) {
                y0 = y1 - target   // first end shorter → move it
            } else {
                y1 = y0 + target   // last end shorter → move it
            }
        }

        // Interpolated beam y at an arbitrary x.
        fun beamYAt(x: Float): Float {
            if (x1 == x0) return y0
            val t = (x - x0) / (x1 - x0)
            return y0 + (y1 - y0) * t
        }

        // Ensure every stem reaches ≥ MIN_STEM_FACTOR×lineSpacing; push the
        // whole beam outward if any stem is too short.
        // Web: compact (lineSpacing≤dp(8)) → 2.1×, normal → 2.5×.
        val minStemFactor = if (lineSpacing <= 8.dp.toPx()) 2.1f else 2.5f
        val minStem = lineSpacing * minStemFactor
        var push = 0f
        for (c in gChords) {
            val by = beamYAt(stemX(c, up))
            val len = kotlin.math.abs(by - attachY(c, up))
            if (len < minStem) push = kotlin.math.max(push, minStem - len)
        }
        if (push > 0f) {
            // dir is -1 for up-stems (beam above, smaller y) → push further up.
            y0 += dir * push
            y1 += dir * push
        }

        // ── Per-stem: extend each shared stem to the beam line. ──
        for (c in gChords) {
            val sx = stemX(c, up)
            val by = beamYAt(sx)
            drawPlainStem(c, up, by)
        }

        // ── Primary beam: filled quadrilateral between the first & last tips. ──
        val px0 = stemX(first, up)
        val px1 = stemX(last, up)
        val py0 = beamYAt(px0)
        val py1 = beamYAt(px1)
        // Dominant-hand colour: most common stem colour in the group.
        val beamColor = gChords.groupingBy { it.stemColor }.eachCount()
            .maxByOrNull { it.value }!!.key
        // Thickness grows toward the noteheads (opposite the outward `dir`).
        val inward = -dir
        val thick = beamThickness * inward
        val primary = androidx.compose.ui.graphics.Path().apply {
            moveTo(px0, py0)
            lineTo(px1, py1)
            lineTo(px1, py1 + thick)
            lineTo(px0, py0 + thick)
            close()
        }
        drawPath(primary, color = beamColor)

        // ── Secondary beams for 16ths (flags ≥ 2). ──
        // Inward = toward the noteheads from the primary beam.
        val secOffset = (beamThickness + lineSpacing * 0.25f) * inward  // 0.75×ls inward edge
        val sixteenths = gChords.withIndex().filter { it.value.flags >= 2 }.map { it.index }
        if (sixteenths.isNotEmpty()) {
            // Draw full secondary segments between adjacent 16th items.
            val drawn = BooleanArray(gChords.size)
            for (k in 0 until sixteenths.size - 1) {
                val a = sixteenths[k]
                val b = sixteenths[k + 1]
                if (b == a + 1) {
                    val ax = stemX(gChords[a], up); val bx = stemX(gChords[b], up)
                    val ay = beamYAt(ax) + secOffset; val byy = beamYAt(bx) + secOffset
                    val sec = androidx.compose.ui.graphics.Path().apply {
                        moveTo(ax, ay); lineTo(bx, byy)
                        lineTo(bx, byy + thick); lineTo(ax, ay + thick); close()
                    }
                    drawPath(sec, color = beamColor)
                    drawn[a] = true; drawn[b] = true
                }
            }
            // Isolated 16ths get a short stub toward their neighbour.
            for (idx in sixteenths) {
                if (drawn[idx]) continue
                val c = gChords[idx]
                val sx = stemX(c, up)
                val sy = beamYAt(sx) + secOffset
                val toward = if (idx < gChords.size - 1) 1f else -1f
                val stub = lineSpacing * 0.6f * toward
                val sec = androidx.compose.ui.graphics.Path().apply {
                    moveTo(sx, sy); lineTo(sx + stub, sy)
                    lineTo(sx + stub, sy + thick); lineTo(sx, sy + thick); close()
                }
                drawPath(sec, color = beamColor)
            }
        }
    }
}

// ─── Note labels strip ────────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
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
                        // FlowRow: chips WRAP onto multiple lines (a plain Row
                        // never wraps — this was the unreadable single line).
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            Text("MD", fontSize = 11.sp, color = CyanMelody.copy(alpha = 0.7f), fontWeight = FontWeight.Bold)
                            measure.melodyNotes.map { it.pitch }.distinct()
                                .forEach { pitch -> NoteChip(midiToFrench(pitch, showOctaves, useFlats), CyanMelody) }
                        }
                    }
                    if (measure.chordInfo != null || measure.chordNotes.isNotEmpty()) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalArrangement = Arrangement.spacedBy(3.dp),
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
                midi in pressedKeys        -> Success            // green for MIDI input
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.52f)
                midi in activeLeftPitches  -> PinkChords.copy(alpha = 0.52f)
                else                       -> KeyWhite
            }
            drawRoundRect(color, Offset(wi * wkW + 0.5f, 0f), Size(wkW - 1f, size.height), CornerRadius(2f))
        }

        // Black keys — (semitone, rightWhiteIndex) pairs
        listOf(1 to 1, 3 to 2, 6 to 4, 8 to 5, 10 to 6).forEach { (semi, rw) ->
            val midi = cMidi + semi
            val color = when {
                midi in pressedKeys        -> Success.copy(alpha = 0.40f) // green tint, stays dark
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.18f)
                midi in activeLeftPitches  -> PinkChords.copy(alpha = 0.18f)
                else                       -> KeyBlack
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
                            // One WRAPPED row per cycle occurrence (web parity):
                            // FlowRow wraps; long cycles are chunked by the
                            // detected display cycle so the pattern reads as
                            // "Do Mib Sol Mib" / "Sol Mib Sol Mib" lines.
                            CycleNoteRows(cwr.cycleNotes, showOctaves, useFlats)
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
                // Full ordered sequence, one wrapped row per cycle occurrence
                // (was: first cycle only, on a single non-wrapping Row).
                CycleNoteRows(
                    chordNotes.sortedBy { it.startTime }.map { it.pitch },
                    showOctaves, useFlats,
                )
            }
        }
    }
}

/**
 * Note chips grouped one row per cycle occurrence (web MotifRows parity).
 * When a display cycle is detected the pitches are chunked by it — e.g.
 * Departure's 8 eighths → "Do Mib Sol Mib" / "Sol Mib Sol Mib". Each row is
 * a FlowRow so even a long cycle wraps instead of overflowing on one line.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CycleNoteRows(pitches: List<Int>, showOctaves: Boolean, useFlats: Boolean) {
    val cycleLen = displayCycleLen(pitches)
    val rows = if (cycleLen != null) pitches.chunked(cycleLen) else listOf(pitches)
    Column(
        verticalArrangement = Arrangement.spacedBy(2.dp),
        modifier = Modifier.padding(start = 8.dp),
    ) {
        rows.forEach { row ->
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                row.forEach { pitch -> NoteChip(midiToFrench(pitch, showOctaves, useFlats), PinkChords) }
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
                    Icon(Icons.Default.MusicNote, "Métronome", tint = if (isMetronomeEnabled) IndigoAccent else TextMuted, modifier = Modifier.size(14.dp))
                }
                val tempoTint = if (isPlaying) TextMuted else TextSecondary
                IconButton(onClick = { onTempoAdjust(-0.1f) }, enabled = !isPlaying, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Remove, null, tint = tempoTint, modifier = Modifier.size(14.dp))
                }
                Text(
                    "${(tempoPercent * 100).toInt()}%",
                    color = if (tempoPercent != 1.0f) IndigoAccent else TextPrimary,
                    fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.widthIn(min = 36.dp), textAlign = TextAlign.Center
                )
                IconButton(onClick = { onTempoAdjust(0.1f) }, enabled = !isPlaying, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Add, null, tint = tempoTint, modifier = Modifier.size(14.dp))
                }
                IconButton(onClick = onToggleLoop, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Repeat, "Boucle", tint = if (isLooping) AmberWarning else TextMuted, modifier = Modifier.size(14.dp))
                }
                IconButton(onClick = onToggleWaitMode, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.PanTool, "Attente", tint = if (waitMode) Success else TextMuted, modifier = Modifier.size(14.dp))
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
                        Icon(Icons.Default.Info, "Détails", tint = if (showDetails) IndigoAccent else TextTertiary, modifier = Modifier.size(14.dp))
                    }
                }
                IconButton(
                    onClick = onStop,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(Icons.Default.Stop, null, tint = TextSecondary, modifier = Modifier.size(14.dp))
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
                    Icon(Icons.Default.ContentCut, "Diviser", tint = TextTertiary, modifier = Modifier.size(14.dp))
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
        Text(label, fontSize = 11.sp, color = if (selected) activeColor else TextTertiary, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LoopRangeRow(loopStart: Int, loopEnd: Int, totalMeasures: Int, onRangeChange: (Int, Int) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Text("Boucle", fontSize = 10.sp, color = AmberWarning, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(8.dp))
        Text("m.", fontSize = 10.sp, color = TextTertiary)
        Spacer(Modifier.width(4.dp))
        MeasureStepper(
            value = loopStart + 1,
            onDecrement = { if (loopStart > 0) onRangeChange(loopStart - 1, loopEnd) },
            onIncrement = { if (loopStart < loopEnd) onRangeChange(loopStart + 1, loopEnd) }
        )
        Text("→", fontSize = 10.sp, color = TextTertiary, modifier = Modifier.padding(horizontal = 6.dp))
        MeasureStepper(
            value = loopEnd + 1,
            onDecrement = { if (loopEnd > loopStart) onRangeChange(loopStart, loopEnd - 1) },
            onIncrement = { if (loopEnd < totalMeasures - 1) onRangeChange(loopStart, loopEnd + 1) }
        )
        Spacer(Modifier.width(4.dp))
        Text("/ $totalMeasures", fontSize = 10.sp, color = TextMuted)
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
