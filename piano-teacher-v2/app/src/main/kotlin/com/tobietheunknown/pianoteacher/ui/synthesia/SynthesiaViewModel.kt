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
    val visibleNotes: List<NoteWithHand> = emptyList(),
    val pressedKeys: Set<Int> = emptySet(),
    val expectedKeys: Set<Int> = emptySet(),
    val currentBeat: Double = 0.0,
    val totalBeats: Double = 0.0,
    val isPlaying: Boolean = false,
    val isLooping: Boolean = false,
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
            // Load song
            val song = repo.getSong(songId) ?: return@launch
            // phraseIndex < 0 = full song view (all phrases merged)
            val phrase = if (initialPhraseIndex >= 0) song.phrases.getOrNull(initialPhraseIndex) else null
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

            // Start audio engine
            audioEngine.start()

            // Start MIDI scanning
            midiManager.startUsbScanning()
            midiManager.startBleScanning()

            // Collect MIDI events
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
        _state.update { it.copy(pressedKeys = it.pressedKeys + pitch) }
        if (_state.value.audioEnabled) {
            audioEngine.noteOn(pitch, velocity)
        }
    }

    private fun handleMidiNoteOff(pitch: Int) {
        _state.update { it.copy(pressedKeys = it.pressedKeys - pitch) }
        audioEngine.noteOff(pitch)
    }

    // ─── Playback ─────────────────────────────────────────────────────────────

    fun togglePlayPause() {
        if (_state.value.isPlaying) pause() else play()
    }

    private fun play() {
        pausedAtBeat = _state.value.currentBeat
        startTimeMs = System.currentTimeMillis()
        _state.update { it.copy(isPlaying = true) }

        // Play auto-notes via audio engine
        playbackJob = viewModelScope.launch {
            while (isActive) {
                val elapsedMs = System.currentTimeMillis() - startTimeMs
                val bpm = _state.value.song?.tempo ?: 120
                val speed = _state.value.playbackSpeed
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
                    triggerAutoNotes(currentBeat)
                }
                delay(8) // ~120fps for tight note triggering
            }
        }
    }

    private fun pause() {
        playbackJob?.cancel()
        pausedAtBeat = _state.value.currentBeat
        _state.update { it.copy(isPlaying = false) }
        // Release all auto-played notes
        _state.value.visibleNotes.filter { it.isActive }.forEach {
            audioEngine.noteOff(it.note.pitch)
        }
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

    fun toggleAudio() {
        val newEnabled = !_state.value.audioEnabled
        _state.update { it.copy(audioEnabled = newEnabled) }
        audioEngine.setEnabled(newEnabled)
    }

    fun onCanvasTap(x: Float, y: Float) { /* TODO: seek on tap */ }

    // ─── Auto-note triggering ─────────────────────────────────────────────────

    private val triggeredNotes = mutableSetOf<String>()  // note.id → already triggered

    private fun triggerAutoNotes(currentBeat: Double) {
        if (!_state.value.audioEnabled) return

        val tolerance = 0.05 // beats — tight window to trigger note
        _state.value.visibleNotes.forEach { noteWithHand ->
            val note = noteWithHand.note
            val noteKey = note.id

            // Trigger note on
            if (!triggeredNotes.contains(noteKey) &&
                note.startTime in (currentBeat - tolerance)..(currentBeat + tolerance)) {
                audioEngine.noteOn(note.pitch, 70)
                triggeredNotes.add(noteKey)

                // Schedule note off after duration
                viewModelScope.launch {
                    val durationMs = (note.duration / (_state.value.song?.tempo ?: 120) * 60_000).toLong()
                        .coerceAtLeast(50L)
                    delay(durationMs)
                    audioEngine.noteOff(note.pitch)
                }
            }

            // Clean up passed notes from triggered set
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
