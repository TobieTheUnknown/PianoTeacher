package com.tobietheunknown.pianoteacher.ui.library

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

sealed class ImportState {
    object Idle : ImportState()
    object Loading : ImportState()
    data class Success(val message: String) : ImportState()
    data class Error(val message: String) : ImportState()
}

class LibraryViewModel(private val repo: SongRepository) : ViewModel() {

    val songs: StateFlow<List<Song>> = repo.songs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _importState = MutableStateFlow<ImportState>(ImportState.Idle)
    val importState: StateFlow<ImportState> = _importState.asStateFlow()

    fun importFile(uri: Uri) {
        viewModelScope.launch {
            _importState.value = ImportState.Loading
            _importState.value = when (val result = repo.importFromUri(uri)) {
                is SongRepository.ImportResult.Success ->
                    ImportState.Success("« ${result.song.title} » importé · ${result.song.phrases.size} phrases")
                is SongRepository.ImportResult.MultiSuccess ->
                    ImportState.Success("${result.songs.size} morceaux importés")
                is SongRepository.ImportResult.Error ->
                    ImportState.Error(result.message)
            }
        }
    }

    fun deleteSong(song: Song) {
        viewModelScope.launch { repo.deleteSong(song) }
    }

    fun clearImportState() {
        _importState.value = ImportState.Idle
    }

    class Factory(private val context: Context) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            LibraryViewModel(SongRepository(context)) as T
    }
}
