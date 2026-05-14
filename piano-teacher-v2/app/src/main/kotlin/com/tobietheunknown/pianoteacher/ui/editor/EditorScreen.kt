package com.tobietheunknown.pianoteacher.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
                    }
                    Column {
                        Text(
                            "Éditeur",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp,
                            letterSpacing = (-0.02).sp,
                        )
                        Text(
                            song?.title ?: songId,
                            color = Color(0xFF6B7280),
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
                                color = Color(0xFF6B7280),
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
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceVariant)
            .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(12.dp))
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
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )
                Text(
                    "$length mesures",
                    color = Color(0xFF94A3B8),
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
                        tint = if (length > 1) IndigoAccent else Color(0xFF334155),
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
                        tint = if (canMerge) Color(0xFFA8AEBD) else Color(0xFF334155),
                    )
                }
            }
        }

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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    StepperBtn("−", enabled = splitAtMeasure > 1) { onSplitAtChange(splitAtMeasure - 1) }
                    Text(
                        "$splitAtMeasure",
                        color = IndigoAccent,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                    )
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
private fun StepperBtn(label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(SurfaceVariant)
            .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(6.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Color(0xFFA8AEBD), fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}
