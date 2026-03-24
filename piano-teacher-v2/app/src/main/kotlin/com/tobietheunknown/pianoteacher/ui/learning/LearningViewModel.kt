package com.tobietheunknown.pianoteacher.ui.learning

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import com.tobietheunknown.pianoteacher.utils.ChordInfo
import com.tobietheunknown.pianoteacher.utils.detectChordOrArpeggio
import com.tobietheunknown.pianoteacher.utils.midiToFrench
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

// ─── Measure-level data structures ────────────────────────────────────────────

data class MeasureData(
    val index: Int,                    // 0-based within phrase
    val phraseIndex: Int,
    val melodyNotes: List<NoteEvent>,  // times relative to measure start
    val chordNotes: List<NoteEvent>,   // times relative to measure start
    val melodyNames: List<String>,     // distinct French names of melody pitches
    val chordInfo: ChordInfo?,         // detected chord (or arpeggio)
    val measureStart: Double           // beat offset within phrase
)

data class PhraseSectionData(
    val phrase: Phrase,
    val phraseIndex: Int,
    val measures: List<MeasureData>,
    val isMastered: Boolean = false
)

// ─── ViewModel ────────────────────────────────────────────────────────────────

class LearningViewModel(
    private val repo: SongRepository,
    private val songId: String
) : ViewModel() {

    val song: StateFlow<Song?> = flow {
        emit(repo.getSong(songId))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(), null)

    private val _masteredPhrases = MutableStateFlow<Set<String>>(emptySet())
    val masteredPhrases: StateFlow<Set<String>> = _masteredPhrases.asStateFlow()

    val sections: StateFlow<List<PhraseSectionData>> = song
        .filterNotNull()
        .combine(_masteredPhrases) { s, mastered -> buildSections(s, mastered) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), emptyList())

    init {
        viewModelScope.launch { _masteredPhrases.value = repo.getMasteredPhrases(songId) }
    }

    fun toggleMastered(phraseId: String) {
        val updated = _masteredPhrases.value.let {
            if (phraseId in it) it - phraseId else it + phraseId
        }
        _masteredPhrases.value = updated
        viewModelScope.launch { repo.updateMasteredPhrases(songId, updated) }
    }

    // ─── Measure computation ──────────────────────────────────────────────────

    private fun buildSections(song: Song, mastered: Set<String>): List<PhraseSectionData> {
        val bpm = song.beatsPerMeasure.toDouble()
        return song.phrases.mapIndexed { phraseIndex, phrase ->
            val measures = (0 until phrase.length).map { mi ->
                val start = mi * bpm
                val end = (mi + 1) * bpm

                val melody = phrase.tracks.melody
                    .filter { it.startTime >= start && it.startTime < end }
                    .map { it.copy(startTime = it.startTime - start) }

                val chords = phrase.tracks.chords
                    .filter { it.startTime >= start && it.startTime < end }
                    .map { it.copy(startTime = it.startTime - start) }

                val chordInfo = if (chords.isNotEmpty()) {
                    detectChordOrArpeggio(
                        pitches = chords.map { it.pitch },
                        startTimes = chords.map { it.startTime }
                    )
                } else null

                val melodyNames = melody.map { midiToFrench(it.pitch, showOctave = false) }.distinct()

                MeasureData(
                    index = mi,
                    phraseIndex = phraseIndex,
                    melodyNotes = melody,
                    chordNotes = chords,
                    melodyNames = melodyNames,
                    chordInfo = chordInfo,
                    measureStart = start
                )
            }
            PhraseSectionData(phrase, phraseIndex, measures, phrase.id in mastered)
        }
    }

    class Factory(private val context: Context, private val songId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            LearningViewModel(SongRepository(context), songId) as T
    }
}
