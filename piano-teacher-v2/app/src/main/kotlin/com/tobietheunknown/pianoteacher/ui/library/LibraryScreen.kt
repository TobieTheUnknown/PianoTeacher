package com.tobietheunknown.pianoteacher.ui.library

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    importUriString: String? = null,
    onImportConsumed: () -> Unit = {},
    onSongSelected: (String) -> Unit,
    onPlaySong: (String) -> Unit,
    onSettings: () -> Unit,
    vm: LibraryViewModel = viewModel(factory = LibraryViewModel.Factory(LocalContext.current))
) {
    val songs by vm.songs.collectAsState(initial = emptyList())
    val importState by vm.importState.collectAsState()

    // Handle deep link / share intent import
    LaunchedEffect(importUriString) {
        importUriString?.let {
            vm.importFile(Uri.parse(it))
            onImportConsumed()
        }
    }
    var showDeleteDialog by remember { mutableStateOf<Song?>(null) }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { vm.importFile(it) }
    }

    Scaffold(
        containerColor = Background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Piano Teacher", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Bibliothèque", fontSize = 12.sp, color = Color(0xFF94A3B8))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Surface),
                actions = {
                    IconButton(onClick = { importLauncher.launch(arrayOf("*/*")) }) {
                        Icon(Icons.Default.Add, "Importer", tint = CyanMelody)
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, "Réglages", tint = Color(0xFF94A3B8))
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Import status banner
            AnimatedVisibility(visible = importState != ImportState.Idle) {
                ImportBanner(state = importState, onDismiss = vm::clearImportState)
            }

            if (songs.isEmpty()) {
                EmptyLibrary(onImport = { importLauncher.launch(arrayOf("*/*")) })
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(songs, key = { it.id }) { song ->
                        SongCard(
                            song = song,
                            onLearn = { onSongSelected(song.id) },
                            onPlay = { onPlaySong(song.id) },
                            onDelete = { showDeleteDialog = song }
                        )
                    }
                }
            }
        }
    }

    showDeleteDialog?.let { song ->
        AlertDialog(
            onDismissRequest = { showDeleteDialog = null },
            title = { Text("Supprimer « ${song.title} » ?") },
            text = { Text("Cette action est irréversible.") },
            confirmButton = {
                TextButton(onClick = { vm.deleteSong(song); showDeleteDialog = null }) {
                    Text("Supprimer", color = RedError)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = null }) { Text("Annuler") }
            },
            containerColor = Surface
        )
    }
}

@Composable
private fun SongCard(
    song: Song,
    onLearn: () -> Unit,
    onPlay: () -> Unit,
    onDelete: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = song.title,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (song.artist.isNotBlank()) {
                        Text(
                            text = song.artist,
                            fontSize = 13.sp,
                            color = Color(0xFF94A3B8)
                        )
                    }
                }
                Icon(
                    if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    null,
                    tint = Color(0xFF64748B)
                )
            }

            // Metadata chips
            Row(
                modifier = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                MetaChip("${song.tempo} BPM")
                MetaChip("${song.phrases.size} phrases")
                MetaChip("${song.totalMeasures} mes.")
            }

            // Expanded actions
            AnimatedVisibility(visible = expanded) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onLearn,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
                    ) {
                        Icon(Icons.Default.LibraryBooks, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Apprendre")
                    }
                    Button(
                        onClick = onPlay,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyanMelody.copy(alpha = 0.2f)),
                    ) {
                        Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(16.dp), tint = CyanMelody)
                        Spacer(Modifier.width(4.dp))
                        Text("Synthesia", color = CyanMelody)
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, null, tint = RedError.copy(alpha = 0.6f))
                    }
                }
            }
        }
    }
}

@Composable
private fun MetaChip(label: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.05f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(label, fontSize = 11.sp, color = Color(0xFF94A3B8))
    }
}

@Composable
private fun ImportBanner(state: ImportState, onDismiss: () -> Unit) {
    val (bg, text) = when (state) {
        is ImportState.Loading -> SurfaceVariant to "Import en cours…"
        is ImportState.Success -> GreenSuccess.copy(alpha = 0.15f) to "✓ ${state.message}"
        is ImportState.Error -> RedError.copy(alpha = 0.15f) to "✗ ${state.message}"
        ImportState.Idle -> return
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(bg)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text, color = Color.White, fontSize = 14.sp)
        if (state !is ImportState.Loading) {
            TextButton(onClick = onDismiss) { Text("OK", color = Color(0xFF94A3B8)) }
        }
    }
}

@Composable
private fun EmptyLibrary(onImport: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.MusicNote,
            null,
            modifier = Modifier.size(64.dp),
            tint = Color(0xFF334155)
        )
        Spacer(Modifier.height(16.dp))
        Text("Bibliothèque vide", color = Color(0xFF64748B), fontWeight = FontWeight.Medium)
        Text(
            "Importe un fichier .mid ou .json",
            fontSize = 13.sp,
            color = Color(0xFF475569)
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onImport,
            colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
        ) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Importer un morceau")
        }
    }
}
