package com.tobietheunknown.pianoteacher.ui.learning

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearningScreen(
    songId: String,
    onPlayPhrase: (Int) -> Unit,
    onBack: () -> Unit,
    vm: LearningViewModel = viewModel(
        factory = LearningViewModel.Factory(LocalContext.current, songId)
    )
) {
    val song by vm.song.collectAsState()
    val sections by vm.sections.collectAsState()

    Scaffold(
        containerColor = Background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(song?.title ?: "", fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("Apprentissage", fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Surface)
            )
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
                contentPadding = PaddingValues(bottom = 24.dp),
                modifier = Modifier.padding(padding)
            ) {
                item { SongHeader(song = song!!) }

                items(sections) { section ->
                    PhraseSection(
                        section = section,
                        onPlay = { onPlayPhrase(section.phraseIndex) },
                        onToggleMastered = { vm.toggleMastered(section.phrase.id) }
                    )
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

        // Phrase structure overview bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
        ) {
            val total = song.totalMeasures.toFloat().coerceAtLeast(1f)
            song.phrases.forEachIndexed { i, phrase ->
                val fraction = phrase.length / total
                Box(
                    modifier = Modifier
                        .weight(fraction)
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

// ─── Phrase section ───────────────────────────────────────────────────────────

@Composable
private fun PhraseSection(
    section: PhraseSectionData,
    onPlay: () -> Unit,
    onToggleMastered: () -> Unit
) {
    var expanded by remember { mutableStateOf(true) }
    val chevronAngle by animateFloatAsState(if (expanded) 180f else 0f, label = "chevron")

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp, start = 12.dp, end = 12.dp)
    ) {
        // Phrase header row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                .background(Surface)
                .clickable { expanded = !expanded }
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Mastered star
            IconButton(onClick = onToggleMastered, modifier = Modifier.size(28.dp)) {
                Icon(
                    if (section.isMastered) Icons.Default.Star else Icons.Default.StarBorder,
                    null,
                    tint = if (section.isMastered) AmberWarning else Color(0xFF475569),
                    modifier = Modifier.size(18.dp)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(section.phrase.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(
                    "${section.phrase.length} mesures · ${section.measures.sumOf { it.melodyNotes.size + it.chordNotes.size }} notes",
                    fontSize = 11.sp,
                    color = Color(0xFF64748B)
                )
            }

            // Play button
            IconButton(
                onClick = onPlay,
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(50))
                    .background(IndigoAccent)
            ) {
                Icon(Icons.Default.PlayArrow, "Jouer", tint = Color.White, modifier = Modifier.size(16.dp))
            }

            Icon(
                Icons.Default.ExpandMore,
                null,
                tint = Color(0xFF475569),
                modifier = Modifier.size(18.dp).rotate(chevronAngle)
            )
        }

        // Measures
        AnimatedVisibility(visible = expanded) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp))
                    .background(SurfaceVariant)
                    .padding(bottom = 8.dp)
            ) {
                section.measures.forEach { measure ->
                    MeasureCard(measure = measure, beatsPerMeasure = 4) // TODO: from song
                    if (measure.index < section.measures.size - 1) {
                        HorizontalDivider(
                            modifier = Modifier.padding(horizontal = 12.dp),
                            color = Color.White.copy(alpha = 0.04f)
                        )
                    }
                }
            }
        }
    }
}

// ─── Measure card ─────────────────────────────────────────────────────────────

@Composable
private fun MeasureCard(measure: MeasureData, beatsPerMeasure: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        // Measure number badge
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Color.White.copy(alpha = 0.05f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "${measure.index + 1}",
                color = Color(0xFF64748B),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            // Timeline mini-bar
            MiniTimeline(
                melodyNotes = measure.melodyNotes,
                chordNotes = measure.chordNotes,
                beatsPerMeasure = beatsPerMeasure.toDouble()
            )

            Spacer(Modifier.height(6.dp))

            // Melody note names
            if (measure.melodyNames.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("MD:", fontSize = 10.sp, color = CyanMelody.copy(alpha = 0.7f))
                    measure.melodyNames.take(8).forEach { name ->
                        NoteChip(name, CyanMelody)
                    }
                    if (measure.melodyNames.size > 8) {
                        Text("+${measure.melodyNames.size - 8}", fontSize = 10.sp, color = Color(0xFF475569))
                    }
                }
            }

            // Chord info
            if (measure.chordInfo != null) {
                Spacer(Modifier.height(3.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("MG:", fontSize = 10.sp, color = PinkChords.copy(alpha = 0.7f))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(PinkChords.copy(alpha = 0.12f))
                            .border(1.dp, PinkChords.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (measure.chordInfo.isArpeggio) {
                                Icon(Icons.Default.Piano, null, tint = PinkChords, modifier = Modifier.size(10.dp))
                            }
                            Text(measure.chordInfo.name, fontSize = 11.sp, color = PinkChords, fontWeight = FontWeight.SemiBold)
                            if (measure.chordInfo.isArpeggio) {
                                Text("arp.", fontSize = 9.sp, color = PinkChords.copy(alpha = 0.6f))
                            }
                        }
                    }
                }
            } else if (measure.chordNotes.isNotEmpty()) {
                // No recognised chord — show raw note names
                Spacer(Modifier.height(3.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("MG:", fontSize = 10.sp, color = PinkChords.copy(alpha = 0.7f))
                    val chordNames = measure.chordNotes.map { com.tobietheunknown.pianoteacher.utils.midiToFrench(it.pitch, false) }.distinct().take(4)
                    chordNames.forEach { NoteChip(it, PinkChords) }
                }
            }
        }
    }
}

@Composable
private fun NoteChip(name: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(horizontal = 5.dp, vertical = 2.dp)
    ) {
        Text(name, fontSize = 10.sp, color = color, fontWeight = FontWeight.Medium)
    }
}

// ─── Mini timeline ────────────────────────────────────────────────────────────

@Composable
private fun MiniTimeline(
    melodyNotes: List<com.tobietheunknown.pianoteacher.data.model.NoteEvent>,
    chordNotes: List<com.tobietheunknown.pianoteacher.data.model.NoteEvent>,
    beatsPerMeasure: Double
) {
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(20.dp)
    ) {
        val w = size.width
        val h = size.height
        val midY = h / 2f

        // Horizontal baseline
        drawLine(
            color = Color(0xFF1E293B),
            start = Offset(0f, midY),
            end = Offset(w, midY),
            strokeWidth = 1.5f
        )

        // Melody dots above line
        melodyNotes.forEach { note ->
            val x = ((note.startTime / beatsPerMeasure) * w).toFloat().coerceIn(0f, w)
            drawCircle(
                color = CyanMelody,
                radius = 3.5f,
                center = Offset(x, midY - 5f)
            )
        }

        // Chord dots below line
        chordNotes.forEach { note ->
            val x = ((note.startTime / beatsPerMeasure) * w).toFloat().coerceIn(0f, w)
            drawCircle(
                color = PinkChords,
                radius = 3.5f,
                center = Offset(x, midY + 5f)
            )
        }
    }
}
