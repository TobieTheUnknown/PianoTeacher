package com.tobietheunknown.pianoteacher.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.MergeType
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.ui.common.PlaybackDock
import com.tobietheunknown.pianoteacher.ui.common.HandMode
import com.tobietheunknown.pianoteacher.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    songId: String,
    onBack: () -> Unit,
    vm: EditorViewModel = viewModel(factory = EditorViewModel.Factory(LocalContext.current, songId)),
) {
    val song by vm.song.collectAsState()

    var playing by remember { mutableStateOf(false) }
    var speed by remember { mutableStateOf(100) }
    var handMode by remember { mutableStateOf(HandMode.BOTH) }
    var metronome by remember { mutableStateOf(false) }
    var loop by remember { mutableStateOf(false) }
    var loopEditorOpen by remember { mutableStateOf(false) }

    // Split-mode state: which phrase is being split + at which measure
    var splitFor by remember { mutableStateOf<Int?>(null) }
    var splitAtMeasure by remember { mutableStateOf(1) }

    Scaffold(containerColor = Background) { padding ->
        Box(modifier = Modifier
            .fillMaxSize()
            .padding(padding)) {
            Column(modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 130.dp)) {
                // Header
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = TextPrimary)
                    }
                    Column {
                        Text(
                            "Éditeur",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp,
                            letterSpacing = (-0.02).sp,
                        )
                        Text(
                            song?.title ?: songId,
                            color = TextTertiary,
                            fontSize = 11.sp,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                if (song == null) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = IndigoAccent)
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 4.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        item {
                            Text(
                                "PHRASES",
                                color = TextTertiary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.08.sp,
                                modifier = Modifier.padding(bottom = 4.dp),
                            )
                        }
                        items(song!!.phrases.size) { idx ->
                            val phrase = song!!.phrases[idx]
                            PhraseCard(
                                index = idx,
                                name = phrase.name,
                                length = phrase.length,
                                canMerge = idx > 0,
                                isSplitting = splitFor == idx,
                                splitAtMeasure = splitAtMeasure,
                                onSplit = { splitFor = idx; splitAtMeasure = (phrase.length / 2).coerceAtLeast(1) },
                                onCancelSplit = { splitFor = null },
                                onConfirmSplit = {
                                    vm.splitPhrase(idx, splitAtMeasure)
                                    splitFor = null
                                },
                                onSplitAtChange = { m -> splitAtMeasure = m.coerceIn(1, phrase.length - 1) },
                                onMerge = { vm.mergePhraseWithPrevious(idx) },
                                melodyNotes = phrase.tracks.melody,
                                chordNotes = phrase.tracks.chords,
                                beatsPerMeasure = song!!.beatsPerMeasure,
                            )
                        }
                    }
                }
            }

            // Sticky dock at bottom
            Box(modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()) {
                PlaybackDock(
                    playing = playing,
                    onPlayPause = { playing = !playing },
                    speed = speed,
                    onSpeed = { speed = it },
                    handMode = handMode,
                    onHandMode = { handMode = it },
                    metronome = metronome,
                    onMetronome = { metronome = !metronome },
                    loop = loop,
                    onLoop = { loop = !loop },
                    loopRange = 1..(song?.phrases?.size ?: 1),
                    loopEditorOpen = loopEditorOpen,
                    onToggleLoopEditor = { loopEditorOpen = !loopEditorOpen },
                    totalMeasures = song?.totalMeasures ?: 1,
                )
            }
        }
    }
}

@Composable
private fun PhraseCard(
    index: Int,
    name: String,
    length: Int,
    canMerge: Boolean,
    isSplitting: Boolean,
    splitAtMeasure: Int,
    onSplit: () -> Unit,
    onCancelSplit: () -> Unit,
    onConfirmSplit: () -> Unit,
    onSplitAtChange: (Int) -> Unit,
    onMerge: () -> Unit,
    melodyNotes: List<com.tobietheunknown.pianoteacher.data.model.NoteEvent> = emptyList(),
    chordNotes: List<com.tobietheunknown.pianoteacher.data.model.NoteEvent> = emptyList(),
    beatsPerMeasure: Int = 4,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceVariant)
            .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    name,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
                Text(
                    "$length mesures",
                    color = TextSecondary,
                    fontSize = 11.sp,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                IconButton(
                    onClick = onSplit,
                    enabled = length > 1,
                    modifier = Modifier.size(36.dp),
                ) {
                    Icon(
                        Icons.Default.ContentCut,
                        contentDescription = "Découper",
                        tint = if (length > 1) IndigoAccent else TextMuted,
                    )
                }
                IconButton(
                    onClick = onMerge,
                    enabled = canMerge,
                    modifier = Modifier.size(36.dp),
                ) {
                    Icon(
                        Icons.Default.MergeType,
                        contentDescription = "Recoller avec précédente",
                        tint = if (canMerge) TextSecondary else TextMuted,
                    )
                }
            }
        }

        // Mini visual preview — dots for melody (cyan, top) + chords (pink,
        // bottom) across `length` measures. When isSplitting, an accent
        // vertical line shows where the cut will land.
        PhrasePreview(
            length = length,
            beatsPerMeasure = beatsPerMeasure,
            melody = melodyNotes,
            chords = chordNotes,
            splitAt = if (isSplitting) splitAtMeasure else null,
        )

        if (isSplitting) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(IndigoAccent.copy(alpha = 0.10f))
                    .border(1.dp, IndigoAccent, RoundedCornerShape(10.dp))
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Découper APRÈS la mesure",
                    color = IndigoAccent,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.06.sp,
                )
                // Inline editable: tap the number → BasicTextField for direct entry.
                var editing by remember(splitAtMeasure, isSplitting) { mutableStateOf(false) }
                var draft by remember(splitAtMeasure, editing) { mutableStateOf(splitAtMeasure.toString()) }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    StepperBtn("−", enabled = splitAtMeasure > 1) { onSplitAtChange(splitAtMeasure - 1) }
                    if (editing) {
                        androidx.compose.foundation.text.BasicTextField(
                            value = draft,
                            onValueChange = { s -> draft = s.filter { it.isDigit() }.take(4) },
                            textStyle = androidx.compose.ui.text.TextStyle(
                                color = IndigoAccent,
                                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            ),
                            singleLine = true,
                            cursorBrush = androidx.compose.ui.graphics.SolidColor(IndigoAccent),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                                imeAction = androidx.compose.ui.text.input.ImeAction.Done,
                            ),
                            keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                                onDone = {
                                    draft.toIntOrNull()?.let { onSplitAtChange(it.coerceIn(1, length - 1)) }
                                    editing = false
                                },
                            ),
                            modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                        )
                    } else {
                        Text(
                            "$splitAtMeasure",
                            color = IndigoAccent,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                            modifier = Modifier
                                .weight(1f)
                                .padding(horizontal = 12.dp)
                                .clickable { editing = true },
                        )
                    }
                    StepperBtn("+", enabled = splitAtMeasure < length - 1) { onSplitAtChange(splitAtMeasure + 1) }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = onCancelSplit,
                        modifier = Modifier.weight(1f),
                    ) { Text("Annuler") }
                    Button(
                        onClick = onConfirmSplit,
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent),
                        modifier = Modifier.weight(1f),
                    ) { Text("Découper", color = Color.White) }
                }
            }
        }
    }
}

@Composable
private fun PhrasePreview(
    length: Int,
    beatsPerMeasure: Int,
    melody: List<com.tobietheunknown.pianoteacher.data.model.NoteEvent>,
    chords: List<com.tobietheunknown.pianoteacher.data.model.NoteEvent>,
    splitAt: Int?,
) {
    val totalBeats = length * beatsPerMeasure
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Hairline)
            .border(1.dp, BorderColor, RoundedCornerShape(8.dp))
    ) {
        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            // Measure bar lines
            for (m in 1 until length) {
                val x = w * m / length
                drawRect(
                    color = BorderStrong,
                    topLeft = Offset(x - 0.5f, 6f),
                    size = Size(1f, h - 12f),
                )
            }
            // Measure numbers at the top
            val topRowY = h * 0.5f
            val botRowY = h * 0.75f

            // Note dots — top row cyan (melody), bottom row pink (chords)
            melody.forEach { n ->
                val x = (n.startTime.toFloat() / totalBeats) * w
                if (x in 0f..w) {
                    drawCircle(
                        color = HandRight,
                        radius = 3f,
                        center = Offset(x, topRowY),
                    )
                }
            }
            chords.forEach { n ->
                val x = (n.startTime.toFloat() / totalBeats) * w
                if (x in 0f..w) {
                    drawCircle(
                        color = HandLeft,
                        radius = 3f,
                        center = Offset(x, botRowY),
                    )
                }
            }

            // Split cursor — vertical accent line at split boundary
            if (splitAt != null) {
                val sx = (splitAt.toFloat() / length) * w
                drawRect(
                    color = IndigoAccentRaw.copy(alpha = 0.18f),
                    topLeft = Offset(sx - 12f, 0f),
                    size = Size(24f, h),
                )
                drawRect(
                    color = IndigoAccentRaw,
                    topLeft = Offset(sx - 1f, 0f),
                    size = Size(2f, h),
                )
            }
        }
        // Measure number labels overlay (top-left of each measure)
        Row(modifier = Modifier.fillMaxSize()) {
            for (m in 0 until length) {
                Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                    Text(
                        "${m + 1}",
                        color = TextMuted,
                        fontSize = 9.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(start = 3.dp, top = 2.dp),
                    )
                }
            }
        }
    }
}

private val IndigoAccentRaw = Color(0xFF6366F1)

@Composable
private fun StepperBtn(label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(SurfaceVariant)
            .border(1.dp, BorderColor, RoundedCornerShape(6.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = TextSecondary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}
