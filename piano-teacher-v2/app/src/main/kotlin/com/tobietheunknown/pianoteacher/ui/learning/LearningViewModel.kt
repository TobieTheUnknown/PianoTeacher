package com.tobietheunknown.pianoteacher.ui.learning

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.audio.AudioEngine
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import com.tobietheunknown.pianoteacher.utils.ChordInfo
import com.tobietheunknown.pianoteacher.utils.detectChordOrArpeggio
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand

// ─── Data structures ─────────────────────────────────────────────────────────

data class MeasureData(
    val index: Int,           // 0-based within phrase
    val phraseIndex: Int,
    val globalIndex: Int,     // flat index across all measures in the song
    val melodyNotes: List<NoteEvent>,
    val chordNotes: List<NoteEvent>,
    val chordInfo: ChordInfo?,
    val measureStart: Double  // beat offset within phrase
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
    private val songId: String,
    private val audioEngine: AudioEngine
) : ViewModel() {

    private val _song = MutableStateFlow<Song?>(null)
    val song: StateFlow<Song?> = _song.asStateFlow()

    private val _masteredPhrases = MutableStateFlow<Set<String>>(emptySet())

    val sections: StateFlow<List<PhraseSectionData>> = song
        .filterNotNull()
        .combine(_masteredPhrases) { s, mastered -> buildSections(s, mastered) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), emptyList())

    /** Flat list of all measures across all phrases, in order */
    val allMeasures: StateFlow<List<MeasureData>> = sections
        .map { secs -> secs.flatMap { it.measures } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(), emptyList())

    // ─── Playback state ───────────────────────────────────────────────────────

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    /** Global measure index currently playing, -1 if stopped */
    private val _playingMeasureIndex = MutableStateFlow(-1)
    val playingMeasureIndex: StateFlow<Int> = _playingMeasureIndex.asStateFlow()

    /** Global measure index currently focused (for navigation) */
    private val _focusedMeasureIndex = MutableStateFlow(0)
    val focusedMeasureIndex: StateFlow<Int> = _focusedMeasureIndex.asStateFlow()

    private val _playbackHand = MutableStateFlow(PlaybackHand.BOTH)
    val playbackHand: StateFlow<PlaybackHand> = _playbackHand.asStateFlow()

    private val _tempoPercent = MutableStateFlow(1.0f)
    val tempoPercent: StateFlow<Float> = _tempoPercent.asStateFlow()

    private val _isLooping = MutableStateFlow(false)
    val isLooping: StateFlow<Boolean> = _isLooping.asStateFlow()

    private val _loopStart = MutableStateFlow(0)
    val loopStart: StateFlow<Int> = _loopStart.asStateFlow()

    private val _loopEnd = MutableStateFlow(0)
    val loopEnd: StateFlow<Int> = _loopEnd.asStateFlow()

    // ─── UI state ─────────────────────────────────────────────────────────────

    private val _showDetails = MutableStateFlow(false)
    val showDetails: StateFlow<Boolean> = _showDetails.asStateFlow()

    private val _showOctaves = MutableStateFlow(false)
    val showOctaves: StateFlow<Boolean> = _showOctaves.asStateFlow()

    private var playbackJob: Job? = null

    init {
        viewModelScope.launch {
            _song.value = repo.getSong(songId)
            _masteredPhrases.value = repo.getMasteredPhrases(songId)
        }
        audioEngine.start()
    }

    // ─── UI actions ───────────────────────────────────────────────────────────

    fun toggleMastered(phraseId: String) {
        val updated = _masteredPhrases.value.let {
            if (phraseId in it) it - phraseId else it + phraseId
        }
        _masteredPhrases.value = updated
        viewModelScope.launch { repo.updateMasteredPhrases(songId, updated) }
    }

    fun setHand(hand: PlaybackHand) { _playbackHand.value = hand }

    fun adjustTempo(delta: Float) {
        _tempoPercent.value = (_tempoPercent.value + delta).coerceIn(0.3f, 1.5f)
    }

    fun toggleLoop() {
        val enabling = !_isLooping.value
        _isLooping.value = enabling
        if (enabling) {
            val total = allMeasures.value.size
            if (total > 0) {
                val start = _focusedMeasureIndex.value.coerceIn(0, total - 1)
                _loopStart.value = start
                _loopEnd.value = (start + 7).coerceIn(start, total - 1)
            }
        }
    }

    fun setLoopRange(start: Int, end: Int) {
        val total = allMeasures.value.size
        _loopStart.value = start.coerceIn(0, total - 1)
        _loopEnd.value = end.coerceIn(start, total - 1)
    }

    fun toggleDetails() { _showDetails.value = !_showDetails.value }
    fun toggleOctaves() { _showOctaves.value = !_showOctaves.value }
    fun focusMeasure(globalIdx: Int) { _focusedMeasureIndex.value = globalIdx }

    // ─── Playback ─────────────────────────────────────────────────────────────

    /** Global Play/Pause: plays from the beginning of the song (loops if enabled) */
    fun play() {
        if (_isPlaying.value) { pause(); return }
        val s = song.value ?: return
        val measures = allMeasures.value
        if (measures.isEmpty()) return

        cancelPlayback()
        _isPlaying.value = true

        playbackJob = viewModelScope.launch {
            var idx = 0

            while (isActive) {
                val lo = _loopStart.value
                val hi = _loopEnd.value.coerceAtMost(measures.size - 1)

                if (_isLooping.value && (idx < lo || idx > hi)) idx = lo
                if (idx >= measures.size) break

                _playingMeasureIndex.value = idx
                _focusedMeasureIndex.value = idx

                playMeasureAudio(s, measures[idx])

                if (_isLooping.value && idx >= hi) {
                    idx = lo
                } else {
                    idx++
                }
            }

            _isPlaying.value = false
            _playingMeasureIndex.value = -1
        }
    }

    fun pause() {
        cancelPlayback()
        audioEngine.noteOff(-1)
    }

    fun stop() {
        cancelPlayback()
        _focusedMeasureIndex.value = 0
        audioEngine.noteOff(-1)
    }

    /** Tap on measure card → plays just that single measure, then stops */
    fun playMeasureSingle(globalIdx: Int) {
        val s = song.value ?: return
        val measures = allMeasures.value
        if (globalIdx !in measures.indices) return

        cancelPlayback()
        _isPlaying.value = true
        _focusedMeasureIndex.value = globalIdx

        playbackJob = viewModelScope.launch {
            _playingMeasureIndex.value = globalIdx
            playMeasureAudio(s, measures[globalIdx])
            _isPlaying.value = false
            _playingMeasureIndex.value = -1
        }
    }

    /** Play button on phrase header → plays the full phrase then stops */
    fun playPhrase(phraseIdx: Int) {
        val s = song.value ?: return
        val secs = sections.value
        if (phraseIdx !in secs.indices) return

        cancelPlayback()
        _isPlaying.value = true

        playbackJob = viewModelScope.launch {
            val measures = allMeasures.value
            val section = secs[phraseIdx]
            val globalStart = section.measures.firstOrNull()?.globalIndex ?: return@launch
            val globalEnd = section.measures.lastOrNull()?.globalIndex ?: return@launch

            _focusedMeasureIndex.value = globalStart

            for (idx in globalStart..globalEnd) {
                if (!isActive) break
                _playingMeasureIndex.value = idx
                _focusedMeasureIndex.value = idx
                playMeasureAudio(s, measures.getOrNull(idx) ?: break)
            }

            _isPlaying.value = false
            _playingMeasureIndex.value = -1
        }
    }

    private fun cancelPlayback() {
        playbackJob?.cancel()
        playbackJob = null
        _isPlaying.value = false
        _playingMeasureIndex.value = -1
    }

    private suspend fun playMeasureAudio(song: Song, measure: MeasureData) {
        val beatMs = 60_000.0 / (song.tempo * _tempoPercent.value)
        val measureDurationMs = (song.beatsPerMeasure * beatMs).toLong()
        val startTime = System.currentTimeMillis()

        // Build note list based on hand selection:
        // BOTH → play NOTHING (user plays everything via MIDI)
        // LEFT → play only melody (right hand backing)
        // RIGHT → play only chords (left hand backing)
        data class PlayNote(val note: NoteEvent, val velocity: Int)

        val hand = _playbackHand.value
        val notes = when (hand) {
            PlaybackHand.LEFT -> {
                measure.melodyNotes.map { PlayNote(it, 80) }  // right hand backing
            }
            PlaybackHand.RIGHT -> {
                measure.chordNotes.map { PlayNote(it, 80) }   // left hand backing
            }
            PlaybackHand.BOTH -> {
                (measure.melodyNotes + measure.chordNotes).map { PlayNote(it, 80) }
            }
        }.sortedBy { it.note.startTime }

        // Build a merged timeline of noteOn and noteOff events for precise timing
        data class AudioEvent(val timeMs: Long, val pitch: Int, val velocity: Int, val isOn: Boolean)
        val events = mutableListOf<AudioEvent>()
        for (pn in notes) {
            val onMs = (pn.note.startTime * beatMs).toLong()
            val offMs = ((pn.note.startTime + pn.note.duration) * beatMs).toLong()
                .coerceAtMost(measureDurationMs)
            events.add(AudioEvent(onMs, pn.note.pitch, pn.velocity, true))
            events.add(AudioEvent(offMs, pn.note.pitch, 0, false))
        }
        events.sortBy { it.timeMs }

        try {
            for (ev in events) {
                val elapsed = System.currentTimeMillis() - startTime
                val wait = ev.timeMs - elapsed
                if (wait > 0) delay(wait)
                if (ev.isOn) {
                    audioEngine.noteOn(ev.pitch, ev.velocity)
                } else {
                    audioEngine.noteOff(ev.pitch)
                }
            }

            // Hold until end of measure
            val elapsed = System.currentTimeMillis() - startTime
            val hold = (measureDurationMs - elapsed).coerceAtLeast(0)
            if (hold > 0) delay(hold)
        } finally {
            // Always release remaining notes, even if the coroutine is cancelled
            audioEngine.noteOff(-1)
        }
    }

    // ─── Song & Phrase editing ───────────────────────────────────────────────

    fun renameSong(newTitle: String) {
        val s = song.value ?: return
        _song.value = s.copy(title = newTitle)
        viewModelScope.launch { repo.updateSongTitle(songId, newTitle) }
    }

    fun renamePhrase(phraseIndex: Int, newName: String) {
        val s = song.value ?: return
        val newPhrases = s.phrases.toMutableList()
        if (phraseIndex !in newPhrases.indices) return
        newPhrases[phraseIndex] = newPhrases[phraseIndex].copy(name = newName)
        val updatedSong = s.copy(phrases = newPhrases)
        _song.value = updatedSong
        viewModelScope.launch { repo.updateSong(updatedSong) }
    }

    fun deletePhrase(phraseIndex: Int) {
        val s = _song.value ?: return
        if (s.phrases.size <= 1 || phraseIndex == 0) return

        val prev = s.phrases[phraseIndex - 1]
        val target = s.phrases[phraseIndex]
        val bpm = s.beatsPerMeasure.toDouble()
        val offset = prev.length * bpm

        val mergedMelody = prev.tracks.melody + target.tracks.melody.map { it.copy(startTime = it.startTime + offset) }
        val mergedChords = prev.tracks.chords + target.tracks.chords.map { it.copy(startTime = it.startTime + offset) }
        val mergedPhrase = prev.copy(
            length = prev.length + target.length,
            tracks = prev.tracks.copy(melody = mergedMelody, chords = mergedChords)
        )

        val newPhrases = s.phrases.toMutableList()
        newPhrases[phraseIndex - 1] = mergedPhrase
        newPhrases.removeAt(phraseIndex)

        val updated = s.copy(phrases = newPhrases)
        _song.value = updated
        viewModelScope.launch { repo.updateSong(updated) }
    }

    fun splitPhraseAtMeasure(globalMeasureIdx: Int, newPhraseName: String?) {
        val s = song.value ?: return
        val measures = allMeasures.value
        val measure = measures.getOrNull(globalMeasureIdx) ?: return
        val phraseIdx = measure.phraseIndex
        val localMeasureIdx = measure.index
        if (localMeasureIdx == 0) return // Can't split at first measure

        val phrase = s.phrases[phraseIdx]
        val bpm = s.beatsPerMeasure.toDouble()
        val splitBeat = localMeasureIdx * bpm

        // Split melody and chords
        val firstMelody = phrase.tracks.melody.filter { it.startTime < splitBeat }
        val secondMelody = phrase.tracks.melody.filter { it.startTime >= splitBeat }
            .map { it.copy(startTime = it.startTime - splitBeat) }
        val firstChords = phrase.tracks.chords.filter { it.startTime < splitBeat }
        val secondChords = phrase.tracks.chords.filter { it.startTime >= splitBeat }
            .map { it.copy(startTime = it.startTime - splitBeat) }

        val firstPhrase = phrase.copy(
            length = localMeasureIdx,
            tracks = phrase.tracks.copy(melody = firstMelody, chords = firstChords)
        )
        val secondPhrase = phrase.copy(
            id = java.util.UUID.randomUUID().toString(),
            name = newPhraseName ?: "Phrase ${phraseIdx + 2}",
            length = phrase.length - localMeasureIdx,
            tracks = phrase.tracks.copy(melody = secondMelody, chords = secondChords)
        )

        val newPhrases = s.phrases.toMutableList()
        newPhrases[phraseIdx] = firstPhrase
        newPhrases.add(phraseIdx + 1, secondPhrase)

        val updatedSong = s.copy(phrases = newPhrases)
        _song.value = updatedSong
        viewModelScope.launch { repo.updateSong(updatedSong) }
    }

    override fun onCleared() {
        super.onCleared()
        cancelPlayback()
        audioEngine.release()
    }

    // ─── Data building ────────────────────────────────────────────────────────

    private fun buildSections(song: Song, mastered: Set<String>): List<PhraseSectionData> {
        val bpm = song.beatsPerMeasure.toDouble()
        var globalIdx = 0
        return song.phrases.mapIndexed { phraseIndex, phrase ->
            val measures = (0 until phrase.length).map { mi ->
                val start = mi * bpm
                val end = (mi + 1) * bpm

                val isLastMeasure = mi == phrase.length - 1
                val melody = phrase.tracks.melody
                    .filter { it.startTime >= start && (if (isLastMeasure) it.startTime <= end else it.startTime < end) }
                    .map { it.copy(startTime = it.startTime - start) }

                val chords = phrase.tracks.chords
                    .filter { it.startTime >= start && (if (isLastMeasure) it.startTime <= end else it.startTime < end) }
                    .map { it.copy(startTime = it.startTime - start) }

                val chordInfo = if (chords.isNotEmpty()) {
                    detectChordOrArpeggio(
                        pitches = chords.map { it.pitch },
                        startTimes = chords.map { it.startTime }
                    )
                } else null

                MeasureData(
                    index = mi,
                    phraseIndex = phraseIndex,
                    globalIndex = globalIdx++,
                    melodyNotes = melody,
                    chordNotes = chords,
                    chordInfo = chordInfo,
                    measureStart = start
                )
            }
            PhraseSectionData(phrase, phraseIndex, measures, phrase.id in mastered)
        }
    }

    class Factory(private val context: Context, private val songId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val engine = AudioEngine(context.applicationContext)
            return LearningViewModel(SongRepository(context), songId, engine) as T
        }
    }
}
