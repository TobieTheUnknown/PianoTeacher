package com.tobietheunknown.pianoteacher.ui.livelearning

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.platform.LocalContext
import com.tobietheunknown.pianoteacher.ui.common.MobileHeader
import com.tobietheunknown.pianoteacher.ui.common.PlaybackDock
import com.tobietheunknown.pianoteacher.ui.common.HandMode
import com.tobietheunknown.pianoteacher.ui.learning.LearningViewModel
import com.tobietheunknown.pianoteacher.ui.theme.*

/**
 * Apprentissage mobile — measure-by-measure cards.
 *
 * Mirrors the web LiveLearning mobile design: MobileHeader · timeline
 * (skipped for now, big lift) · MESURES EN COURS · 01-04 groups · 2x2
 * compact MeasureCards · sticky PlaybackDock at the bottom.
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

    var currentMeasure by remember { mutableStateOf(1) }
    var playing by remember { mutableStateOf(false) }
    var speed by remember { mutableStateOf(100) }
    var handMode by remember { mutableStateOf(HandMode.BOTH) }
    var metronome by remember { mutableStateOf(false) }
    var loop by remember { mutableStateOf(false) }

    val totalMeasures = allMeasures.size

    Scaffold(containerColor = Background) { padding ->
        Box(modifier = Modifier
            .fillMaxSize()
            .padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 130.dp + 64.dp), // dock + tab bar
            ) {
                // MobileHeader
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
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

                // Scrollable measure groups
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    val groups = allMeasures.chunked(4)
                    items(groups.size) { gi ->
                        val group = groups[gi]
                        val startIdx = gi * 4 + 1
                        val endIdx = (gi * 4 + group.size).coerceAtMost(totalMeasures)
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            // Group header
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
                            // 2x2 grid
                            for (row in 0 until 2) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    for (col in 0..1) {
                                        val idx = row * 2 + col
                                        if (idx < group.size) {
                                            val mNumber = startIdx + idx
                                            CompactMeasureCard(
                                                measureNumber = mNumber,
                                                isCurrent = mNumber == currentMeasure,
                                                isPlaying = playing,
                                                onClick = { currentMeasure = mNumber },
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

            // Sticky bottom: PlaybackDock above bottom tab bar (mobile is always 64dp)
            Box(modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 64.dp)
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
                    loopRange = 1..totalMeasures.coerceAtLeast(1),
                    totalMeasures = totalMeasures.coerceAtLeast(1),
                    onPrev = { currentMeasure = (currentMeasure - 1).coerceAtLeast(1) },
                    onNext = { currentMeasure = (currentMeasure + 1).coerceAtMost(totalMeasures.coerceAtLeast(1)) },
                )
            }
        }
    }
}

@Composable
private fun CompactMeasureCard(
    measureNumber: Int,
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    String.format("%02d", measureNumber),
                    color = Color(0xFFA8AEBD),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    MeasurePlayPill("MG", PinkChords)
                    MeasurePlayPill("MD", CyanMelody)
                }
            }
            // Two thin colored rows representing the hand notes
            Box(modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(CyanMelody.copy(alpha = 0.20f)))
            Box(modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(PinkChords.copy(alpha = 0.20f)))
            // Beat strip
            Box(modifier = Modifier
                .fillMaxWidth()
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Color(0x14FFFFFF))) {
                if (isCurrent && isPlaying) {
                    Box(modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(0.4f)
                        .background(IndigoAccent))
                }
            }
        }
    }
}

@Composable
private fun MeasurePlayPill(label: String, color: Color) {
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
