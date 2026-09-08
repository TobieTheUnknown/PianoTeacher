package com.tobietheunknown.pianoteacher.ui.editor

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import com.tobietheunknown.pianoteacher.utils.mergePhrases
import com.tobietheunknown.pianoteacher.utils.splitPhraseAtMeasure
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Editor VM — minimal port of the web SongEditor split / merge actions.
 *
 * Mirrors:
 *   onSplitPhrase(phraseId, splitAtMeasure) → cut into two phrases
 *   onMergePhraseWithPrevious(phraseId) → join with previous
 */
class EditorViewModel(
    private val repo: SongRepository,
    private val songId: String,
) : ViewModel() {

    private val _song = MutableStateFlow<Song?>(null)
    val song: StateFlow<Song?> = _song.asStateFlow()

    init {
        viewModelScope.launch {
            _song.value = repo.getSong(songId)
        }
    }

    fun splitPhrase(phraseIndex: Int, splitAtMeasure: Int) {
        val s = _song.value ?: return
        val phrases = s.phrases.toMutableList()
        val target = phrases.getOrNull(phraseIndex) ?: return
        if (splitAtMeasure <= 0 || splitAtMeasure >= target.length) return

        val beatsPerMeasure = s.beatsPerMeasure
        val (phraseA, phraseB) = splitPhraseAtMeasure(target, splitAtMeasure, beatsPerMeasure) ?: return

        phrases[phraseIndex] = phraseA
        phrases.add(phraseIndex + 1, phraseB)

        val updated = s.copy(phrases = phrases)
        _song.value = updated
        viewModelScope.launch { repo.updateSong(updated) }
    }

    fun mergePhraseWithPrevious(phraseIndex: Int) {
        if (phraseIndex <= 0) return
        val s = _song.value ?: return
        val phrases = s.phrases.toMutableList()
        val prev = phrases[phraseIndex - 1]
        val cur = phrases[phraseIndex]

        val beatsPerMeasure = s.beatsPerMeasure
        val combined = mergePhrases(prev, cur, beatsPerMeasure)

        phrases[phraseIndex - 1] = combined
        phrases.removeAt(phraseIndex)

        val updated = s.copy(phrases = phrases)
        _song.value = updated
        viewModelScope.launch { repo.updateSong(updated) }
    }

    fun renamePhrase(phraseIndex: Int, newName: String) {
        val s = _song.value ?: return
        val phrases = s.phrases.toMutableList()
        val target = phrases.getOrNull(phraseIndex) ?: return
        phrases[phraseIndex] = target.copy(name = newName.ifBlank { target.name })

        val updated = s.copy(phrases = phrases)
        _song.value = updated
        viewModelScope.launch { repo.updateSong(updated) }
    }

    class Factory(private val context: Context, private val songId: String) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            @Suppress("UNCHECKED_CAST")
            return EditorViewModel(SongRepository(context), songId) as T
        }
    }
}
