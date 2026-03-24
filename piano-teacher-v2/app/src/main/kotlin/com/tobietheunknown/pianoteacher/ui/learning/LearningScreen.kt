package com.tobietheunknown.pianoteacher.ui.learning

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
import com.tobietheunknown.pianoteacher.data.model.Phrase
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
    val masteredPhrases by vm.masteredPhrases.collectAsState()

    Scaffold(
        containerColor = Background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(song?.title ?: "", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Apprentissage", fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Retour", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Surface)
            )
        }
    ) { padding ->
        song?.let { s ->
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(padding)
            ) {
                item { SongHeader(song = s) }

                itemsIndexed(s.phrases) { index, phrase ->
                    PhraseCard(
                        phrase = phrase,
                        index = index,
                        isMastered = phrase.id in masteredPhrases,
                        onPlay = { onPlayPhrase(index) },
                        onToggleMastered = { vm.toggleMastered(phrase.id) }
                    )
                }
            }
        } ?: Box(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = IndigoAccent)
        }
    }
}

@Composable
private fun SongHeader(song: Song) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
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
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
        ) {
            val total = song.totalMeasures.toFloat()
            song.phrases.forEachIndexed { i, phrase ->
                val fraction = phrase.length / total
                val color = if (i % 2 == 0) IndigoAccent else CyanMelody.copy(alpha = 0.6f)
                Box(
                    modifier = Modifier
                        .weight(fraction)
                        .fillMaxHeight()
                        .background(color)
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

@Composable
private fun PhraseCard(
    phrase: Phrase,
    index: Int,
    isMastered: Boolean,
    onPlay: () -> Unit,
    onToggleMastered: () -> Unit
) {
    val borderColor = when {
        isMastered -> GreenSuccess.copy(alpha = 0.4f)
        else -> Color.Transparent
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceVariant)
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Index badge
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (isMastered) GreenSuccess.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.05f)),
            contentAlignment = Alignment.Center
        ) {
            if (isMastered) {
                Icon(Icons.Default.Check, null, tint = GreenSuccess, modifier = Modifier.size(18.dp))
            } else {
                Text("${index + 1}", color = Color(0xFF64748B), fontWeight = FontWeight.Bold)
            }
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(phrase.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${phrase.length} mes.", fontSize = 12.sp, color = Color(0xFF64748B))
                Text("•", fontSize = 12.sp, color = Color(0xFF334155))
                Text(
                    "${phrase.tracks.melody.size + phrase.tracks.chords.size} notes",
                    fontSize = 12.sp, color = Color(0xFF64748B)
                )
            }
        }

        // Mastered toggle
        IconButton(onClick = onToggleMastered, modifier = Modifier.size(36.dp)) {
            Icon(
                if (isMastered) Icons.Default.Star else Icons.Default.StarBorder,
                "Maîtrisé",
                tint = if (isMastered) AmberWarning else Color(0xFF475569)
            )
        }

        // Play button
        IconButton(
            onClick = onPlay,
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(IndigoAccent)
        ) {
            Icon(Icons.Default.PlayArrow, "Jouer", tint = Color.White, modifier = Modifier.size(18.dp))
        }
    }
}

private val CircleShape = RoundedCornerShape(50)
