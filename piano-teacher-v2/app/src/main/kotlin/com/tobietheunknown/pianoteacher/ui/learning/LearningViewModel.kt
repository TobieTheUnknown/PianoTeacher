package com.tobietheunknown.pianoteacher.ui.learning

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class LearningViewModel(
    private val repo: SongRepository,
    private val songId: String
) : ViewModel() {

    val song: StateFlow<Song?> = flow {
        emit(repo.getSong(songId))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(), null)

    private val _masteredPhrases = MutableStateFlow<Set<String>>(emptySet())
    val masteredPhrases: StateFlow<Set<String>> = _masteredPhrases.asStateFlow()

    init {
        viewModelScope.launch { _masteredPhrases.value = repo.getMasteredPhrases(songId) }
    }

    fun toggleMastered(phraseId: String) {
        val current = _masteredPhrases.value
        val updated = if (phraseId in current) current - phraseId else current + phraseId
        _masteredPhrases.value = updated
        viewModelScope.launch { repo.updateMasteredPhrases(songId, updated) }
    }

    class Factory(private val context: Context, private val songId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            LearningViewModel(SongRepository(context), songId) as T
    }
}
