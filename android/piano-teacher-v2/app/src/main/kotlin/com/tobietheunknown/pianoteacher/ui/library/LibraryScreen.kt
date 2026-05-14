package com.tobietheunknown.pianoteacher.ui.library

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
    onApprentissageSong: (String) -> Unit = onSongSelected,
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
    var sheetSong by remember { mutableStateOf<Song?>(null) }

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
                            onLearn = { sheetSong = song },
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

    var renameSong by remember { mutableStateOf<Song?>(null) }

    sheetSong?.let { song ->
        SongDetailSheet(
            song = song,
            onDismiss = { sheetSong = null },
            onPartition = { sheetSong = null; onSongSelected(song.id) },
            onApprentissage = { sheetSong = null; onApprentissageSong(song.id) },
            onLivePlay = { sheetSong = null; onPlaySong(song.id) },
            onRename = { sheetSong = null; renameSong = song },
            onDelete = { sheetSong = null; showDeleteDialog = song },
        )
    }

    renameSong?.let { song ->
        RenameDialog(
            initial = song.title,
            onCancel = { renameSong = null },
            onConfirm = { newTitle ->
                vm.renameSong(song.id, newTitle)
                renameSong = null
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SongDetailSheet(
    song: Song,
    onDismiss: () -> Unit,
    onPartition: () -> Unit,
    onApprentissage: () -> Unit,
    onLivePlay: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Surface,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Hero row — Cover + title + artist
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                com.tobietheunknown.pianoteacher.ui.common.SongCover(
                    title = song.title,
                    size = 72.dp,
                    cornerRadius = 12.dp,
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        song.title,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 18.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        if (song.artist.isNotBlank()) song.artist else "Artiste inconnu",
                        color = Color(0xFF94A3B8),
                        fontSize = 13.sp,
                    )
                }
            }

            // 3-col stats card — IntrinsicSize.Min so vertical dividers
            // size to the row content instead of fillMaxHeight to the sheet.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0x06FFFFFF))
                    .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(10.dp))
                    .height(IntrinsicSize.Min)
                    .padding(vertical = 10.dp),
            ) {
                SheetStat("PHRASES", song.phrases.size.toString(), Modifier.weight(1f))
                SheetDivider()
                SheetStat("TEMPO", "${song.tempo}", suffix = "bpm", modifier = Modifier.weight(1f))
                SheetDivider()
                SheetStat("MESURES", song.totalMeasures.toString(), Modifier.weight(1f))
            }

            // Partition / Apprentissage / LivePlay actions (3-col grid)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ActionBtn(
                    label = "Partition",
                    icon = Icons.AutoMirrored.Filled.LibraryBooks,
                    primary = true,
                    onClick = onPartition,
                    modifier = Modifier.weight(1f),
                )
                ActionBtn(
                    label = "Apprent.",
                    icon = Icons.Default.School,
                    primary = false,
                    onClick = onApprentissage,
                    modifier = Modifier.weight(1f),
                )
                ActionBtn(
                    label = "LivePlay",
                    icon = Icons.Default.PlayArrow,
                    primary = false,
                    onClick = onLivePlay,
                    modifier = Modifier.weight(1f),
                )
            }

            // Renommer — outline button (accent)
            Box(modifier = Modifier.fillMaxWidth()) {
                com.tobietheunknown.pianoteacher.ui.common.OutlineButton(
                    text = "Renommer",
                    onClick = onRename,
                    color = IndigoAccent,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                )
            }

            // Supprimer — red outline button
            Box(modifier = Modifier.fillMaxWidth()) {
                com.tobietheunknown.pianoteacher.ui.common.OutlineButton(
                    text = "Supprimer",
                    onClick = onDelete,
                    color = RedError,
                    modifier = Modifier
                        .fillMaxWidth(),
                )
            }

            // Annuler
            TextButton(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
            ) {
                Text("Annuler", color = Color(0xFF94A3B8))
            }
        }
    }
}

@Composable
private fun SheetStat(label: String, value: String, modifier: Modifier = Modifier, suffix: String? = null) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                value,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
            )
            suffix?.let {
                Text(
                    it,
                    color = Color(0xFF94A3B8),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 3.dp, bottom = 3.dp),
                )
            }
        }
        Text(
            label,
            color = Color(0xFF94A3B8),
            fontSize = 10.sp,
            letterSpacing = 0.06.sp,
        )
    }
}

@Composable
private fun SheetDivider() {
    Box(
        modifier = Modifier
            .width(1.dp)
            .fillMaxHeight()
            .background(Color(0x14FFFFFF)),
    )
}

@Composable
private fun RenameDialog(
    initial: String,
    onCancel: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var value by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text("Renommer le morceau") },
        text = {
            OutlinedTextField(
                value = value,
                onValueChange = { value = it },
                singleLine = true,
                label = { Text("Nouveau titre") },
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(value) }, enabled = value.trim().isNotEmpty()) {
                Text("Enregistrer", color = IndigoAccent)
            }
        },
        dismissButton = {
            TextButton(onClick = onCancel) { Text("Annuler") }
        },
        containerColor = Surface,
    )
}

@Composable
private fun ActionBtn(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    primary: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (primary) IndigoAccent else Color(0x12FFFFFF))
            .border(
                1.dp,
                if (primary) IndigoAccent else Color(0x14FFFFFF),
                RoundedCornerShape(10.dp),
            )
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (primary) Color.White else Color(0xFFE8EAF0),
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                label,
                color = if (primary) Color.White else Color(0xFFE8EAF0),
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
            )
        }
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
