package com.tobietheunknown.pianoteacher.ui.library

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.LibraryBooks
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.ui.theme.*
import kotlin.math.max

private enum class LibraryFilter(val label: String) {
    ALL("Tous"),
    TO_PREPARE("À préparer"),
    STARTER("Accessible"),
    INTERMEDIATE("Intermédiaire"),
    ADVANCED("Avancé"),
}

private enum class SongDifficulty(val label: String) {
    STARTER("Accessible"), INTERMEDIATE("Intermédiaire"), ADVANCED("Avancé");

    val color: Color
        get() = when (this) {
            STARTER -> GreenSuccess
            INTERMEDIATE -> AmberWarning
            ADVANCED -> PinkChords
        }
}

private fun Song.noteCount(): Int = phrases.sumOf { it.tracks.melody.size + it.tracks.chords.size }

private fun Song.difficulty(): SongDifficulty {
    val notes = phrases.flatMap { it.tracks.melody + it.tracks.chords }
    if (notes.isEmpty()) return SongDifficulty.STARTER
    val beatCount = max(1.0, totalBeats)
    val density = notes.size / beatCount
    val range = (notes.maxOfOrNull { it.pitch } ?: 60) - (notes.minOfOrNull { it.pitch } ?: 60)
    val score = (if (tempo >= 140) 2 else if (tempo >= 105) 1 else 0) +
        (if (density >= 2.2) 2 else if (density >= 1.15) 1 else 0) +
        (if (range >= 36) 2 else if (range >= 24) 1 else 0)
    return when {
        score >= 5 -> SongDifficulty.ADVANCED
        score >= 2 -> SongDifficulty.INTERMEDIATE
        else -> SongDifficulty.STARTER
    }
}

private fun Song.keyLabel(): String {
    val note = when (key.note.trim().replace("♯", "#").replace("♭", "b")) {
        "C" -> "Do"; "C#" -> "Do♯"; "Db" -> "Ré♭"
        "D" -> "Ré"; "D#" -> "Ré♯"; "Eb" -> "Mi♭"
        "E" -> "Mi"; "F" -> "Fa"; "F#" -> "Fa♯"; "Gb" -> "Sol♭"
        "G" -> "Sol"; "G#" -> "Sol♯"; "Ab" -> "La♭"
        "A" -> "La"; "A#" -> "La♯"; "Bb" -> "Si♭"; "B" -> "Si"
        else -> key.note.ifBlank { "Do" }
    }
    val mode = when (key.mode.lowercase()) {
        "minor", "mineur", "min" -> "mineur"
        "major", "majeur", "maj" -> "majeur"
        else -> key.mode.ifBlank { "majeur" }
    }
    return "$note $mode"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    importUriString: String? = null,
    onImportConsumed: () -> Unit = {},
    onSongSelected: (String) -> Unit,
    onEditSong: (String) -> Unit,
    onPlaySong: (String) -> Unit,
    onApprentissageSong: (String) -> Unit = onSongSelected,
    onSongContextSelected: (String) -> Unit = {},
    onSongDeleted: (String) -> Unit = {},
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
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf(LibraryFilter.ALL) }

    val visibleSongs by remember(songs, query, filter) {
        derivedStateOf {
            val normalizedQuery = query.trim().lowercase()
            songs.filter { song ->
                val matchesQuery = normalizedQuery.isBlank() || listOf(
                    song.title,
                    song.artist,
                    song.keyLabel(),
                    song.phrases.joinToString(" ") { it.name },
                ).any { it.lowercase().contains(normalizedQuery) }
                val matchesFilter = when (filter) {
                    LibraryFilter.ALL -> true
                    LibraryFilter.TO_PREPARE -> song.phrases.isEmpty()
                    LibraryFilter.STARTER -> song.difficulty() == SongDifficulty.STARTER
                    LibraryFilter.INTERMEDIATE -> song.difficulty() == SongDifficulty.INTERMEDIATE
                    LibraryFilter.ADVANCED -> song.difficulty() == SongDifficulty.ADVANCED
                }
                matchesQuery && matchesFilter
            }
        }
    }

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
                        Text(
                            "Mon studio",
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary,
                            fontSize = 22.sp
                        )
                        val phraseCount = songs.count { it.phrases.isNotEmpty() }
                        Text(
                            "${songs.size} morceaux · $phraseCount structurés",
                            fontSize = 11.sp,
                            color = TextSecondary,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background),
                actions = {
                    FilledTonalIconButton(
                        onClick = { importLauncher.launch(arrayOf("audio/midi", "application/json", "*/*")) },
                        colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = IndigoAccent.copy(alpha = 0.14f)),
                    ) {
                        Icon(Icons.Default.Add, "Importer un morceau", tint = IndigoAccent)
                    }
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Default.Settings, "Réglages", tint = TextSecondary)
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
                EmptyLibrary(onImport = { importLauncher.launch(arrayOf("audio/midi", "application/json", "*/*")) })
            } else {
                LibraryOverview(songs)
                LibrarySearchAndFilters(
                    query = query,
                    onQuery = { query = it },
                    filter = filter,
                    onFilter = { filter = it },
                )
                if (visibleSongs.isEmpty()) {
                    EmptySearch(onReset = { query = ""; filter = LibraryFilter.ALL })
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 310.dp),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        gridItems(visibleSongs, key = { it.id }) { song ->
                        SongCard(
                            song = song,
                            onLearn = {
                                onSongContextSelected(song.id)
                                sheetSong = song
                            },
                            onPlay = {
                                onSongContextSelected(song.id)
                                onPlaySong(song.id)
                            },
                        )
                    }
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
                TextButton(onClick = {
                    vm.deleteSong(song)
                    onSongDeleted(song.id)
                    showDeleteDialog = null
                }) {
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
            onEditor = { sheetSong = null; onEditSong(song.id) },
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
    onEditor: () -> Unit,
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
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
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
                        color = TextPrimary,
                        fontSize = 18.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        if (song.artist.isNotBlank()) song.artist else "Artiste inconnu",
                        color = TextSecondary,
                        fontSize = 13.sp,
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                MetaChip(song.keyLabel())
                val difficulty = song.difficulty()
                com.tobietheunknown.pianoteacher.ui.common.Pill(
                    text = difficulty.label,
                    color = difficulty.color,
                )
                MetaChip("${song.noteCount()} notes")
            }

            // Three useful dimensions, never inferred from the audio engine.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Hairline)
                    .border(1.dp, BorderColor, RoundedCornerShape(10.dp))
                    .height(IntrinsicSize.Min)
                    .padding(vertical = 10.dp),
            ) {
                SheetStat("PHRASES", song.phrases.size.toString(), Modifier.weight(1f))
                SheetDivider()
                SheetStat("TEMPO", "${song.tempo}", suffix = "bpm", modifier = Modifier.weight(1f))
                SheetDivider()
                SheetStat("MESURES", song.totalMeasures.toString(), Modifier.weight(1f))
            }

            Text(
                "CHOISIR UN MODE",
                color = TextTertiary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
            )

            // Partition and editor remain discoverable, but contextual to a song.
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
                    label = "Coach",
                    icon = Icons.Default.School,
                    primary = false,
                    onClick = onApprentissage,
                    modifier = Modifier.weight(1f),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ActionBtn(
                    label = "Live",
                    icon = Icons.Default.GraphicEq,
                    primary = false,
                    onClick = onLivePlay,
                    modifier = Modifier.weight(1f),
                )
                ActionBtn(
                    label = "Éditeur",
                    icon = Icons.Default.EditNote,
                    primary = false,
                    onClick = onEditor,
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
                Text("Annuler", color = TextSecondary)
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
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
            )
            suffix?.let {
                Text(
                    it,
                    color = TextSecondary,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 3.dp, bottom = 3.dp),
                )
            }
        }
        Text(
            label,
            color = TextSecondary,
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
            .background(BorderColor),
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
            .background(if (primary) IndigoAccent else Surface2)
            .border(
                1.dp,
                if (primary) IndigoAccent else BorderColor,
                RoundedCornerShape(10.dp),
            )
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 12.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (primary) MaterialTheme.colorScheme.onPrimary else TextPrimary,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                label,
                color = if (primary) MaterialTheme.colorScheme.onPrimary else TextPrimary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
            )
        }
    }
}

@Composable
private fun LibraryOverview(songs: List<Song>) {
    val phraseCount = songs.sumOf { it.phrases.size }
    val totalNotes = songs.sumOf { it.noteCount() }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(
                androidx.compose.ui.graphics.Brush.horizontalGradient(
                    listOf(IndigoAccent.copy(alpha = 0.16f), CyanMelody.copy(alpha = 0.06f)),
                )
            )
            .border(1.dp, IndigoAccent.copy(alpha = 0.22f), RoundedCornerShape(18.dp))
            .height(IntrinsicSize.Min)
            .padding(vertical = 13.dp),
    ) {
        OverviewStat("MORCEAUX", songs.size.toString(), Modifier.weight(1f))
        SheetDivider()
        OverviewStat("PHRASES", phraseCount.toString(), Modifier.weight(1f))
        SheetDivider()
        OverviewStat("NOTES", if (totalNotes >= 1_000) "${totalNotes / 1_000}k+" else totalNotes.toString(), Modifier.weight(1f))
    }
}

@Composable
private fun OverviewStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = TextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold)
        Text(label, color = TextTertiary, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
    }
}

@Composable
private fun LibrarySearchAndFilters(
    query: String,
    onQuery: (String) -> Unit,
    filter: LibraryFilter,
    onFilter: (LibraryFilter) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OutlinedTextField(
            value = query,
            onValueChange = onQuery,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            singleLine = true,
            leadingIcon = { Icon(Icons.Default.Search, null, tint = TextTertiary) },
            trailingIcon = if (query.isNotEmpty()) {
                {
                    IconButton(onClick = { onQuery("") }) {
                        Icon(Icons.Default.Close, "Effacer la recherche", tint = TextTertiary)
                    }
                }
            } else null,
            placeholder = { Text("Titre, artiste, tonalité ou phrase", color = TextMuted) },
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                focusedBorderColor = IndigoAccent,
                unfocusedBorderColor = BorderColor,
                focusedContainerColor = Surface2,
                unfocusedContainerColor = Surface2,
                cursorColor = IndigoAccent,
            ),
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            LibraryFilter.entries.forEach { item ->
                FilterChip(
                    selected = filter == item,
                    onClick = { onFilter(item) },
                    label = { Text(item.label) },
                    leadingIcon = if (filter == item) {
                        { Icon(Icons.Default.Check, null, modifier = Modifier.size(15.dp)) }
                    } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = Surface2,
                        labelColor = TextSecondary,
                        selectedContainerColor = IndigoAccent.copy(alpha = 0.16f),
                        selectedLabelColor = IndigoAccent,
                        selectedLeadingIconColor = IndigoAccent,
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = filter == item,
                        borderColor = BorderColor,
                        selectedBorderColor = IndigoAccent.copy(alpha = 0.55f),
                    ),
                )
            }
        }
    }
}

@Composable
private fun EmptySearch(onReset: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Default.SearchOff, null, tint = TextMuted, modifier = Modifier.size(42.dp))
        Spacer(Modifier.height(12.dp))
        Text("Aucun morceau dans cette catégorie", color = TextPrimary, fontWeight = FontWeight.SemiBold)
        TextButton(onClick = onReset) { Text("Afficher toute la bibliothèque", color = IndigoAccent) }
    }
}

@Composable
private fun SongCard(
    song: Song,
    onLearn: () -> Unit,
    onPlay: () -> Unit,
) {
    // Web-aligned horizontal layout: Cover · Title/Artist · Pills + BPM mono
    // Tapping the card opens a bottom sheet via parent; here we keep the
    // card itself non-expanding to mirror the web's actionSheet UX.
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(
                role = Role.Button,
                onClickLabel = "Ouvrir ${song.title}",
                onClick = onLearn,
            ),
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
                    color = TextPrimary,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = if (song.artist.isNotBlank()) song.artist else "Artiste inconnu",
                    fontSize = 12.sp,
                    color = TextSecondary,
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
                        color = TextSecondary,
                        fontSize = 11.sp,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    )
                }
                Row(
                    modifier = Modifier.padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(song.keyLabel(), color = TextTertiary, fontSize = 10.sp, maxLines = 1)
                    Box(Modifier.size(3.dp).clip(CircleShape).background(TextMuted))
                    Text(song.difficulty().label, color = song.difficulty().color, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                FilledTonalIconButton(
                    onClick = onPlay,
                    modifier = Modifier.size(44.dp),
                    colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = IndigoAccent.copy(alpha = 0.14f)),
                ) {
                    Icon(
                        Icons.Default.PlayArrow,
                        contentDescription = "Jouer ${song.title} en Live",
                        tint = IndigoAccent,
                        modifier = Modifier.size(23.dp),
                    )
                }
                Icon(Icons.Default.MoreHoriz, "Ouvrir les modes de pratique", tint = TextMuted, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun MetaChip(label: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Hairline)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(label, fontSize = 11.sp, color = TextSecondary)
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
        Text(text, color = TextPrimary, fontSize = 14.sp)
        if (state !is ImportState.Loading) {
            TextButton(onClick = onDismiss) { Text("OK", color = TextSecondary) }
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
            tint = TextMuted
        )
        Spacer(Modifier.height(16.dp))
        Text("Bibliothèque vide", color = TextTertiary, fontWeight = FontWeight.Medium)
        Text(
            "Importe un fichier .mid ou .json",
            fontSize = 13.sp,
            color = TextMuted
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
