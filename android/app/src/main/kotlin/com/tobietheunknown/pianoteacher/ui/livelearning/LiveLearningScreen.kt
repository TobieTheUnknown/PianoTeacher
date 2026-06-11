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
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.utils.KeySignature as MusicKeySignature
import com.tobietheunknown.pianoteacher.utils.chordDegree
import com.tobietheunknown.pianoteacher.ui.common.MiniKeyboard
import com.tobietheunknown.pianoteacher.ui.common.PlaybackDock
import com.tobietheunknown.pianoteacher.ui.common.HandMode
import com.tobietheunknown.pianoteacher.ui.common.PhraseRange
import com.tobietheunknown.pianoteacher.ui.common.fixedKeyboardRange
import com.tobietheunknown.pianoteacher.ui.learning.LearningViewModel
import com.tobietheunknown.pianoteacher.ui.learning.MeasureData
import com.tobietheunknown.pianoteacher.ui.theme.*

// File-level color palette: hoisted out of Canvas DrawScope to avoid per-frame
// allocations. Without this, each Color() literal inside the per-note forEach
// allocates ~60×/sec per dot × ~30 dots × 4 cards ≈ 7k Color objects/sec.
private val IndigoAccentRaw = Color(0xFF6366F1)
private val LL_LABEL_GRAY = TextTertiary
private val LL_MUTED_LABEL = TextSecondary
private val LL_BEAT_DIV_DIM = Color(0x33FFFFFF)
private val LL_BEAT_DIV_BRIGHT = Color(0x40FFFFFF)
// Hand colors routed through design tokens (default classic preset).
private val LL_MELODY_BRIGHT = Tokens.HandRight
private val LL_MELODY_GLOW = Tokens.HandRight.copy(alpha = 0.25f)
private val LL_CHORD_BRIGHT = Tokens.HandLeft
private val LL_CHORD_GLOW = Tokens.HandLeft.copy(alpha = 0.25f)
private val LL_PLAYHEAD_CORE = IndigoAccentRaw
private val LL_PLAYHEAD_GLOW = IndigoAccentRaw.copy(alpha = 0.20f)
private val LL_BG_DARK = Color(0xFF0F1218)
private val LL_DIVIDER_GRAY = TextMuted
private val LL_ICON_GRAY = TextSecondary
private val LL_KEY_WHITE = KeyWhite
private val LL_KEY_WHITE_SHADOW = KeyWhiteShadow
private val LL_KEY_BLACK = KeyBlack

private val NOTE_NAMES = arrayOf("Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si")
private fun noteName(pitch: Int): String = NOTE_NAMES[((pitch % 12) + 12) % 12]

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
    val showDetails by vm.showDetails.collectAsState()
    val keySignature by vm.keySignature.collectAsState()

    var loopEditorOpen by remember { mutableStateOf(false) }

    val totalMeasures = allMeasures.size
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()

    // Single measure duration computation, shared across all cells in the
    // LazyColumn so we don't recompute (and re-allocate) per cell every recomp.
    val measureDurationMs = remember(song?.tempo, song?.beatsPerMeasure, tempoPercent) {
        val bpm = song?.tempo ?: 120
        val bpmPerMeasure = song?.beatsPerMeasure ?: 4
        (60_000L * bpmPerMeasure) / (bpm * tempoPercent).toLong().coerceAtLeast(1L)
    }

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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = TextPrimary)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            song?.title ?: "Sans titre",
                            color = TextPrimary,
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
                            color = LL_LABEL_GRAY,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                    DetailToggle(active = showDetails, onClick = vm::toggleDetails)
                    Spacer(Modifier.width(8.dp))
                }

                Spacer(Modifier.height(8.dp))

                if (allMeasures.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            "Aucune mesure",
                            color = LL_LABEL_GRAY,
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
                                        color = LL_LABEL_GRAY,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.08.sp,
                                    )
                                    Text(
                                        "${String.format("%02d", startIdx)}–${String.format("%02d", endIdx)}",
                                        color = LL_LABEL_GRAY,
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
                                                // Stabilise the click lambda so MeasureCardCompact
                                                // stays skippable across unrelated recompositions
                                                // (e.g. tempo / hand changes).
                                                val onCellClick = remember(globalIdx) {
                                                    { vm.playMeasureSingle(globalIdx) }
                                                }
                                                MeasureCardCompact(
                                                    measure = measure,
                                                    beatsPerMeasure = song?.beatsPerMeasure ?: 4,
                                                    isCurrent = globalIdx == focusedMeasure || globalIdx == playingMeasure,
                                                    isPlaying = isPlaying && globalIdx == playingMeasure,
                                                    measureDurationMs = measureDurationMs,
                                                    showDetails = showDetails,
                                                    keySignature = keySignature,
                                                    onClick = onCellClick,
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
                    // Pre-compute fixed-zoom window size across the whole
                    // song so the keyboard doesn't re-scale every measure.
                    val songSpan = remember(allMeasures) {
                        fixedKeyboardRange(
                            allMeasures.mapNotNull { m ->
                                val all = m.melodyNotes + m.chordNotes
                                if (all.isEmpty()) null
                                else all.minOf { it.pitch } to all.maxOf { it.pitch }
                            }
                        )
                    }
                    val activeRight = remember(focusedMeasureData) {
                        focusedMeasureData.melodyNotes.map { it.pitch }.toSet()
                    }
                    val activeLeft = remember(focusedMeasureData) {
                        focusedMeasureData.chordNotes.map { it.pitch }.toSet()
                    }
                    MiniKeyboard(
                        activeRight = activeRight,
                        activeLeft = activeLeft,
                        fixedRange = songSpan,
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
                    phrases = remember(song) {
                        val list = song?.phrases ?: emptyList()
                        var start = 1
                        list.mapIndexed { i, p ->
                            val end = start + p.length - 1
                            val r = PhraseRange(p.name.ifBlank { "Phrase ${i + 1}" }, start, end)
                            start = end + 1
                            r
                        }
                    },
                    onPrev = {
                        val tgt = (focusedMeasure - 1).coerceAtLeast(0)
                        vm.focusMeasure(tgt)
                    },
                    onNext = {
                        val tgt = (focusedMeasure + 1).coerceAtMost(totalMeasures - 1)
                        vm.focusMeasure(tgt)
                    },
                    // Recommencer: stop playback and return to the first measure.
                    onRestart = {
                        vm.stop()
                        vm.focusMeasure(0)
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
    measureDurationMs: Long = 2000L,
    showDetails: Boolean = false,
    keySignature: MusicKeySignature? = null,
) {
    val border = if (isCurrent) IndigoAccent else BorderColor
    val bg = if (isCurrent) IndigoAccent.copy(alpha = 0.08f) else SurfaceVariant
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
                    color = if (isCurrent) IndigoAccent else LL_MUTED_LABEL,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                )
            }
            // Right-hand melody chips (HandRight) — shown in both states.
            NotesRow(measure.melodyNotes, color = CyanMelody)
            // Left-hand layout:
            //   Détail OFF → ONLY the chord/arpeggio badge (HandLeft colored).
            //     No individual left-hand note chips. A measure with left-hand
            //     notes but no badge shows a single discreet "N notes" chip.
            //   Détail ON → the full left-hand note sequence chips.
            val badge = measure.arpeggioBadge
            if (!showDetails) {
                when {
                    badge != null -> ArpeggioBadgeBlock(badge, keySignature)
                    measure.chordNotes.isNotEmpty() -> LeftHandCountChip(measure.chordNotes.size)
                    else -> Box(modifier = Modifier.fillMaxWidth().height(18.dp))
                }
            } else {
                NotesRow(measure.chordNotes, color = PinkChords)
            }
            // Beat strip with cyan/pink dots aligned to note startTime
            BeatStrip(
                beatsPerMeasure = beatsPerMeasure,
                isCurrent = isCurrent,
                isPlaying = isPlaying,
                melody = measure.melodyNotes,
                chords = measure.chordNotes,
                measureDurationMs = measureDurationMs,
            )
        }
    }
}

/** Small "Détail" pill toggle in the header — ON shows the full per-note
 *  breakdown, OFF shows the combined arpeggio-badge layout. */
@Composable
private fun DetailToggle(active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(if (active) IndigoAccent else SurfaceVariant)
            .border(1.dp, if (active) IndigoAccent else BorderColor, RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            "Détail",
            color = if (active) Color.White else TextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * Détail-OFF left-hand badge for the measure card: a single chord/arpeggio
 * badge chip, LEFT-HAND colored (HandLeft + dim/alpha variants — no more
 * Accent/Warning). A small arpeggio glyph distinguishes arpeggio badges from
 * plain chord badges. The `altered` flag no longer changes color; it survives
 * only as a contentDescription/tooltip. No per-note chip row in this state.
 * When a chord and key signature are available, a small harmonic-degree label
 * (e.g. "i", "V7", "♭VII") is shown next to the badge using TextTertiary.
 */
@Composable
private fun ArpeggioBadgeBlock(
    badge: com.tobietheunknown.pianoteacher.utils.ArpeggioBadge,
    keySignature: MusicKeySignature? = null,
) {
    val tone = PinkChords  // HandLeft
    val desc = if (badge.altered) {
        "Arpège ${badge.label}, altéré" + (badge.alteredNoteName?.let { " ($it)" } ?: "")
    } else {
        "Arpège ${badge.label}"
    }
    val degree = remember(badge.chord, keySignature) {
        if (badge.chord != null) chordDegree(badge.chord, keySignature) else null
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(tone.copy(alpha = 0.14f))
                .border(2.dp, tone, RoundedCornerShape(8.dp))
                .semantics { contentDescription = desc }
                .padding(horizontal = 8.dp, vertical = 3.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Arpeggio glyph — a wavy chord symbol (♪~) keeping arpeggio badges
                // visually distinct from plain chord badges.
                Text(
                    "⤳",  // ⤳ rightwards arrow with wavy tail
                    color = tone,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    badge.label,
                    color = tone,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.2.sp,
                )
            }
        }
        if (degree != null) {
            Text(
                degree,
                color = TextTertiary,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/**
 * Détail-OFF discreet chip for measures that have left-hand notes but no
 * arpeggio/chord badge — a single "N notes" pill (HandLeft styling) instead of
 * dumping every note.
 */
@Composable
private fun LeftHandCountChip(count: Int) {
    val tone = PinkChords  // HandLeft
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(tone.copy(alpha = 0.12f))
            .border(1.dp, tone.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
            .padding(horizontal = 7.dp, vertical = 2.dp),
    ) {
        Text(
            "$count note" + if (count > 1) "s" else "",
            color = tone.copy(alpha = 0.85f),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun NotesRow(notes: List<NoteEvent>, color: Color) {
    val labels = remember(notes) {
        notes
            .sortedBy { it.startTime }
            .map { noteName(it.pitch) }
            .take(8)
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
    measureDurationMs: Long = 2000L,
) {
    // Two-row visible track: cyan dots on top, pink dots on bottom, with
    // a thicker divider mid-line and brighter dots.
    // Wall-clock playhead progress within the active measure.
    val playheadFrac by androidx.compose.runtime.produceState(
        initialValue = 0f,
        isCurrent, isPlaying, measureDurationMs,
    ) {
        if (!(isCurrent && isPlaying)) { value = 0f; return@produceState }
        val start = android.os.SystemClock.elapsedRealtime()
        while (true) {
            val elapsed = android.os.SystemClock.elapsedRealtime() - start
            value = ((elapsed.toFloat() / measureDurationMs.coerceAtLeast(1L)) % 1f).coerceIn(0f, 1f)
            kotlinx.coroutines.delay(16)
        }
    }

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
                color = LL_BEAT_DIV_DIM,
                topLeft = Offset(0f, midY - 0.5f),
                size = Size(w, 1f),
            )
            // Beat division lines (N-1) — taller, brighter
            for (i in 1 until beatsPerMeasure) {
                val x = w * i / beatsPerMeasure
                drawRect(
                    color = LL_BEAT_DIV_BRIGHT,
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
                drawCircle(color = LL_MELODY_GLOW, radius = 7f, center = Offset(x, cyanY))
                drawCircle(color = LL_MELODY_BRIGHT, radius = 4f, center = Offset(x, cyanY))
            }
            // Chord dots — bottom row
            chords.forEach { n ->
                val frac = ((n.startTime - measureStart) / measureBeats).coerceIn(0.0, 1.0)
                val x = w * frac.toFloat()
                drawCircle(color = LL_CHORD_GLOW, radius = 7f, center = Offset(x, pinkY))
                drawCircle(color = LL_CHORD_BRIGHT, radius = 4f, center = Offset(x, pinkY))
            }
            // Playhead — accent vertical line scrubbing across the strip
            if (isCurrent && isPlaying) {
                val px = w * playheadFrac
                drawRect(
                    color = LL_PLAYHEAD_GLOW,
                    topLeft = Offset(px - 6f, 0f),
                    size = Size(12f, h),
                )
                drawRect(
                    color = LL_PLAYHEAD_CORE,
                    topLeft = Offset(px - 1f, 0f),
                    size = Size(2f, h),
                )
            }
        }
    }
}

