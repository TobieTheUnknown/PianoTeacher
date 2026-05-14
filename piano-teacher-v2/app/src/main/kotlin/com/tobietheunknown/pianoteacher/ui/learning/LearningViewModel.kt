package com.tobietheunknown.pianoteacher.ui.learning

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.audio.AudioEngine
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.midi.MidiEvent
import com.tobietheunknown.pianoteacher.midi.MidiManager
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import com.tobietheunknown.pianoteacher.utils.ArpeggioMotifResult
import com.tobietheunknown.pianoteacher.utils.ChordInfo
import com.tobietheunknown.pianoteacher.utils.KeySignature
import com.tobietheunknown.pianoteacher.utils.detectArpeggioMotifs
import com.tobietheunknown.pianoteacher.utils.detectChordOrArpeggio
import com.tobietheunknown.pianoteacher.utils.detectKeySignature
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand

enum class ClefMode { STANDARD, TREBLE_X2, AUTO }

// ─── Data structures ─────────────────────────────────────────────────────────

data class MeasureData(
    val index: Int,           // 0-based within phrase
    val phraseIndex: Int,
    val globalIndex: Int,     // flat index across all measures in the song
    val melodyNotes: List<NoteEvent>,
    val chordNotes: List<NoteEvent>,
    val chordInfo: ChordInfo?,
    val arpeggioMotif: ArpeggioMotifResult? = null,
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
    private val audioEngine: AudioEngine,
    private val midiManager: MidiManager
) : ViewModel() {

    private val _song = MutableStateFlow<Song?>(null)
    val song: StateFlow<Song?> = _song.asStateFlow()

    private val _keySignature = MutableStateFlow<KeySignature?>(null)
    val keySignature: StateFlow<KeySignature?> = _keySignature.asStateFlow()

    private val _masteredPhrases = MutableStateFlow<Set<String>>(emptySet())

    val sections: StateFlow<List<PhraseSectionData>> = combine(
        song.filterNotNull(), _masteredPhrases, _keySignature
    ) { s, mastered, keySig -> buildSections(s, mastered, keySig) }
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

    private val _metronomeEnabled = MutableStateFlow(false)
    val metronomeEnabled: StateFlow<Boolean> = _metronomeEnabled.asStateFlow()
    fun toggleMetronome() { _metronomeEnabled.value = !_metronomeEnabled.value }

    // ─── MIDI input state ─────────────────────────────────────────────────
    private val _pressedKeys = MutableStateFlow<Set<Int>>(emptySet())
    val pressedKeys: StateFlow<Set<Int>> = _pressedKeys.asStateFlow()

    private val _waitMode = MutableStateFlow(false)
    val waitMode: StateFlow<Boolean> = _waitMode.asStateFlow()
    fun toggleWaitMode() { _waitMode.value = !_waitMode.value }

    private val _listenMode = MutableStateFlow(true)
    val listenMode: StateFlow<Boolean> = _listenMode.asStateFlow()
    fun toggleListenMode() { _listenMode.value = !_listenMode.value }

    private val _clefMode = MutableStateFlow(ClefMode.STANDARD)
    val clefMode: StateFlow<ClefMode> = _clefMode.asStateFlow()
    fun cycleClefMode() {
        _clefMode.value = when (_clefMode.value) {
            ClefMode.STANDARD -> ClefMode.TREBLE_X2
            ClefMode.TREBLE_X2 -> ClefMode.AUTO
            ClefMode.AUTO -> ClefMode.STANDARD
        }
    }

    // ─── UI state ─────────────────────────────────────────────────────────────

    private val _showDetails = MutableStateFlow(false)
    val showDetails: StateFlow<Boolean> = _showDetails.asStateFlow()

    private val _showOctaves = MutableStateFlow(false)
    val showOctaves: StateFlow<Boolean> = _showOctaves.asStateFlow()

    private var playbackJob: Job? = null

    init {
        viewModelScope.launch {
            val s = repo.getSong(songId)
            _song.value = s
            _masteredPhrases.value = repo.getMasteredPhrases(songId)

            // Detect key signature from all notes in the song
            if (s != null) {
                val allNotes = s.phrases.flatMap { it.tracks.melody + it.tracks.chords }
                if (allNotes.isNotEmpty()) {
                    _keySignature.value = detectKeySignature(
                        pitches = allNotes.map { it.pitch },
                        durations = allNotes.map { it.duration }
                    )
                }
            }
        }
        audioEngine.start()
        midiManager.startUsbScanning()
        viewModelScope.launch {
            midiManager.events.collect { event ->
                when (event) {
                    is MidiEvent.NoteOn -> {
                        _pressedKeys.value = _pressedKeys.value + event.pitch
                        audioEngine.noteOn(event.pitch, event.velocity)
                    }
                    is MidiEvent.NoteOff -> {
                        _pressedKeys.value = _pressedKeys.value - event.pitch
                        audioEngine.noteOff(event.pitch)
                    }
                    is MidiEvent.SustainPedal -> audioEngine.setSustainPedal(event.engaged)
                }
            }
        }
    }

    // ─── UI actions ───────────────────────────────────────────────────────────

    fun toggleMastered(phraseId: String) {
        val updated = _masteredPhrases.value.let {
            if (phraseId in it) it - phraseId else it + phraseId
        }
        _masteredPhrases.value = updated
        viewModelScope.launch { repo.updateMasteredPhrases(songId, updated) }
    }

    fun setHand(hand: PlaybackHand) {
        _playbackHand.value = hand
        if (hand != PlaybackHand.BOTH) _listenMode.value = false
    }

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
            val beatMs = (60_000.0 / (s.tempo * _tempoPercent.value)).toLong()

            // Preroll — one bar of metronome ticks before the music starts
            // when the metronome is enabled. Matches the web flow.
            if (_metronomeEnabled.value) {
                for (i in 0 until s.beatsPerMeasure) {
                    audioEngine.playClick(isAccent = i == 0)
                    delay(beatMs)
                }
            }

            // Continuous metronome during music: concurrent child coroutine
            if (_metronomeEnabled.value) {
                launch {
                    var beat = 0
                    while (isActive) {
                        audioEngine.playClick(isAccent = beat % s.beatsPerMeasure == 0)
                        beat++
                        delay(beatMs)
                    }
                }
            }

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

    /** Tap on per-hand button → plays only one hand for that measure */
    fun playMeasureHandSingle(globalIdx: Int, playRight: Boolean) {
        val s = song.value ?: return
        val measures = allMeasures.value
        if (globalIdx !in measures.indices) return

        cancelPlayback()
        _isPlaying.value = true

        playbackJob = viewModelScope.launch {
            _playingMeasureIndex.value = globalIdx
            _focusedMeasureIndex.value = globalIdx
            val measure = measures[globalIdx]
            val beatMs = 60_000.0 / (s.tempo * _tempoPercent.value)
            val measureDurationMs = (s.beatsPerMeasure * beatMs).toLong()
            val startTime = System.currentTimeMillis()

            val notes = if (playRight) measure.melodyNotes else measure.chordNotes

            data class AudioEvent(val timeMs: Long, val pitch: Int, val isOn: Boolean)
            val events = mutableListOf<AudioEvent>()
            for (n in notes) {
                val onMs = (n.startTime * beatMs).toLong()
                val offMs = ((n.startTime + n.duration) * beatMs).toLong().coerceAtMost(measureDurationMs)
                events.add(AudioEvent(onMs, n.pitch, true))
                events.add(AudioEvent(offMs, n.pitch, false))
            }
            events.sortBy { it.timeMs }

            try {
                for (ev in events) {
                    val elapsed = System.currentTimeMillis() - startTime
                    val wait = ev.timeMs - elapsed
                    if (wait > 0) delay(wait)
                    if (ev.isOn) audioEngine.noteOn(ev.pitch, 80) else audioEngine.noteOff(ev.pitch)
                }
                val elapsed = System.currentTimeMillis() - startTime
                val hold = (measureDurationMs - elapsed).coerceAtLeast(0)
                if (hold > 0) delay(hold)
            } finally {
                audioEngine.noteOff(-1)
            }

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

        // Build note list based on hand + listen mode:
        // Listen mode (BOTH) → play everything (user listens)
        // 2 mains (BOTH, !listen) → play nothing (user plays everything)
        // LEFT → play melody (right hand backing, user plays left)
        // RIGHT → play chords (left hand backing, user plays right)
        data class PlayNote(val note: NoteEvent, val velocity: Int)

        val hand = _playbackHand.value
        val listen = _listenMode.value
        val notes = when {
            listen && hand == PlaybackHand.BOTH ->
                (measure.melodyNotes + measure.chordNotes).map { PlayNote(it, 80) }
            hand == PlaybackHand.LEFT ->
                measure.melodyNotes.map { PlayNote(it, 80) }
            hand == PlaybackHand.RIGHT ->
                measure.chordNotes.map { PlayNote(it, 80) }
            else -> emptyList() // 2 mains: app plays nothing
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

        // Pre-compute expected pitches for wait mode (only notes the USER should play)
        val userNotes = when {
            listen -> emptyList() // listen mode: no waiting
            hand == PlaybackHand.LEFT -> measure.chordNotes   // user plays left hand
            hand == PlaybackHand.RIGHT -> measure.melodyNotes // user plays right hand
            else -> measure.melodyNotes + measure.chordNotes  // 2 mains: user plays all
        }
        val noteOnsByTime = if (_waitMode.value && userNotes.isNotEmpty()) {
            data class WaitEvent(val timeMs: Long, val pitch: Int)
            userNotes.map { n ->
                WaitEvent((n.startTime * beatMs).toLong(), n.pitch)
            }.groupBy { it.timeMs }.mapValues { (_, evs) -> evs.map { it.pitch }.toSet() }
        } else emptyMap()

        try {
            for (ev in events) {
                // Wait mode: pause until user plays expected notes at this beat
                if (_waitMode.value && ev.isOn && noteOnsByTime.containsKey(ev.timeMs)) {
                    val expected = noteOnsByTime[ev.timeMs]!!
                    while (_waitMode.value && !expected.all { it in _pressedKeys.value }) {
                        delay(30)
                    }
                }
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
        // AudioEngine is a process-wide singleton now — silence any ringing notes
        // (and clear pedal state) but keep the engine warm for the next screen.
        audioEngine.setSustainPedal(false)
        audioEngine.noteOff(-1)
    }

    // ─── Data building ────────────────────────────────────────────────────────

    private fun buildSections(song: Song, mastered: Set<String>, keySig: KeySignature? = null): List<PhraseSectionData> {
        val bpm = song.beatsPerMeasure.toDouble()
        val useFlats = keySig?.useFlats ?: false
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
                        startTimes = chords.map { it.startTime },
                        useFlats = useFlats
                    )
                } else null

                val arpeggioMotif = if (chords.isNotEmpty()) {
                    detectArpeggioMotifs(chords, useFlats)
                } else null

                MeasureData(
                    index = mi,
                    phraseIndex = phraseIndex,
                    globalIndex = globalIdx++,
                    melodyNotes = melody,
                    chordNotes = chords,
                    chordInfo = chordInfo,
                    arpeggioMotif = arpeggioMotif,
                    measureStart = start
                )
            }
            PhraseSectionData(phrase, phraseIndex, measures, phrase.id in mastered)
        }
    }

    class Factory(private val context: Context, private val songId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val engine = AudioEngine.getInstance(context.applicationContext)
            val midi = MidiManager.getInstance(context.applicationContext)
            return LearningViewModel(SongRepository(context), songId, engine, midi) as T
        }
    }
}
