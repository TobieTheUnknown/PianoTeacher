package com.tobietheunknown.pianoteacher.ui.synthesia

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.audio.AudioEngine
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import com.tobietheunknown.pianoteacher.midi.MidiEvent
import com.tobietheunknown.pianoteacher.midi.MidiManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class NoteWithHand(
    val note: NoteEvent,
    val isRightHand: Boolean,
    val isActive: Boolean = false
)

data class SynthesiaUiState(
    val song: Song? = null,
    val currentPhraseIndex: Int = 0,
    val currentPhrase: Phrase? = null,
    val songPhraseCount: Int = 0,
    val visibleNotes: List<NoteWithHand> = emptyList(),
    val pressedKeys: Set<Int> = emptySet(),
    val expectedKeys: Set<Int> = emptySet(),
    val wrongKeys: Set<Int> = emptySet(),   // pressed but not expected
    val currentBeat: Double = 0.0,
    val totalBeats: Double = 0.0,
    val isPlaying: Boolean = false,
    val isLooping: Boolean = false,
    val isWaitMode: Boolean = false,        // pause until correct keys pressed
    val isWaiting: Boolean = false,         // currently waiting for key input
    val playbackSpeed: Float = 1.0f,
    val audioEnabled: Boolean = true
)

class SynthesiaViewModel(
    private val repo: SongRepository,
    private val songId: String,
    private val initialPhraseIndex: Int,
    private val midiManager: MidiManager,
    private val audioEngine: AudioEngine
) : ViewModel() {

    private val _state = MutableStateFlow(SynthesiaUiState())
    val state: StateFlow<SynthesiaUiState> = _state.asStateFlow()

    private var playbackJob: Job? = null
    private var pausedAtBeat: Double = 0.0
    private var startTimeMs: Long = 0L

    init {
        viewModelScope.launch {
            val song = repo.getSong(songId) ?: return@launch
            // initialPhraseIndex < 0 = full song view
            val phrase = if (initialPhraseIndex >= 0) song.phrases.getOrNull(initialPhraseIndex) else null
            val totalBeats = phrase?.let { it.length.toDouble() * song.beatsPerMeasure }
                ?: (song.totalMeasures.toDouble() * song.beatsPerMeasure)

            _state.update {
                it.copy(
                    song = song,
                    currentPhraseIndex = initialPhraseIndex,
                    currentPhrase = phrase,
                    songPhraseCount = song.phrases.size,
                    totalBeats = totalBeats
                )
            }
            updateVisibleNotes(0.0)

            audioEngine.start()
            midiManager.startUsbScanning()
            midiManager.startBleScanning()

            launch {
                midiManager.events.collect { event ->
                    when (event) {
                        is MidiEvent.NoteOn -> handleMidiNoteOn(event.pitch, event.velocity)
                        is MidiEvent.NoteOff -> handleMidiNoteOff(event.pitch)
                    }
                }
            }
        }
    }

    // ─── MIDI handlers ────────────────────────────────────────────────────────

    private fun handleMidiNoteOn(pitch: Int, velocity: Int) {
        val expected = _state.value.expectedKeys
        val isWrong = expected.isNotEmpty() && pitch !in expected
        _state.update {
            it.copy(
                pressedKeys = it.pressedKeys + pitch,
                wrongKeys = if (isWrong) it.wrongKeys + pitch else it.wrongKeys - pitch
            )
        }
        if (_state.value.audioEnabled) audioEngine.noteOn(pitch, velocity)

        // Clear wrong key indicator after 400ms
        if (isWrong) {
            viewModelScope.launch {
                delay(400)
                _state.update { it.copy(wrongKeys = it.wrongKeys - pitch) }
            }
        }
    }

    private fun handleMidiNoteOff(pitch: Int) {
        _state.update {
            it.copy(
                pressedKeys = it.pressedKeys - pitch,
                wrongKeys = it.wrongKeys - pitch
            )
        }
        audioEngine.noteOff(pitch)
    }

    // ─── Playback ─────────────────────────────────────────────────────────────

    fun togglePlayPause() {
        if (_state.value.isPlaying) pause() else play()
    }

    private fun play() {
        pausedAtBeat = _state.value.currentBeat
        startTimeMs = System.currentTimeMillis()
        _state.update { it.copy(isPlaying = true, isWaiting = false) }

        playbackJob = viewModelScope.launch {
            while (isActive) {
                val bpm = _state.value.song?.tempo ?: 120
                val speed = _state.value.playbackSpeed
                val beatsPerMs = bpm / 60_000.0 * speed

                // Wait mode: pause when expected keys aren't all pressed
                val inWaitMode = _state.value.isWaitMode
                val expected = _state.value.expectedKeys
                val pressed = _state.value.pressedKeys
                val shouldWait = inWaitMode && expected.isNotEmpty() && !pressed.containsAll(expected)

                if (shouldWait) {
                    if (!_state.value.isWaiting) _state.update { it.copy(isWaiting = true) }
                    // Reset clock so beat resumes smoothly when keys are pressed
                    startTimeMs = System.currentTimeMillis()
                    pausedAtBeat = _state.value.currentBeat
                    delay(8)
                    continue
                }

                if (_state.value.isWaiting) _state.update { it.copy(isWaiting = false) }

                val elapsedMs = System.currentTimeMillis() - startTimeMs
                val currentBeat = pausedAtBeat + elapsedMs * beatsPerMs
                val totalBeats = _state.value.totalBeats

                if (currentBeat >= totalBeats) {
                    if (_state.value.isLooping) {
                        pausedAtBeat = 0.0
                        startTimeMs = System.currentTimeMillis()
                        triggeredNotes.clear()
                    } else {
                        _state.update { it.copy(currentBeat = totalBeats, isPlaying = false, isWaiting = false) }
                        // Auto-advance to next phrase if in phrase-per-phrase mode
                        val song = _state.value.song
                        val nextIdx = _state.value.currentPhraseIndex + 1
                        if (song != null && _state.value.currentPhraseIndex >= 0 && nextIdx < song.phrases.size) {
                            viewModelScope.launch {
                                delay(600) // small gap between phrases
                                goToPhrase(nextIdx)
                            }
                        }
                        break
                    }
                } else {
                    _state.update { it.copy(currentBeat = currentBeat) }
                    updateVisibleNotes(currentBeat)
                    updateExpectedKeys(currentBeat)
                    triggerAutoNotes(currentBeat)
                }
                delay(8) // ~120fps
            }
        }
    }

    private fun pause() {
        playbackJob?.cancel()
        pausedAtBeat = _state.value.currentBeat
        _state.update { it.copy(isPlaying = false, isWaiting = false) }
        _state.value.visibleNotes.filter { it.isActive }.forEach {
            audioEngine.noteOff(it.note.pitch)
        }
    }

    fun restart() {
        pause()
        triggeredNotes.clear()
        _state.update { it.copy(currentBeat = 0.0) }
        pausedAtBeat = 0.0
        updateVisibleNotes(0.0)
    }

    fun seekToBeat(beat: Double) {
        val wasPlaying = _state.value.isPlaying
        pause()
        triggeredNotes.clear()
        pausedAtBeat = beat
        _state.update { it.copy(currentBeat = beat) }
        updateVisibleNotes(beat)
        if (wasPlaying) play()
    }

    fun setSpeed(speed: Float) {
        val wasPlaying = _state.value.isPlaying
        if (wasPlaying) pause()
        _state.update { it.copy(playbackSpeed = speed) }
        if (wasPlaying) play()
    }

    fun toggleLoop() {
        _state.update { it.copy(isLooping = !it.isLooping) }
    }

    fun toggleWaitMode() {
        _state.update { it.copy(isWaitMode = !it.isWaitMode, isWaiting = false) }
    }

    fun toggleAudio() {
        val newEnabled = !_state.value.audioEnabled
        _state.update { it.copy(audioEnabled = newEnabled) }
        audioEngine.setEnabled(newEnabled)
    }

    // ─── Phrase navigation ────────────────────────────────────────────────────

    fun nextPhrase() {
        val song = _state.value.song ?: return
        val next = if (_state.value.currentPhraseIndex < 0) 0
                   else (_state.value.currentPhraseIndex + 1).coerceAtMost(song.phrases.size - 1)
        if (next != _state.value.currentPhraseIndex) goToPhrase(next)
    }

    fun prevPhrase() {
        val prev = if (_state.value.currentPhraseIndex < 0) 0
                   else (_state.value.currentPhraseIndex - 1).coerceAtLeast(0)
        if (prev != _state.value.currentPhraseIndex) goToPhrase(prev)
    }

    private fun goToPhrase(index: Int) {
        val song = _state.value.song ?: return
        val phrase = song.phrases.getOrNull(index) ?: return
        pause()
        triggeredNotes.clear()
        val totalBeats = phrase.length.toDouble() * song.beatsPerMeasure
        _state.update {
            it.copy(
                currentPhraseIndex = index,
                currentPhrase = phrase,
                totalBeats = totalBeats,
                currentBeat = 0.0
            )
        }
        pausedAtBeat = 0.0
        updateVisibleNotes(0.0)
    }

    // ─── Auto-note triggering ─────────────────────────────────────────────────

    private val triggeredNotes = mutableSetOf<String>()

    private fun triggerAutoNotes(currentBeat: Double) {
        if (!_state.value.audioEnabled) return

        val tolerance = 0.05
        _state.value.visibleNotes.forEach { noteWithHand ->
            val note = noteWithHand.note
            val noteKey = note.id

            if (!triggeredNotes.contains(noteKey) &&
                note.startTime in (currentBeat - tolerance)..(currentBeat + tolerance)) {
                audioEngine.noteOn(note.pitch, 70)
                triggeredNotes.add(noteKey)

                viewModelScope.launch {
                    val bpm = _state.value.song?.tempo ?: 120
                    val speed = _state.value.playbackSpeed
                    val durationMs = (note.duration * 60_000.0 / bpm / speed).toLong().coerceAtLeast(50L)
                    delay(durationMs)
                    audioEngine.noteOff(note.pitch)
                }
            }

            if (note.startTime + note.duration < currentBeat - 1.0) {
                triggeredNotes.remove(noteKey)
            }
        }
    }

    // ─── State updates ────────────────────────────────────────────────────────

    private fun updateVisibleNotes(currentBeat: Double) {
        val song = _state.value.song ?: return
        val phrase = _state.value.currentPhrase

        val melodyNotes: List<NoteEvent>
        val chordNotes: List<NoteEvent>

        if (phrase != null) {
            melodyNotes = phrase.tracks.melody
            chordNotes = phrase.tracks.chords
        } else {
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

        melodyNotes
            .filter { it.startTime + it.duration > currentBeat - 0.5 && it.startTime < currentBeat + lookAhead }
            .forEach { visible.add(NoteWithHand(it, true, it.startTime <= currentBeat && it.startTime + it.duration > currentBeat)) }

        chordNotes
            .filter { it.startTime + it.duration > currentBeat - 0.5 && it.startTime < currentBeat + lookAhead }
            .forEach { visible.add(NoteWithHand(it, false, it.startTime <= currentBeat && it.startTime + it.duration > currentBeat)) }

        _state.update { it.copy(visibleNotes = visible) }
    }

    private fun updateExpectedKeys(currentBeat: Double) {
        val tolerance = 0.15
        val expected = _state.value.visibleNotes
            .filter { it.note.startTime in (currentBeat - tolerance)..(currentBeat + tolerance) }
            .map { it.note.pitch }
            .toSet()
        _state.update { it.copy(expectedKeys = expected) }
    }

    override fun onCleared() {
        super.onCleared()
        midiManager.stop()
        audioEngine.release()
    }

    class Factory(
        private val context: Context,
        private val songId: String,
        private val phraseIndex: Int
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = SynthesiaViewModel(
            repo = SongRepository(context),
            songId = songId,
            initialPhraseIndex = phraseIndex,
            midiManager = MidiManager(context),
            audioEngine = AudioEngine(context)
        ) as T
    }
}
