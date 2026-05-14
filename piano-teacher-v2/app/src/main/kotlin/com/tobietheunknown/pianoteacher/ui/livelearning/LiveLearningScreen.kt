package com.tobietheunknown.pianoteacher.ui.livelearning

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.ui.common.PlaybackDock
import com.tobietheunknown.pianoteacher.ui.common.HandMode
import com.tobietheunknown.pianoteacher.ui.learning.LearningViewModel
import com.tobietheunknown.pianoteacher.ui.learning.MeasureData
import com.tobietheunknown.pianoteacher.ui.theme.*

/**
 * Apprentissage mobile — measure-by-measure cards with real data.
 *
 * MESURES EN COURS · 01-04 group header, 2x2 compact MeasureCards
 * showing real melody/chord notes from the song, sticky PlaybackDock.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveLearningScreen(
    songId: String,
    onBack: () -> Unit,
    vm: LearningViewModel = viewModel(
        factory = LearningViewModel.Factory(LocalContext.current, songId)
    ),
) {
    val song by vm.song.collectAsState()
    val allMeasures by vm.allMeasures.collectAsState()
    val playingMeasure by vm.playingMeasureIndex.collectAsState()
    val focusedMeasure by vm.focusedMeasureIndex.collectAsState()
    val isPlaying by vm.isPlaying.collectAsState()
    val tempoPercent by vm.tempoPercent.collectAsState()
    val handVm by vm.playbackHand.collectAsState()
    val isMetronomeEnabled by vm.metronomeEnabled.collectAsState()
    val isLooping by vm.isLooping.collectAsState()
    val loopStart by vm.loopStart.collectAsState()
    val loopEnd by vm.loopEnd.collectAsState()

    var loopEditorOpen by remember { mutableStateOf(false) }

    val totalMeasures = allMeasures.size
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()

    // Auto-scroll to the group containing the playing measure.
    LaunchedEffect(playingMeasure) {
        if (playingMeasure >= 0) {
            val groupIdx = playingMeasure / 4
            val firstVisible = listState.firstVisibleItemIndex
            if (groupIdx < firstVisible) {
                listState.scrollToItem(groupIdx)
            } else {
                listState.animateScrollToItem(groupIdx)
            }
        }
    }

    val focusedMeasureData = allMeasures.getOrNull(focusedMeasure)

    Scaffold(containerColor = Background) { padding ->
        Box(modifier = Modifier
            .fillMaxSize()
            .padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 130.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            song?.title ?: "Sans titre",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp,
                            letterSpacing = (-0.02).sp,
                        )
                        val tsText = song?.timeSignature?.let { "${it.numerator}/${it.denominator}" }
                        val parts = listOfNotNull(
                            song?.let { "${it.tempo} BPM" },
                            tsText,
                            "$totalMeasures mesures",
                        )
                        Text(
                            parts.joinToString(" · "),
                            color = Color(0xFF6B7280),
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                if (allMeasures.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            "Aucune mesure",
                            color = Color(0xFF6B7280),
                            fontSize = 14.sp,
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(18.dp),
                    ) {
                        val groups = allMeasures.chunked(4)
                        items(groups.size) { gi ->
                            val group = groups[gi]
                            val startIdx = gi * 4 + 1
                            val endIdx = (gi * 4 + group.size).coerceAtMost(totalMeasures)
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        "MESURES EN COURS",
                                        color = Color(0xFF6B7280),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.08.sp,
                                    )
                                    Text(
                                        "${String.format("%02d", startIdx)}–${String.format("%02d", endIdx)}",
                                        color = Color(0xFF6B7280),
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                                for (row in 0 until 2) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        for (col in 0..1) {
                                            val cellIdx = row * 2 + col
                                            if (cellIdx < group.size) {
                                                val measure = group[cellIdx]
                                                val globalIdx = measure.globalIndex
                                                MeasureCardCompact(
                                                    measure = measure,
                                                    beatsPerMeasure = song?.beatsPerMeasure ?: 4,
                                                    isCurrent = globalIdx == focusedMeasure || globalIdx == playingMeasure,
                                                    isPlaying = isPlaying && globalIdx == playingMeasure,
                                                    onClick = { vm.focusMeasure(globalIdx) },
                                                    modifier = Modifier.weight(1f),
                                                )
                                            } else {
                                                Box(modifier = Modifier.weight(1f))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Mini keyboard + PlaybackDock stacked at the very bottom.
            Column(modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()) {
                if (focusedMeasureData != null) {
                    MiniKeyboard(
                        activeRight = focusedMeasureData.melodyNotes.map { it.pitch }.toSet(),
                        activeLeft = focusedMeasureData.chordNotes.map { it.pitch }.toSet(),
                    )
                }
                PlaybackDock(
                    playing = isPlaying,
                    onPlayPause = { if (isPlaying) vm.stop() else vm.play() },
                    speed = (tempoPercent * 100).toInt(),
                    onSpeed = { pct -> vm.adjustTempo(pct / 100f - tempoPercent) },
                    handMode = when (handVm) {
                        com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.LEFT -> HandMode.LEFT
                        com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.RIGHT -> HandMode.RIGHT
                        else -> HandMode.BOTH
                    },
                    onHandMode = { m ->
                        vm.setHand(when (m) {
                            HandMode.LEFT -> com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.LEFT
                            HandMode.RIGHT -> com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.RIGHT
                            else -> com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.BOTH
                        })
                    },
                    metronome = isMetronomeEnabled,
                    onMetronome = vm::toggleMetronome,
                    loop = isLooping,
                    onLoop = vm::toggleLoop,
                    loopRange = ((loopStart ?: 0) + 1)..((loopEnd ?: 0) + 1),
                    onLoopRangeChange = { r -> vm.setLoopRange(r.first - 1, r.last - 1) },
                    loopEditorOpen = loopEditorOpen,
                    onToggleLoopEditor = { loopEditorOpen = !loopEditorOpen },
                    totalMeasures = totalMeasures.coerceAtLeast(1),
                    onPrev = {
                        val tgt = (focusedMeasure - 1).coerceAtLeast(0)
                        vm.focusMeasure(tgt)
                    },
                    onNext = {
                        val tgt = (focusedMeasure + 1).coerceAtMost(totalMeasures - 1)
                        vm.focusMeasure(tgt)
                    },
                )
            }
        }
    }
}

@Composable
private fun MeasureCardCompact(
    measure: MeasureData,
    beatsPerMeasure: Int,
    isCurrent: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val border = if (isCurrent) IndigoAccent else Color(0x14FFFFFF)
    val bg = if (isCurrent) Color(0x14346FCF) else SurfaceVariant
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(bg)
            .border(1.5.dp, border, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            // Measure number + MG/MD play pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    String.format("%02d", measure.globalIndex + 1),
                    color = if (isCurrent) IndigoAccent else Color(0xFFA8AEBD),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    HandPlayPill("MG", PinkChords)
                    HandPlayPill("MD", CyanMelody)
                }
            }
            // Right-hand notes (cyan, top row)
            NotesRow(measure.melodyNotes, color = CyanMelody)
            // Left-hand notes (pink, bottom row)
            NotesRow(measure.chordNotes, color = PinkChords)
            // Beat strip with cyan/pink dots aligned to note startTime
            BeatStrip(
                beatsPerMeasure = beatsPerMeasure,
                isCurrent = isCurrent,
                isPlaying = isPlaying,
                melody = measure.melodyNotes,
                chords = measure.chordNotes,
            )
        }
    }
}

@Composable
private fun NotesRow(notes: List<NoteEvent>, color: Color) {
    val labels = remember(notes) {
        notes
            .sortedBy { it.startTime }
            .map { noteName(it.pitch) }
            .distinct()
            .take(4)
    }
    if (labels.isEmpty()) {
        Box(modifier = Modifier.fillMaxWidth().height(18.dp))
        return
    }
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        labels.forEach { lab ->
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(color.copy(alpha = 0.22f))
                    .border(1.dp, color.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 5.dp, vertical = 1.dp),
            ) {
                Text(lab, color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun BeatStrip(
    beatsPerMeasure: Int,
    isCurrent: Boolean,
    isPlaying: Boolean,
    melody: List<NoteEvent>,
    chords: List<NoteEvent>,
) {
    // Two-row visible track: cyan dots on top, pink dots on bottom, with
    // a thicker divider mid-line and brighter dots.
    Box(modifier = Modifier
        .fillMaxWidth()
        .height(22.dp)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val cyanY = h * 0.30f
            val pinkY = h * 0.70f
            val midY = h / 2f
            // Middle hairline divider
            drawRect(
                color = Color(0x33FFFFFF),
                topLeft = Offset(0f, midY - 0.5f),
                size = Size(w, 1f),
            )
            // Beat division lines (N-1) — taller, brighter
            for (i in 1 until beatsPerMeasure) {
                val x = w * i / beatsPerMeasure
                drawRect(
                    color = Color(0x40FFFFFF),
                    topLeft = Offset(x - 0.5f, 0f),
                    size = Size(1f, h),
                )
            }

            val measureBeats = beatsPerMeasure.toDouble()
            val measureStart = (melody + chords).firstOrNull()?.startTime?.let {
                (it / measureBeats).toInt() * measureBeats
            } ?: 0.0

            // Melody dots — top row, bigger + glow
            melody.forEach { n ->
                val frac = ((n.startTime - measureStart) / measureBeats).coerceIn(0.0, 1.0)
                val x = w * frac.toFloat()
                drawCircle(color = Color(0x4022D3EE), radius = 7f, center = Offset(x, cyanY))
                drawCircle(color = Color(0xFF22D3EE), radius = 4f, center = Offset(x, cyanY))
            }
            // Chord dots — bottom row
            chords.forEach { n ->
                val frac = ((n.startTime - measureStart) / measureBeats).coerceIn(0.0, 1.0)
                val x = w * frac.toFloat()
                drawCircle(color = Color(0x40EC4899), radius = 7f, center = Offset(x, pinkY))
                drawCircle(color = Color(0xFFEC4899), radius = 4f, center = Offset(x, pinkY))
            }
        }
    }
}

@Composable
private fun HandPlayPill(label: String, color: Color) {
    Row(
        modifier = Modifier
            .clip(CircleShape)
            .border(1.dp, color.copy(alpha = 0.5f), CircleShape)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Icon(Icons.Default.PlayArrow, null, tint = color, modifier = Modifier.size(10.dp))
        Text(label, color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}

private val NOTE_NAMES = arrayOf("Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si")
private fun noteName(pitch: Int): String = NOTE_NAMES[((pitch % 12) + 12) % 12]

/**
 * MiniKeyboard — strip at the bottom of Apprentissage, sized 56dp tall.
 * Highlights notes from the focused measure: right-hand in cyan, left
 * in pink (LearnDS sidebar style).
 */
@Composable
private fun MiniKeyboard(
    activeRight: Set<Int>,
    activeLeft: Set<Int>,
) {
    // 3 octaves starting at C3 (48) — covers most piano teacher tunes.
    val startMidi = 48
    val octaves = 3
    val whiteWidthRaw = 22f
    val totalWhites = octaves * 7
    val totalWidth = totalWhites * whiteWidthRaw
    val height = 56f
    val blackHeight = height * 0.62f
    val blackWidthRatio = 0.6f

    val isBlack = { m: Int -> (m % 12) in listOf(1, 3, 6, 8, 10) }
    val whiteIndex = remember {
        val map = HashMap<Int, Int>()
        var wi = 0
        for (i in 0 until octaves * 12) {
            val m = startMidi + i
            if (!isBlack(m)) {
                map[m] = wi
                wi++
            }
        }
        map
    }

    val scrollState = androidx.compose.foundation.rememberScrollState()
    // Auto-scroll to centre first active note when measure changes.
    LaunchedEffect(activeRight, activeLeft) {
        val first = (activeRight + activeLeft).minOrNull() ?: return@LaunchedEffect
        val idx = whiteIndex[first] ?: whiteIndex[first - 1] ?: 0
        val px = idx * whiteWidthRaw
        val target = (px - 200f).toInt().coerceAtLeast(0)
        scrollState.animateScrollTo(target)
    }

    Box(modifier = Modifier
        .fillMaxWidth()
        .height(height.dp)
        .background(Color(0xFF0F1218))
        .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(0.dp))
        .horizontalScroll(scrollState),
    ) {
        androidx.compose.foundation.Canvas(modifier = Modifier
            .width(totalWidth.dp)
            .height(height.dp)) {
            val whiteCol = Color(0xFFE8EAF0)
            val whiteShadow = Color(0xFFCBD0D8)
            val blackCol = Color(0xFF1A1D24)
            val cyan = Color(0xFF22D3EE)
            val pink = Color(0xFFEC4899)
            // White keys
            for (i in 0 until octaves * 12) {
                val m = startMidi + i
                if (isBlack(m)) continue
                val idx = whiteIndex[m] ?: continue
                val x = idx * whiteWidthRaw
                val isActive = m in activeRight || m in activeLeft
                val fill = when {
                    m in activeRight -> cyan
                    m in activeLeft -> pink
                    else -> whiteCol
                }
                drawRect(
                    color = fill,
                    topLeft = Offset(x, 0f),
                    size = Size(whiteWidthRaw - 0.5f, height),
                )
                drawRect(
                    color = whiteShadow,
                    topLeft = Offset(x + whiteWidthRaw - 0.5f, 0f),
                    size = Size(0.5f, height),
                )
            }
            // Black keys
            for (i in 0 until octaves * 12) {
                val m = startMidi + i
                if (!isBlack(m)) continue
                val prev = m - 1
                val idx = whiteIndex[prev] ?: continue
                val w = whiteWidthRaw * blackWidthRatio
                val x = idx * whiteWidthRaw + whiteWidthRaw - w / 2f
                val fill = when {
                    m in activeRight -> cyan
                    m in activeLeft -> pink
                    else -> blackCol
                }
                drawRect(
                    color = fill,
                    topLeft = Offset(x, 0f),
                    size = Size(w, blackHeight),
                )
            }
        }
    }
}
