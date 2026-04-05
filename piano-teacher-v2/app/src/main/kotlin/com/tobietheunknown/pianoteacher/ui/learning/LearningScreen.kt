package com.tobietheunknown.pianoteacher.ui.learning

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand
import com.tobietheunknown.pianoteacher.ui.theme.*
import com.tobietheunknown.pianoteacher.utils.ArpeggioMotifResult
import com.tobietheunknown.pianoteacher.utils.ChordWithReps
import com.tobietheunknown.pianoteacher.utils.firstArpeggioCycle
import com.tobietheunknown.pianoteacher.utils.midiToFrench
import androidx.compose.foundation.Canvas
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

// Standard staff line positions (diatonic degrees)
private val TREBLE_LINES    = intArrayOf(37, 39, 41, 43, 45)  // E4, G4, B4, D5, F5
private val TREBLE_KEY_LINE = 39   // G4

private val BASS_LINES      = intArrayOf(25, 27, 29, 31, 33)  // G2, B2, D3, F3, A3
private val BASS_KEY_LINE   = 31   // F3

// Treble fixed range
private const val TREBLE_BOTTOM = 37  // E4
private const val TREBLE_TOP    = 45  // F5
private const val TREBLE_RANGE  = 8

// Bass fixed range
private const val BASS_BOTTOM   = 25  // G2
private const val BASS_TOP      = 33  // A3
private const val BASS_RANGE    = 8

private fun noteY(
    pitch: Int,
    bottomDiatonic: Int,
    range: Int,
    staffTop: Float,
    staffH: Float,
    useFlats: Boolean = false
): Float {
    val pos = (midiToDiatonic(pitch, useFlats) - bottomDiatonic).toFloat() / range.toFloat()
    return staffTop + staffH * (1f - pos) + staffH / 16f
}

private fun isBlackKey(midi: Int): Boolean =
    when (midi % 12) { 1, 3, 6, 8, 10 -> true else -> false }

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
    val useFlats = keySignature?.useFlats ?: false

    val listState = rememberLazyListState()

    // Dialog states
    var showRenameSongDialog by remember { mutableStateOf(false) }
    var showRenamePhraseDialog by remember { mutableStateOf<Int?>(null) }
    var showSplitDialog by remember { mutableStateOf<Int?>(null) }

    // Auto-scroll when playing measure changes
    LaunchedEffect(playingMeasure) {
        if (playingMeasure >= 0) listState.animateScrollToItem(playingMeasure)
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
    val pianoFocusOctave = remember(focusedMeasureData, hand) {
        val notes = when (hand) {
            PlaybackHand.LEFT  -> focusedMeasureData?.chordNotes
            PlaybackHand.RIGHT -> focusedMeasureData?.melodyNotes
            PlaybackHand.BOTH  -> focusedMeasureData?.let { it.melodyNotes + it.chordNotes }
        }
        val lowest = notes?.minOfOrNull { it.pitch } ?: 48
        lowest / 12
    }

    Scaffold(
        containerColor = Background,
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Column(modifier = Modifier.clickable { showRenameSongDialog = true }) {
                            Text(
                                song?.title ?: "",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text("Apprentissage", fontSize = 12.sp, color = Color(0xFF94A3B8))
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
                        }
                    },
                    actions = {
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
        },
        bottomBar = {
            if (allMeasures.isNotEmpty()) {
                Column {
                    NoteLabelsStrip(
                        measure = focusedMeasureData,
                        useFlats = useFlats,
                        showOctaves = showOctaves,
                        showDetails = showDetails
                    )
                    LearningPianoKeyboard(
                        activeRightPitches = focusedMeasureData?.melodyNotes?.map { it.pitch }?.toSet() ?: emptySet(),
                        activeLeftPitches = focusedMeasureData?.chordNotes?.map { it.pitch }?.toSet() ?: emptySet(),
                        focusOctave = pianoFocusOctave,
                        modifier = Modifier.fillMaxWidth().height(90.dp)
                    )
                    TransportBar(
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
                        onSplit = { showSplitDialog = focusedMeasure }
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
                LazyRow(
                    state = listState,
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(
                        count = allMeasures.size,
                        key = { allMeasures[it].globalIndex }
                    ) { idx ->
                        val measure = allMeasures[idx]
                        val isPlaying = measure.globalIndex == playingMeasure
                        val isFocused = measure.globalIndex == focusedMeasure
                        Column(
                            modifier = Modifier
                                .fillParentMaxWidth(0.5f)
                                .fillParentMaxHeight()
                                .clickable {
                                    vm.focusMeasure(measure.globalIndex)
                                    vm.playMeasureSingle(measure.globalIndex)
                                }
                        ) {
                            MiniMeasureCard(
                                measure = measure,
                                beatsPerMeasure = song!!.beatsPerMeasure,
                                isPlaying = isPlaying,
                                isFocused = isFocused,
                                useFlats = useFlats,
                                modifier = Modifier.fillMaxWidth().height(80.dp)
                            )
                            GrandStaffCanvas(
                                melodyNotes = measure.melodyNotes,
                                chordNotes = measure.chordNotes,
                                beatsPerMeasure = song!!.beatsPerMeasure,
                                useFlats = useFlats,
                                showClefs = idx == 0,
                                isPlaying = isPlaying,
                                isFocused = isFocused,
                                measureNumber = measure.globalIndex + 1,
                                modifier = Modifier.fillMaxWidth().weight(1f)
                            )
                        }
                    }
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

// ─── Song header ──────────────────────────────────────────────────────────────

@Composable
private fun SongHeader(song: Song) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceVariant)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            StatBlock("Tempo", "${song.tempo} BPM")
            StatBlock("Mesures", "${song.totalMeasures}")
            StatBlock("Phrases", "${song.phrases.size}")
            StatBlock("Tonalité", "${song.key.note} ${song.key.mode}")
        }
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp))
        ) {
            val total = song.totalMeasures.toFloat().coerceAtLeast(1f)
            song.phrases.forEachIndexed { i, phrase ->
                Box(
                    modifier = Modifier
                        .weight(phrase.length / total)
                        .fillMaxHeight()
                        .background(if (i % 2 == 0) IndigoAccent else CyanMelody.copy(alpha = 0.6f))
                )
            }
        }
    }
}

@Composable
private fun StatBlock(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp)
        Text(label, fontSize = 11.sp, color = Color(0xFF64748B))
    }
}

// ─── Staff mini strip (top navigation — measure card style) ──────────────────

@Composable
private fun StaffMiniStrip(
    allMeasures: List<MeasureData>,
    song: Song?,
    playingMeasureIndex: Int,
    focusedMeasureIndex: Int,
    useFlats: Boolean,
    listState: androidx.compose.foundation.lazy.LazyListState,
    onMeasureTap: (Int) -> Unit
) {
    val beatsPerMeasure = song?.beatsPerMeasure ?: 4
    Column(modifier = Modifier.fillMaxWidth().background(Surface)) {
        LazyRow(
            state = listState,
            flingBehavior = rememberSnapFlingBehavior(listState),
            modifier = Modifier.fillMaxWidth().height(80.dp),
            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            items(count = allMeasures.size, key = { allMeasures[it].globalIndex }) { idx ->
                val measure = allMeasures[idx]
                val isPlaying = measure.globalIndex == playingMeasureIndex
                val isFocused = measure.globalIndex == focusedMeasureIndex
                Column(
                    modifier = Modifier
                        .fillParentMaxWidth(0.5f)
                        .fillParentMaxHeight()
                        .clip(RoundedCornerShape(5.dp))
                        .background(
                            when {
                                isPlaying -> IndigoAccent.copy(alpha = 0.18f)
                                isFocused -> Color.White.copy(alpha = 0.05f)
                                else -> Color.Transparent
                            }
                        )
                        .border(
                            width = if (isPlaying) 1.dp else if (isFocused) 0.5.dp else 0.dp,
                            color = if (isPlaying) IndigoAccent else if (isFocused) Color.White.copy(alpha = 0.15f) else Color.Transparent,
                            shape = RoundedCornerShape(5.dp)
                        )
                        .clickable { onMeasureTap(measure.globalIndex) }
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
        }
        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
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
private const val STAFF_GAP_DP = 48f
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
        val gap       = STAFF_GAP_DP.dp.toPx()

        val availH       = h - topPad - bottomPad - gap
        val staffH       = (availH / 2f).coerceAtMost(STAFF_H_MAX_DP.dp.toPx())
        val totalStavesH = staffH * 2 + gap
        val stavesOriginY = topPad + (availH - totalStavesH) / 2f
        val lineSpacing  = staffH / 4f

        // Space reserved for clef glyph on first measure
        val clefW    = if (showClefs) (staffH * 0.26f).coerceAtLeast(22.dp.toPx()) else 0f
        val startPad = 8.dp.toPx()
        val dotR     = lineSpacing * 0.32f

        // ── Measure number ─────────────────────────────────────────────────
        val numStyle = TextStyle(
            fontSize = 13.sp,
            color = if (isPlaying) IndigoAccent else Color(0xFF64748B),
            fontWeight = if (isPlaying) FontWeight.Bold else FontWeight.Normal
        )
        val numLayout = textMeasurer.measure("$measureNumber", numStyle)
        drawText(numLayout, topLeft = Offset((w - numLayout.size.width) / 2f, 4.dp.toPx()))

        // ── Left bracket ───────────────────────────────────────────────────
        drawLine(
            color = Color.White.copy(alpha = 0.35f),
            start = Offset(1.dp.toPx(), stavesOriginY),
            end   = Offset(1.dp.toPx(), stavesOriginY + totalStavesH),
            strokeWidth = 3.dp.toPx()
        )

        // ── Draw treble (si=0) then bass (si=1) ────────────────────────────
        val staffKeys  = intArrayOf(TREBLE_KEY_LINE, BASS_KEY_LINE)
        val staffLines = arrayOf(TREBLE_LINES, BASS_LINES)
        val staffTops  = floatArrayOf(stavesOriginY, stavesOriginY + staffH + gap)

        staffTops.forEachIndexed { si, staffTop ->
            val lineTop = staffTop

            // ── Staff lines ──────────────────────────────────────────────
            for (li in 0..4) {
                val y = lineTop + li * lineSpacing
                val isKey = (staffLines[si][4 - li] == staffKeys[si])
                drawLine(
                    color = if (isKey) Color.White.copy(alpha = 0.42f) else Color.White.copy(alpha = 0.32f),
                    start = Offset(0f, y),
                    end   = Offset(w, y),
                    strokeWidth = if (isKey) 1.1f else 0.9f
                )
            }

            // ── Clef glyph (first measure only) ─────────────────────────
            if (showClefs) {
                val isTreble = si == 0
                val clefChar = if (isTreble) "\uD834\uDD1E" else "\uD834\uDD22"
                val clefFontPx = if (isTreble) staffH * 0.533f else staffH * 0.64f
                val clefStyle = TextStyle(
                    fontSize = (clefFontPx / density).sp,
                    color = Color.White.copy(alpha = 0.65f)
                )
                val clefLayout = textMeasurer.measure(clefChar, clefStyle)

                // li index of key line from top:
                //   Treble G4 → li=3 (staffLines[0][4-3]=staffLines[0][1]=39=G4)
                //   Bass   F3 → li=1 (staffLines[1][4-1]=staffLines[1][3]=31=F3)
                val keyLiFromTop = if (isTreble) 3 else 1
                val keyY = lineTop + keyLiFromTop * lineSpacing

                // Anchor fraction from top of glyph where the key line passes through
                val anchorFrac = if (isTreble) 0.62f else 0.20f
                val clefY = keyY - clefLayout.size.height * anchorFrac

                drawText(clefLayout, topLeft = Offset(4.dp.toPx(), clefY))
            }

            // ── Notes ────────────────────────────────────────────────────
            val topDiatonic = if (si == 0) TREBLE_TOP else BASS_TOP

            val allNotes: List<Pair<NoteEvent, Color>> =
                melodyNotes.map { it to CyanMelody.copy(alpha = 0.72f) } +
                chordNotes.map { it to PinkChords.copy(alpha = 0.72f) }

            allNotes.forEach { (note, color) ->
                val d = midiToDiatonic(note.pitch, useFlats)
                val inTreble = d >= TREBLE_BOTTOM
                if ((si == 0) != inTreble) return@forEach

                val frac = (note.startTime / beatsPerMeasure).toFloat().coerceIn(0f, 1f)
                val x = clefW + startPad + frac * (w - clefW - startPad - dotR * 2f)
                val y = lineTop + (topDiatonic - d) * (lineSpacing / 2f)

                drawCircle(color = color, radius = dotR, center = Offset(x, y))

                // Accidental (#/b) — above the note, horizontally centered
                if (isBlackKey(note.pitch)) {
                    val label = if (useFlats) "b" else "#"
                    val labelLayout = textMeasurer.measure(
                        label,
                        TextStyle(fontSize = 9.sp, color = color.copy(alpha = 0.95f), fontWeight = FontWeight.Bold)
                    )
                    drawText(labelLayout, topLeft = Offset(
                        x - labelLayout.size.width / 2f,
                        y - dotR - labelLayout.size.height - 1.dp.toPx()
                    ))
                }
            }
        }

        // ── Bar line (with small top/bottom margin) ────────────────────────
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
    showDetails: Boolean = false
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(Surface)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (measure != null) {
            // MD — note names
            if (measure.melodyNotes.isNotEmpty()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("MD", fontSize = 11.sp, color = CyanMelody.copy(alpha = 0.7f), fontWeight = FontWeight.Bold)
                    measure.melodyNotes
                        .map { it.pitch }
                        .distinct()
                        .forEach { pitch -> NoteChip(midiToFrench(pitch, showOctaves, useFlats), CyanMelody) }
                }
            }
            // MG — chord name / arpeggio (même logique que MeasureCard)
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
}

// ─── Piano keyboard — scrollable, snap on C (DO) ─────────────────────────────

private const val PIANO_MIN_OCT = 1   // C1 = MIDI 12
private const val PIANO_MAX_OCT = 8   // C8 = MIDI 96

@Composable
private fun LearningPianoKeyboard(
    activeRightPitches: Set<Int>,
    activeLeftPitches: Set<Int>,
    focusOctave: Int,
    modifier: Modifier = Modifier
) {
    val numOctaves = PIANO_MAX_OCT - PIANO_MIN_OCT + 1
    val listState = rememberLazyListState()
    val snapBehavior = rememberSnapFlingBehavior(listState)

    LaunchedEffect(focusOctave) {
        val idx = (focusOctave - PIANO_MIN_OCT).coerceIn(0, numOctaves - 1)
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
                modifier = Modifier.fillParentMaxWidth(0.5f).fillParentMaxHeight()
            )
        }
    }
}

@Composable
private fun OctaveKeys(
    cMidi: Int,
    activeRightPitches: Set<Int>,
    activeLeftPitches: Set<Int>,
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
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.52f)
                midi in activeLeftPitches  -> PinkChords.copy(alpha = 0.52f)
                else                       -> Color(0xFFE8ECF0)
            }
            drawRoundRect(color, Offset(wi * wkW + 0.5f, 0f), Size(wkW - 1f, size.height), CornerRadius(2f))
        }

        // Black keys — (semitone, rightWhiteIndex) pairs
        // rightWhiteIndex = index of the white key to the right of this black key
        listOf(1 to 1, 3 to 2, 6 to 4, 8 to 5, 10 to 6).forEach { (semi, rw) ->
            val midi = cMidi + semi
            val color = when {
                midi in activeRightPitches -> CyanMelody.copy(alpha = 0.65f)
                midi in activeLeftPitches  -> PinkChords.copy(alpha = 0.65f)
                else                       -> Color(0xFF1A1A1A)
            }
            val x = rw * wkW - bkW / 2f
            drawRoundRect(color, Offset(x, 0f), Size(bkW, bkH), CornerRadius(2f))
        }
    }
}

// ─── Phrase header ────────────────────────────────────────────────────────────

@Composable
private fun PhraseHeader(
    section: PhraseSectionData,
    onPlay: () -> Unit,
    onToggleMastered: () -> Unit,
    onRename: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, start = 12.dp, end = 12.dp, bottom = 2.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Surface)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        IconButton(onClick = onToggleMastered, modifier = Modifier.size(28.dp)) {
            Icon(
                if (section.isMastered) Icons.Default.Star else Icons.Default.StarBorder,
                null,
                tint = if (section.isMastered) AmberWarning else Color(0xFF475569),
                modifier = Modifier.size(18.dp)
            )
        }
        Column(modifier = Modifier.weight(1f).clickable(onClick = onRename)) {
            Text(section.phrase.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(
                "${section.phrase.length} mesures · ${section.measures.sumOf { it.melodyNotes.size + it.chordNotes.size }} notes",
                fontSize = 11.sp, color = Color(0xFF64748B)
            )
        }
        IconButton(
            onClick = onPlay,
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(50)).background(IndigoAccent)
        ) {
            Icon(Icons.Default.PlayArrow, "Jouer", tint = Color.White, modifier = Modifier.size(16.dp))
        }
    }
}

// ─── Measure card (kept for reference) ───────────────────────────────────────

@Composable
private fun MeasureCard(
    measure: MeasureData,
    modifier: Modifier = Modifier,
    beatsPerMeasure: Double,
    isPlaying: Boolean,
    isFocused: Boolean,
    showDetails: Boolean,
    showOctaves: Boolean,
    useFlats: Boolean = false,
    onTap: () -> Unit
) {
    val borderColor = when {
        isPlaying -> IndigoAccent
        isFocused -> Color.White.copy(alpha = 0.12f)
        else -> Color.White.copy(alpha = 0.08f)
    }
    Row(
        modifier = modifier
            .border(1.5.dp, borderColor, RoundedCornerShape(12.dp))
            .clip(RoundedCornerShape(12.dp))
            .background(Surface)
            .clickable(onClick = onTap)
            .padding(horizontal = 10.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier.size(38.dp).clip(RoundedCornerShape(6.dp))
                .background(if (isPlaying) IndigoAccent else Color.White.copy(alpha = 0.05f)),
            contentAlignment = Alignment.Center
        ) {
            Text("${measure.globalIndex + 1}", color = if (isPlaying) Color.White else Color(0xFF64748B), fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        Column(modifier = Modifier.weight(1f)) {
            MiniTimeline(melodyNotes = measure.melodyNotes, chordNotes = measure.chordNotes, beatsPerMeasure = beatsPerMeasure)
            Spacer(Modifier.height(5.dp))
            if (measure.melodyNotes.isNotEmpty()) {
                val names = measure.melodyNotes.map { midiToFrench(it.pitch, showOctaves, useFlats) }
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("MD:", fontSize = 14.sp, color = CyanMelody.copy(alpha = 0.7f))
                    val visible = if (showDetails) names else names.take(2)
                    visible.forEach { NoteChip(it, CyanMelody) }
                    if (!showDetails && names.size > 2) Text("+${names.size - 2}", fontSize = 9.sp, color = Color(0xFF475569))
                }
            }
            if (measure.chordInfo != null) {
                Spacer(Modifier.height(3.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("MG:", fontSize = 14.sp, color = PinkChords.copy(alpha = 0.7f))
                    ChordChip(measure.chordInfo, measure.chordNotes, showDetails, showOctaves, useFlats, measure.arpeggioMotif)
                }
            } else if (measure.chordNotes.isNotEmpty()) {
                Spacer(Modifier.height(3.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("MG:", fontSize = 14.sp, color = PinkChords.copy(alpha = 0.7f))
                    measure.chordNotes.map { midiToFrench(it.pitch, showOctaves, useFlats) }.take(5).forEach { NoteChip(it, PinkChords) }
                }
            }
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

// ─── Mini timeline canvas ─────────────────────────────────────────────────────

@Composable
private fun MiniTimeline(melodyNotes: List<NoteEvent>, chordNotes: List<NoteEvent>, beatsPerMeasure: Double) {
    Canvas(modifier = Modifier.fillMaxWidth().height(40.dp)) {
        val w = size.width
        val h = size.height
        val midY = h / 2f
        drawLine(color = Color(0xFF475569), start = Offset(0f, midY), end = Offset(w, midY), strokeWidth = 1.5f)
        melodyNotes.forEach { note ->
            val x = ((note.startTime / beatsPerMeasure) * w).toFloat().coerceIn(0f, w)
            drawCircle(color = CyanMelody, radius = 8f, center = Offset(x, midY - 8f))
        }
        chordNotes.forEach { note ->
            val x = ((note.startTime / beatsPerMeasure) * w).toFloat().coerceIn(0f, w)
            drawCircle(color = PinkChords, radius = 8f, center = Offset(x, midY + 8f))
        }
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
    onSplit: () -> Unit = {}
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
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Hand selector
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                HandButton("MG", hand == PlaybackHand.LEFT, PinkChords) { onHandChange(PlaybackHand.LEFT) }
                HandButton("🔊", hand == PlaybackHand.BOTH, AmberWarning) { onHandChange(PlaybackHand.BOTH) }
                HandButton("MD", hand == PlaybackHand.RIGHT, CyanMelody) { onHandChange(PlaybackHand.RIGHT) }
            }

            // Tempo control
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                IconButton(onClick = { onTempoAdjust(-0.1f) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Remove, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(14.dp))
                }
                Text(
                    "${(tempoPercent * 100).toInt()}%",
                    color = if (tempoPercent != 1.0f) IndigoAccent else Color.White,
                    fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.widthIn(min = 36.dp), textAlign = TextAlign.Center
                )
                IconButton(onClick = { onTempoAdjust(0.1f) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Add, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(14.dp))
                }
            }

            // Playback controls
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = onStop,
                    modifier = Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(Color.White.copy(alpha = 0.07f))
                ) {
                    Icon(Icons.Default.Stop, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(16.dp))
                }
                IconButton(
                    onClick = onPlay,
                    modifier = Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(IndigoAccent)
                ) {
                    Icon(if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
                IconButton(
                    onClick = onSplit,
                    modifier = Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(Color.White.copy(alpha = 0.07f))
                ) {
                    Icon(Icons.Default.ContentCut, "Diviser", tint = Color(0xFF64748B), modifier = Modifier.size(16.dp))
                }
            }
        }

        // Second row: metronome + loop
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onToggleMetronome, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.MusicNote, "Métronome", tint = if (isMetronomeEnabled) IndigoAccent else Color(0xFF475569), modifier = Modifier.size(16.dp))
            }
            IconButton(onClick = onToggleLoop, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Repeat, "Boucle", tint = if (isLooping) AmberWarning else Color(0xFF475569), modifier = Modifier.size(16.dp))
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
