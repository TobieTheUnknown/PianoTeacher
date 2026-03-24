package com.tobietheunknown.pianoteacher.ui.learning

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand
import com.tobietheunknown.pianoteacher.ui.theme.*
import com.tobietheunknown.pianoteacher.utils.midiToFrench
import androidx.compose.foundation.Canvas

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

    val listState = rememberLazyListState()
    val timelineState = rememberLazyListState()

    // Auto-scroll both list and timeline when playing measure changes
    LaunchedEffect(playingMeasure) {
        if (playingMeasure >= 0) {
            timelineState.animateScrollToItem(playingMeasure)
            val measure = allMeasures.getOrNull(playingMeasure)
            if (measure != null) {
                // item index = globalIndex + phraseIndex + 2 (SongHeader + phrase header)
                val itemIdx = measure.globalIndex + measure.phraseIndex + 2
                listState.animateScrollToItem(itemIdx)
            }
        }
    }

    Scaffold(
        containerColor = Background,
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Column {
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

                if (allMeasures.isNotEmpty()) {
                    CoordinationTimeline(
                        allMeasures = allMeasures,
                        song = song,
                        playingMeasureIndex = playingMeasure,
                        focusedMeasureIndex = focusedMeasure,
                        showOctaves = showOctaves,
                        listState = timelineState,
                        onMeasureTap = { vm.playMeasureSingle(it); vm.focusMeasure(it) }
                    )
                }
            }
        },
        bottomBar = {
            if (allMeasures.isNotEmpty()) {
                TransportBar(
                    isPlaying = isPlaying,
                    hand = hand,
                    tempoPercent = tempoPercent,
                    isLooping = isLooping,
                    loopStart = loopStart,
                    loopEnd = loopEnd,
                    totalMeasures = allMeasures.size,
                    onPlay = vm::play,
                    onStop = vm::stop,
                    onHandChange = vm::setHand,
                    onTempoAdjust = vm::adjustTempo,
                    onToggleLoop = vm::toggleLoop,
                    onLoopRangeChange = vm::setLoopRange
                )
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

            else -> LazyColumn(
                state = listState,
                contentPadding = PaddingValues(bottom = 16.dp),
                modifier = Modifier.padding(padding)
            ) {
                item { SongHeader(song = song!!) }

                sections.forEach { section ->
                    item(key = "header_${section.phraseIndex}") {
                        PhraseHeader(
                            section = section,
                            onPlay = { vm.playPhrase(section.phraseIndex) },
                            onToggleMastered = { vm.toggleMastered(section.phrase.id) }
                        )
                    }
                    items(section.measures, key = { it.globalIndex }) { measure ->
                        MeasureCard(
                            measure = measure,
                            beatsPerMeasure = song!!.beatsPerMeasure.toDouble(),
                            isPlaying = measure.globalIndex == playingMeasure,
                            isFocused = measure.globalIndex == focusedMeasure,
                            showDetails = showDetails,
                            showOctaves = showOctaves,
                            onTap = { vm.playMeasureSingle(measure.globalIndex); vm.focusMeasure(measure.globalIndex) },
                            onPlayMD = {
                                vm.setHand(PlaybackHand.RIGHT)
                                vm.playMeasureSingle(measure.globalIndex)
                            },
                            onPlayMG = {
                                vm.setHand(PlaybackHand.LEFT)
                                vm.playMeasureSingle(measure.globalIndex)
                            }
                        )
                    }
                }
            }
        }
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
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
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

// ─── Coordination timeline ────────────────────────────────────────────────────

@Composable
private fun CoordinationTimeline(
    allMeasures: List<MeasureData>,
    song: Song?,
    playingMeasureIndex: Int,
    focusedMeasureIndex: Int,
    showOctaves: Boolean,
    listState: androidx.compose.foundation.lazy.LazyListState,
    onMeasureTap: (Int) -> Unit
) {
    val beatsPerMeasure = song?.beatsPerMeasure ?: 4

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
    ) {
        // Legend
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 3.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(modifier = Modifier.size(6.dp).background(CyanMelody, RoundedCornerShape(1.dp)))
                Text("MD", fontSize = 8.sp, color = CyanMelody.copy(alpha = 0.7f))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(modifier = Modifier.size(6.dp).background(PinkChords, RoundedCornerShape(1.dp)))
                Text("MG", fontSize = 8.sp, color = PinkChords.copy(alpha = 0.7f))
            }
        }

        LazyRow(
            state = listState,
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items(allMeasures, key = { it.globalIndex }) { measure ->
                val isPlaying = measure.globalIndex == playingMeasureIndex
                val isFocused = measure.globalIndex == focusedMeasureIndex

                Column(
                    modifier = Modifier
                        .width(72.dp)
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
                            color = when {
                                isPlaying -> IndigoAccent
                                isFocused -> Color.White.copy(alpha = 0.15f)
                                else -> Color.Transparent
                            },
                            shape = RoundedCornerShape(5.dp)
                        )
                        .clickable { onMeasureTap(measure.globalIndex) }
                        .padding(horizontal = 3.dp, vertical = 3.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "${measure.globalIndex + 1}",
                        fontSize = 8.sp,
                        color = if (isPlaying) IndigoAccent else Color(0xFF475569),
                        fontWeight = if (isPlaying) FontWeight.Bold else FontWeight.Normal
                    )
                    Spacer(Modifier.height(2.dp))
                    TimelineBeatRow(
                        notes = measure.melodyNotes,
                        color = CyanMelody,
                        beatsPerMeasure = beatsPerMeasure,
                        showOctaves = showOctaves
                    )
                    Spacer(Modifier.height(1.dp))
                    TimelineBeatRow(
                        notes = measure.chordNotes,
                        color = PinkChords,
                        beatsPerMeasure = beatsPerMeasure,
                        showOctaves = showOctaves
                    )
                }
            }
        }

        HorizontalDivider(color = Color.White.copy(alpha = 0.06f))
    }
}

@Composable
private fun TimelineBeatRow(
    notes: List<NoteEvent>,
    color: Color,
    beatsPerMeasure: Int,
    showOctaves: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(13.dp),
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
                        text = midiToFrench(beatNotes.first().pitch, showOctaves),
                        fontSize = 5.5.sp,
                        color = color,
                        maxLines = 1,
                        overflow = TextOverflow.Clip
                    )
                }
            }
        }
    }
}

// ─── Phrase header ────────────────────────────────────────────────────────────

@Composable
private fun PhraseHeader(
    section: PhraseSectionData,
    onPlay: () -> Unit,
    onToggleMastered: () -> Unit
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

        Column(modifier = Modifier.weight(1f)) {
            Text(
                section.phrase.name,
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
            Text(
                "${section.phrase.length} mesures · ${section.measures.sumOf { it.melodyNotes.size + it.chordNotes.size }} notes",
                fontSize = 11.sp,
                color = Color(0xFF64748B)
            )
        }

        IconButton(
            onClick = onPlay,
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(50))
                .background(IndigoAccent)
        ) {
            Icon(Icons.Default.PlayArrow, "Jouer", tint = Color.White, modifier = Modifier.size(16.dp))
        }
    }
}

// ─── Measure card ─────────────────────────────────────────────────────────────

@Composable
private fun MeasureCard(
    measure: MeasureData,
    beatsPerMeasure: Double,
    isPlaying: Boolean,
    isFocused: Boolean,
    showDetails: Boolean,
    showOctaves: Boolean,
    onTap: () -> Unit,
    onPlayMD: () -> Unit,
    onPlayMG: () -> Unit
) {
    val borderColor = when {
        isPlaying -> IndigoAccent
        isFocused -> Color.White.copy(alpha = 0.12f)
        else -> Color.Transparent
    }
    val bgColor = when {
        isPlaying -> IndigoAccent.copy(alpha = 0.07f)
        isFocused -> Color.White.copy(alpha = 0.02f)
        else -> Color.Transparent
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 3.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .then(
                if (isPlaying || isFocused)
                    Modifier.border(1.dp, borderColor, RoundedCornerShape(8.dp))
                else Modifier
            )
            .clickable(onClick = onTap)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        // Measure number badge
        Box(
            modifier = Modifier
                .size(26.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(if (isPlaying) IndigoAccent else Color.White.copy(alpha = 0.05f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "${measure.globalIndex + 1}",
                color = if (isPlaying) Color.White else Color(0xFF64748B),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            // Mini timeline
            MiniTimeline(
                melodyNotes = measure.melodyNotes,
                chordNotes = measure.chordNotes,
                beatsPerMeasure = beatsPerMeasure
            )

            Spacer(Modifier.height(5.dp))

            // Melody (MD)
            if (measure.melodyNotes.isNotEmpty()) {
                val pitches = measure.melodyNotes.map { it.pitch }.distinct()
                val names = pitches.map { midiToFrench(it, showOctaves) }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("MD:", fontSize = 10.sp, color = CyanMelody.copy(alpha = 0.7f))
                    val visible = if (showDetails) names else names.take(4)
                    visible.forEach { NoteChip(it, CyanMelody) }
                    if (!showDetails && names.size > 4) {
                        Text("+${names.size - 4}", fontSize = 9.sp, color = Color(0xFF475569))
                    }
                }
            }

            // Chords (MG)
            if (measure.chordInfo != null) {
                Spacer(Modifier.height(3.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("MG:", fontSize = 10.sp, color = PinkChords.copy(alpha = 0.7f))
                    ChordChip(
                        chordInfo = measure.chordInfo,
                        chordNotes = measure.chordNotes,
                        showDetails = showDetails,
                        showOctaves = showOctaves
                    )
                }
            } else if (measure.chordNotes.isNotEmpty()) {
                Spacer(Modifier.height(3.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("MG:", fontSize = 10.sp, color = PinkChords.copy(alpha = 0.7f))
                    measure.chordNotes.map { midiToFrench(it.pitch, showOctaves) }.distinct().take(5)
                        .forEach { NoteChip(it, PinkChords) }
                }
            }
        }

        // Per-hand play buttons
        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalAlignment = Alignment.End
        ) {
            SmallPlayButton("▶MD", CyanMelody, onPlayMD)
            SmallPlayButton("▶MG", PinkChords, onPlayMG)
        }
    }
}

@Composable
private fun ChordChip(
    chordInfo: com.tobietheunknown.pianoteacher.utils.ChordInfo,
    chordNotes: List<NoteEvent>,
    showDetails: Boolean,
    showOctaves: Boolean
) {
    Column {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(4.dp))
                .background(PinkChords.copy(alpha = 0.12f))
                .border(1.dp, PinkChords.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
                .padding(horizontal = 6.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (chordInfo.isArpeggio) {
                Icon(Icons.Default.MusicNote, null, tint = PinkChords, modifier = Modifier.size(9.dp))
            }
            Text(chordInfo.name, fontSize = 11.sp, color = PinkChords, fontWeight = FontWeight.SemiBold)
            if (chordInfo.isArpeggio) {
                Text("arp.", fontSize = 9.sp, color = PinkChords.copy(alpha = 0.6f))
            }
        }
        if (showDetails && chordNotes.isNotEmpty()) {
            Spacer(Modifier.height(2.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                chordNotes.map { midiToFrench(it.pitch, showOctaves) }.distinct().take(6)
                    .forEach { NoteChip(it, PinkChords) }
            }
        }
    }
}

@Composable
private fun NoteChip(name: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(3.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(horizontal = 4.dp, vertical = 1.dp)
    ) {
        Text(name, fontSize = 9.sp, color = color, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun SmallPlayButton(label: String, color: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.12f))
            .clickable(onClick = onClick)
            .padding(horizontal = 5.dp, vertical = 2.dp)
    ) {
        Text(label, fontSize = 9.sp, color = color, fontWeight = FontWeight.Medium)
    }
}

// ─── Mini timeline canvas ─────────────────────────────────────────────────────

@Composable
private fun MiniTimeline(
    melodyNotes: List<NoteEvent>,
    chordNotes: List<NoteEvent>,
    beatsPerMeasure: Double
) {
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(18.dp)
    ) {
        val w = size.width
        val h = size.height
        val midY = h / 2f

        drawLine(
            color = Color(0xFF1E293B),
            start = Offset(0f, midY),
            end = Offset(w, midY),
            strokeWidth = 1.5f
        )

        melodyNotes.forEach { note ->
            val x = ((note.startTime / beatsPerMeasure) * w).toFloat().coerceIn(0f, w)
            drawCircle(color = CyanMelody, radius = 3f, center = Offset(x, midY - 5f))
        }

        chordNotes.forEach { note ->
            val x = ((note.startTime / beatsPerMeasure) * w).toFloat().coerceIn(0f, w)
            drawCircle(color = PinkChords, radius = 3f, center = Offset(x, midY + 5f))
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
    onPlay: () -> Unit,
    onStop: () -> Unit,
    onHandChange: (PlaybackHand) -> Unit,
    onTempoAdjust: (Float) -> Unit,
    onToggleLoop: () -> Unit,
    onLoopRangeChange: (Int, Int) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Surface)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        AnimatedVisibility(visible = isLooping) {
            Column {
                LoopRangeRow(loopStart, loopEnd, totalMeasures, onLoopRangeChange)
                Spacer(Modifier.height(8.dp))
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Hand selector
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                HandButton("MG", hand == PlaybackHand.LEFT, PinkChords) { onHandChange(PlaybackHand.LEFT) }
                HandButton("2", hand == PlaybackHand.BOTH, IndigoAccent) { onHandChange(PlaybackHand.BOTH) }
                HandButton("MD", hand == PlaybackHand.RIGHT, CyanMelody) { onHandChange(PlaybackHand.RIGHT) }
            }

            // Tempo control
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                IconButton(onClick = { onTempoAdjust(-0.1f) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Remove, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(14.dp))
                }
                Text(
                    "${(tempoPercent * 100).toInt()}%",
                    color = if (tempoPercent != 1.0f) IndigoAccent else Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.widthIn(min = 36.dp),
                    textAlign = TextAlign.Center
                )
                IconButton(onClick = { onTempoAdjust(0.1f) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Add, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(14.dp))
                }
            }

            // Playback controls
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onStop,
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.07f))
                ) {
                    Icon(Icons.Default.Stop, null, tint = Color(0xFF94A3B8), modifier = Modifier.size(16.dp))
                }

                IconButton(
                    onClick = onPlay,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(IndigoAccent)
                ) {
                    Icon(
                        if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }

                IconButton(
                    onClick = onToggleLoop,
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isLooping) AmberWarning.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.07f))
                ) {
                    Icon(
                        Icons.Default.Repeat,
                        null,
                        tint = if (isLooping) AmberWarning else Color(0xFF64748B),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun HandButton(label: String, selected: Boolean, activeColor: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (selected) activeColor.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.06f))
            .then(
                if (selected) Modifier.border(1.dp, activeColor, RoundedCornerShape(6.dp))
                else Modifier
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 5.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            label,
            fontSize = 11.sp,
            color = if (selected) activeColor else Color(0xFF64748B),
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun LoopRangeRow(
    loopStart: Int,
    loopEnd: Int,
    totalMeasures: Int,
    onRangeChange: (Int, Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
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
        Text(
            "$value",
            fontSize = 12.sp,
            color = AmberWarning,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.widthIn(min = 22.dp),
            textAlign = TextAlign.Center
        )
        IconButton(onClick = onIncrement, modifier = Modifier.size(24.dp)) {
            Icon(Icons.Default.Add, null, tint = AmberWarning, modifier = Modifier.size(11.dp))
        }
    }
}
