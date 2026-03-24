package com.tobietheunknown.pianoteacher.ui.synthesia

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class NoteWithHand(
    val note: NoteEvent,
    val isRightHand: Boolean,
    val isActive: Boolean = false   // currently being played
)

data class SynthesiaUiState(
    val song: Song? = null,
    val currentPhraseIndex: Int = 0,
    val currentPhrase: Phrase? = null,
    val visibleNotes: List<NoteWithHand> = emptyList(),
    val pressedKeys: Set<Int> = emptySet(),   // keys physically pressed (MIDI input)
    val expectedKeys: Set<Int> = emptySet(),  // keys expected right now
    val currentBeat: Double = 0.0,
    val totalBeats: Double = 0.0,
    val isPlaying: Boolean = false,
    val isLooping: Boolean = false,
    val playbackSpeed: Float = 1.0f
)

class SynthesiaViewModel(
    private val repo: SongRepository,
    private val songId: String,
    private val initialPhraseIndex: Int
) : ViewModel() {

    private val _state = MutableStateFlow(SynthesiaUiState())
    val state: StateFlow<SynthesiaUiState> = _state.asStateFlow()

    private var playbackJob: Job? = null
    private var startTimeMs: Long = 0L
    private var pausedAtBeat: Double = 0.0

    init {
        viewModelScope.launch {
            val song = repo.getSong(songId) ?: return@launch
            val phrase = song.phrases.getOrNull(initialPhraseIndex)
            val totalBeats = phrase?.let { it.length.toDouble() * song.beatsPerMeasure }
                ?: (song.totalMeasures.toDouble() * song.beatsPerMeasure)

            _state.update {
                it.copy(
                    song = song,
                    currentPhraseIndex = initialPhraseIndex,
                    currentPhrase = phrase,
                    totalBeats = totalBeats
                )
            }
            updateVisibleNotes(0.0)
        }
    }

    fun togglePlayPause() {
        val isPlaying = _state.value.isPlaying
        if (isPlaying) pause() else play()
    }

    private fun play() {
        pausedAtBeat = _state.value.currentBeat
        startTimeMs = System.currentTimeMillis()
        _state.update { it.copy(isPlaying = true) }

        playbackJob = viewModelScope.launch {
            while (isActive) {
                val elapsedMs = System.currentTimeMillis() - startTimeMs
                val speed = _state.value.playbackSpeed
                val bpm = _state.value.song?.tempo ?: 120
                val beatsPerMs = bpm / 60_000.0 * speed
                val currentBeat = pausedAtBeat + elapsedMs * beatsPerMs
                val totalBeats = _state.value.totalBeats

                if (currentBeat >= totalBeats) {
                    if (_state.value.isLooping) {
                        pausedAtBeat = 0.0
                        startTimeMs = System.currentTimeMillis()
                    } else {
                        _state.update { it.copy(currentBeat = totalBeats, isPlaying = false) }
                        break
                    }
                } else {
                    _state.update { it.copy(currentBeat = currentBeat) }
                    updateVisibleNotes(currentBeat)
                    updateExpectedKeys(currentBeat)
                }

                delay(16) // ~60fps
            }
        }
    }

    private fun pause() {
        playbackJob?.cancel()
        pausedAtBeat = _state.value.currentBeat
        _state.update { it.copy(isPlaying = false) }
    }

    fun restart() {
        pause()
        _state.update { it.copy(currentBeat = 0.0) }
        pausedAtBeat = 0.0
        updateVisibleNotes(0.0)
    }

    fun seekToBeat(beat: Double) {
        val wasPlaying = _state.value.isPlaying
        pause()
        _state.update { it.copy(currentBeat = beat) }
        updateVisibleNotes(beat)
        if (wasPlaying) play()
    }

    fun setSpeed(speed: Float) {
        val wasPaying = _state.value.isPlaying
        if (wasPaying) pause()
        _state.update { it.copy(playbackSpeed = speed) }
        if (wasPaying) play()
    }

    fun toggleLoop() {
        _state.update { it.copy(isLooping = !it.isLooping) }
    }

    fun onCanvasTap(x: Float, y: Float) {
        // Future: tap on timeline to seek
    }

    // Called by MIDI manager when a key is pressed
    fun onMidiNoteOn(pitch: Int) {
        _state.update { it.copy(pressedKeys = it.pressedKeys + pitch) }
    }

    fun onMidiNoteOff(pitch: Int) {
        _state.update { it.copy(pressedKeys = it.pressedKeys - pitch) }
    }

    private fun updateVisibleNotes(currentBeat: Double) {
        val song = _state.value.song ?: return
        val phrase = _state.value.currentPhrase

        val melodyNotes: List<NoteEvent>
        val chordNotes: List<NoteEvent>

        if (phrase != null) {
            melodyNotes = phrase.tracks.melody
            chordNotes = phrase.tracks.chords
        } else {
            // Full song: flatten all phrases, offset by cumulative beats
            var offset = 0.0
            val allMelody = mutableListOf<NoteEvent>()
            val allChords = mutableListOf<NoteEvent>()
            song.phrases.forEach { p ->
                p.tracks.melody.forEach { n -> allMelody.add(n.copy(startTime = n.startTime + offset)) }
                p.tracks.chords.forEach { n -> allChords.add(n.copy(startTime = n.startTime + offset)) }
                offset += p.length.toDouble() * song.beatsPerMeasure
            }
            melodyNotes = allMelody
            chordNotes = allChords
        }

        val lookAhead = VISIBLE_BEATS + 1.0
        val visible = mutableListOf<NoteWithHand>()

        melodyNotes.filter { it.startTime + it.duration > currentBeat - 0.5 &&
                             it.startTime < currentBeat + lookAhead }
            .forEach { visible.add(NoteWithHand(it, true, it.startTime <= currentBeat && it.startTime + it.duration > currentBeat)) }

        chordNotes.filter { it.startTime + it.duration > currentBeat - 0.5 &&
                            it.startTime < currentBeat + lookAhead }
            .forEach { visible.add(NoteWithHand(it, false, it.startTime <= currentBeat && it.startTime + it.duration > currentBeat)) }

        _state.update { it.copy(visibleNotes = visible) }
    }

    private fun updateExpectedKeys(currentBeat: Double) {
        val tolerance = 0.15 // beats
        val expected = _state.value.visibleNotes
            .filter { it.note.startTime in (currentBeat - tolerance)..(currentBeat + tolerance) }
            .map { it.note.pitch }
            .toSet()
        _state.update { it.copy(expectedKeys = expected) }
    }

    class Factory(
        private val context: Context,
        private val songId: String,
        private val phraseIndex: Int
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            SynthesiaViewModel(SongRepository(context), songId, phraseIndex) as T
    }
}
