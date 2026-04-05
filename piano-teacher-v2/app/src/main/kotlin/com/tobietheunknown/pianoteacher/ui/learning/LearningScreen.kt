package com.tobietheunknown.pianoteacher.ui.learning

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
    val clefMode by vm.clefMode.collectAsState()
    val useFlats = keySignature?.useFlats ?: false

    val listState = rememberLazyListState()

    // 8vb/15mb shift for lower staff in Sol×2 mode (constant for entire song)
    val lowerStaffOctaveShift = remember(allMeasures, clefMode, useFlats) {
        if (clefMode != ClefMode.TREBLE_X2) 0 else {
            val allChordDiatonics = allMeasures.flatMap { it.chordNotes }
                .map { midiToDiatonic(it.pitch, useFlats) }
            if (allChordDiatonics.isEmpty()) 0 else {
                val median = allChordDiatonics.sorted()[allChordDiatonics.size / 2]
                val staffBottom = TREBLE_CLEF.lines.first() // E4 = 37
                val deficit = staffBottom - median
                when {
                    deficit >= 14 -> 14  // 15mb
                    deficit >= 7 -> 7    // 8vb
                    else -> 0
                }
            }
        }
    }

    // Dialog states
    var showRenameSongDialog by remember { mutableStateOf(false) }
    var showRenamePhraseDialog by remember { mutableStateOf<Int?>(null) }
    var showSplitDialog by remember { mutableStateOf<Int?>(null) }

    // Auto-scroll when playing measure changes
    LaunchedEffect(playingMeasure) {
        if (playingMeasure >= 0) {
            val currentFirst = listState.firstVisibleItemIndex
            if (playingMeasure < currentFirst) {
                // Loop reset (backward jump): instant scroll
                listState.scrollToItem(playingMeasure)
            } else {
                listState.animateScrollToItem(playingMeasure)
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
        },
        bottomBar = {
            if (allMeasures.isNotEmpty()) {
                Column {
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
                        val showClefs = idx == 0 || (clefMode == ClefMode.AUTO && idx > 0 && run {
                            val prev = allMeasures[idx - 1]
                            selectClef(prev.melodyNotes, useFlats).name != selectClef(measure.melodyNotes, useFlats).name ||
                            selectClef(prev.chordNotes, useFlats).name != selectClef(measure.chordNotes, useFlats).name
                        })
                        val itemFrac = if (showClefs) 0.65f else 0.5f
                        Column(
                            modifier = Modifier
                                .fillParentMaxWidth(itemFrac)
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
                                showClefs = showClefs,
                                isPlaying = isPlaying,
                                isFocused = isFocused,
                                measureNumber = measure.globalIndex + 1,
                                clefMode = clefMode,
                                lowerOctaveShift = lowerStaffOctaveShift,
                                modifier = Modifier.fillMaxWidth().weight(1f)
                            )
                        }
                    }
                }
                // NoteLabelsStrip en overlay semi-transparent ancré en bas du canvas
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
        val staffH       = (totalAvail / 2.5f).coerceAtMost(STAFF_H_MAX_DP.dp.toPx())
        val lineSpacing  = staffH / 4f
        val gap          = lineSpacing * 2f  // exactly 2 line spacings → middle C falls between staves
        val totalStavesH = staffH * 2 + gap
        val stavesOriginY = topPad + (totalAvail - totalStavesH) / 2f

        val clefW    = if (showClefs) (staffH * 0.26f).coerceAtLeast(22.dp.toPx()) else 0f
        val barPad   = 10.dp.toPx()
        val dotR     = lineSpacing * 0.32f

        // ── Resolve clefs + note assignment per mode ──────────────────────
        val upperClef: StaffClefConfig
        val lowerClef: StaffClefConfig
        val upperNotes: List<Pair<NoteEvent, Color>>
        val lowerNotes: List<Pair<NoteEvent, Color>>

        when (clefMode) {
            ClefMode.STANDARD -> {
                upperClef = TREBLE_CLEF; lowerClef = BASS_CLEF
                val all = melodyNotes.map { it to CyanMelody.copy(alpha = 0.72f) } +
                          chordNotes.map { it to PinkChords.copy(alpha = 0.72f) }
                val splitDiatonic = TREBLE_CLEF.lines.first() // E4 = 37
                upperNotes = all.filter { midiToDiatonic(it.first.pitch, useFlats) >= splitDiatonic }
                lowerNotes = all.filter { midiToDiatonic(it.first.pitch, useFlats) < splitDiatonic }
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

        // ── Left bracket ───────────────────────────────────────────────────
        val bracketX = clefW + 1.dp.toPx()
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
                    start = Offset(clefW, y),
                    end   = Offset(w, y),
                    strokeWidth = if (isKey) 1.6f else 1.2f
                )
            }

            // ── Clef glyph ──────────────────────────────────────────────
            if (showClefs) {
                val clefFontPx = staffH * clef.fontScale
                val clefStyle = TextStyle(
                    fontSize = (clefFontPx / density).sp,
                    color = Color.White.copy(alpha = 0.35f)
                )
                val clefLayout = textMeasurer.measure(clef.glyph, clefStyle)
                val keyY = lineTop + clef.keyLineFromTop * lineSpacing
                val clefY = keyY - clefLayout.size.height * clef.anchorFrac - clef.extraYOffset.dp.toPx()
                val clefX = (clefW - clefLayout.size.width) / 2f
                drawText(clefLayout, topLeft = Offset(clefX.coerceAtLeast(2.dp.toPx()), clefY))
            }

            // ── 8vb/15mb label for lower staff ────────────────────────
            val octShift = if (si == 1) lowerOctaveShift else 0
            if (showClefs && octShift > 0) {
                val octLabel = if (octShift >= 14) "15mb" else "8vb"
                val octStyle = TextStyle(fontSize = 9.sp, color = Color.White.copy(alpha = 0.45f), fontWeight = FontWeight.Bold)
                val octLayout = textMeasurer.measure(octLabel, octStyle)
                drawText(octLayout, topLeft = Offset(
                    2.dp.toPx(),
                    lineTop + 4 * lineSpacing + 3.dp.toPx()
                ))
            }

            // ── Notes ───────────────────────────────────────────────────
            staffNotesList[si].forEach { (note, color) ->
                val d = midiToDiatonic(note.pitch, useFlats) + octShift
                val frac = (note.startTime / beatsPerMeasure).toFloat().coerceIn(0f, 1f)
                val noteAreaStart = clefW + barPad + dotR
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

            // Tempo control + métronome (gauche) + loop (droite)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                IconButton(onClick = onToggleMetronome, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.MusicNote, "Métronome", tint = if (isMetronomeEnabled) IndigoAccent else Color(0xFF475569), modifier = Modifier.size(14.dp))
                }
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
                IconButton(onClick = onToggleLoop, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Repeat, "Boucle", tint = if (isLooping) AmberWarning else Color(0xFF475569), modifier = Modifier.size(14.dp))
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
