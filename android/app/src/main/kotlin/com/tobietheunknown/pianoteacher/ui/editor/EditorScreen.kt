package com.tobietheunknown.pianoteacher.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import com.tobietheunknown.pianoteacher.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    songId: String,
    onBack: () -> Unit,
    vm: EditorViewModel = viewModel(factory = EditorViewModel.Factory(LocalContext.current, songId)),
) {
    val song by vm.song.collectAsState()

    // Split-mode state: which phrase is being split + at which measure
    var splitFor by remember { mutableStateOf<Int?>(null) }
    var splitAtMeasure by remember { mutableStateOf(1) }

    Scaffold(containerColor = Background) { padding ->
        Box(modifier = Modifier
            .fillMaxSize()
            .padding(padding)) {
            Column(modifier = Modifier
                .align(Alignment.TopCenter)
                .widthIn(max = 980.dp)
                .fillMaxSize()) {
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
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 360.dp),
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            EditorOverview(
                                phrases = song!!.phrases.size,
                                measures = song!!.totalMeasures,
                                notes = song!!.phrases.sumOf { it.tracks.melody.size + it.tracks.chords.size },
                            )
                        }
                        item(span = { GridItemSpan(maxLineSpan) }) {
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

        }
    }
}

@Composable
private fun EditorOverview(phrases: Int, measures: Int, notes: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(IndigoAccent.copy(alpha = 0.10f))
            .border(1.dp, IndigoAccent.copy(alpha = 0.22f), RoundedCornerShape(16.dp))
            .height(IntrinsicSize.Min)
            .padding(vertical = 12.dp),
    ) {
        EditorStat("PHRASES", phrases.toString(), Modifier.weight(1f))
        Box(Modifier.width(1.dp).fillMaxHeight().background(BorderColor))
        EditorStat("MESURES", measures.toString(), Modifier.weight(1f))
        Box(Modifier.width(1.dp).fillMaxHeight().background(BorderColor))
        EditorStat("NOTES", notes.toString(), Modifier.weight(1f))
    }
}

@Composable
private fun EditorStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(label, color = TextTertiary, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
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
    beatsPerMeasure: Double = 4.0,
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
                    modifier = Modifier.size(44.dp),
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
                    modifier = Modifier.size(44.dp),
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
                    ) { Text("Découper", color = MaterialTheme.colorScheme.onPrimary) }
                }
            }
        }
    }
}

@Composable
private fun PhrasePreview(
    length: Int,
    beatsPerMeasure: Double,
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
                val x = (n.startTime / totalBeats).toFloat() * w
                if (x in 0f..w) {
                    drawCircle(
                        color = HandRight,
                        radius = 3f,
                        center = Offset(x, topRowY),
                    )
                }
            }
            chords.forEach { n ->
                val x = (n.startTime / totalBeats).toFloat() * w
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
