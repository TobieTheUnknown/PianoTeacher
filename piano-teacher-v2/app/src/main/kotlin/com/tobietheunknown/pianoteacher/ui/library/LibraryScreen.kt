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
import androidx.compose.material.icons.automirrored.filled.LibraryBooks
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
                        // Match web: bold "Bibliothèque" title + dot-separated mono subtitle
                        Text(
                            "Bibliothèque",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 20.sp
                        )
                        val phraseCount = songs.count { it.phrases.isNotEmpty() }
                        Text(
                            "${songs.size} morceaux · $phraseCount avec phrases",
                            fontSize = 11.sp,
                            color = Color(0xFF94A3B8),
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                        )
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
    // Web-aligned horizontal layout: Cover · Title/Artist · Pills + BPM mono
    // Tapping the card opens a bottom sheet via parent; here we keep the
    // card itself non-expanding to mirror the web's actionSheet UX.
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onLearn() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            com.tobietheunknown.pianoteacher.ui.common.SongCover(title = song.title, size = 56.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = song.title,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = if (song.artist.isNotBlank()) song.artist else "Artiste inconnu",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(
                    modifier = Modifier.padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    com.tobietheunknown.pianoteacher.ui.common.Pill(
                        text = if (song.phrases.size > 0) "${song.phrases.size} phr." else "Brouillon",
                        color = if (song.phrases.size > 0) CyanMelody else null,
                    )
                    Text(
                        "${song.tempo} BPM",
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    )
                }
            }
            IconButton(onClick = onPlay, modifier = Modifier.size(36.dp)) {
                Icon(
                    Icons.Default.PlayArrow,
                    contentDescription = "LivePlay",
                    tint = IndigoAccent,
                    modifier = Modifier.size(22.dp),
                )
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
