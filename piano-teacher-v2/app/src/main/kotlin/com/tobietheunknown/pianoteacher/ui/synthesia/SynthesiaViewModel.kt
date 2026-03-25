package com.tobietheunknown.pianoteacher.ui.synthesia

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.audio.AudioEngine
import com.tobietheunknown.pianoteacher.audio.MetronomeEngine
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import com.tobietheunknown.pianoteacher.midi.MidiEvent
import com.tobietheunknown.pianoteacher.midi.MidiManager
import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand
import com.tobietheunknown.pianoteacher.ui.theme.ThemePrefs
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class NoteWithHand(
    val note: NoteEvent,
    val isRightHand: Boolean,
    val isActive: Boolean = false,
    val isAutoPlay: Boolean = false
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
    val audioEnabled: Boolean = true,
    val selectedHand: PlaybackHand = PlaybackHand.BOTH,
    val metronomeSubdivision: Int = 0,  // 0=off, 1=quarter notes, 2=eighth notes
    val minPitch: Int = 21,
    val maxPitch: Int = 108,
    val isListenMode: Boolean = false,
    val loopStartBeat: Double = 0.0,
    val loopEndBeat: Double = 0.0,
    val visibleBeats: Double = 5.0
)

class SynthesiaViewModel(
    private val repo: SongRepository,
    private val songId: String,
    private val initialPhraseIndex: Int,
    private val midiManager: MidiManager,
    private val audioEngine: AudioEngine,
    private val initialMetronomeVolume: Int = 1
) : ViewModel() {

    private val _state = MutableStateFlow(SynthesiaUiState())
    val state: StateFlow<SynthesiaUiState> = _state.asStateFlow()

    private val metronome = MetronomeEngine().apply { setVolume(initialMetronomeVolume) }
    private var playbackJob: Job? = null
    private var pausedAtBeat: Double = 0.0
    private var startTimeMs: Long = 0L
    private var lastMetronomeBeat = -1

    // Cached flattened note lists for full-song mode (Phase 2 perf)
    private var cachedAllMelody: List<NoteEvent>? = null
    private var cachedAllChords: List<NoteEvent>? = null

    init {
        viewModelScope.launch {
            val song = repo.getSong(songId) ?: return@launch
            // initialPhraseIndex < 0 = full song view
            val phrase = if (initialPhraseIndex >= 0) song.phrases.getOrNull(initialPhraseIndex) else null
            val totalBeats = phrase?.let { it.length.toDouble() * song.beatsPerMeasure }
                ?: (song.totalMeasures.toDouble() * song.beatsPerMeasure)

            // Cache flattened note lists for full-song mode
            if (initialPhraseIndex < 0) {
                var offset = 0.0
                val allMelody = mutableListOf<NoteEvent>()
                val allChords = mutableListOf<NoteEvent>()
                song.phrases.forEach { p ->
                    p.tracks.melody.forEach { n -> allMelody.add(n.copy(startTime = n.startTime + offset)) }
                    p.tracks.chords.forEach { n -> allChords.add(n.copy(startTime = n.startTime + offset)) }
                    offset += p.length.toDouble() * song.beatsPerMeasure
                }
                cachedAllMelody = allMelody.sortedBy { it.startTime }
                cachedAllChords = allChords.sortedBy { it.startTime }
            }

            // Compute dynamic keyboard range from all pitches in the song
            val allMelody = if (phrase != null) phrase.tracks.melody else song.phrases.flatMap { it.tracks.melody }
            val allChords = if (phrase != null) phrase.tracks.chords else song.phrases.flatMap { it.tracks.chords }
            val allPitches = (allMelody + allChords).map { it.pitch }
            val minPitch = ((allPitches.minOrNull() ?: 21) - 2).coerceIn(21, 108)
            val maxPitch = ((allPitches.maxOrNull() ?: 108) + 2).coerceIn(21, 108)

            _state.update {
                it.copy(
                    song = song,
                    currentPhraseIndex = initialPhraseIndex,
                    currentPhrase = phrase,
                    songPhraseCount = song.phrases.size,
                    totalBeats = totalBeats,
                    minPitch = minPitch,
                    maxPitch = maxPitch
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
        lastMetronomeBeat = -1

        playbackJob = viewModelScope.launch {
            // Metronome preroll: play 1 measure of clicks before starting
            if (_state.value.metronomeSubdivision > 0) {
                val bpm = _state.value.song?.tempo ?: 120
                val speed = _state.value.playbackSpeed
                val beatMs = (60_000.0 / bpm / speed).toLong()
                val beatsPerMeasure = _state.value.song?.beatsPerMeasure ?: 4
                for (i in 0 until beatsPerMeasure) {
                    metronome.playClick(i == 0)
                    delay(beatMs)
                }
            }

            startTimeMs = System.currentTimeMillis()
            _state.update { it.copy(isPlaying = true, isWaiting = false) }

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

                val loopEnd = if (_state.value.isLooping && _state.value.loopEndBeat > 0) _state.value.loopEndBeat else totalBeats
                if (currentBeat >= loopEnd) {
                    if (_state.value.isLooping) {
                        pausedAtBeat = _state.value.loopStartBeat
                        startTimeMs = System.currentTimeMillis()
                        triggeredNotes.clear()
                        pendingNoteOffs.clear()
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

                    // Metronome
                    val subdivision = _state.value.metronomeSubdivision
                    if (subdivision > 0) {
                        val multiplier = if (subdivision == 2) 2 else 1
                        val tickIndex = kotlin.math.floor(currentBeat * multiplier).toInt()
                        if (tickIndex != lastMetronomeBeat && tickIndex >= 0) {
                            lastMetronomeBeat = tickIndex
                            val beatsPerMeasure = _state.value.song?.beatsPerMeasure ?: 4
                            val isAccent = tickIndex % (beatsPerMeasure * multiplier) == 0
                            metronome.playClick(isAccent)
                        }
                    }
                }
                // Yield then short delay for smooth ~60fps without busy-waiting
                // Wall-clock timing handles accurate beat positioning
                yield()
                delay(8)
            }
        }
    }

    private fun pause() {
        playbackJob?.cancel()
        pausedAtBeat = _state.value.currentBeat
        lastMetronomeBeat = -1
        _state.update { it.copy(isPlaying = false, isWaiting = false) }
        _state.value.visibleNotes.filter { it.isActive }.forEach {
            audioEngine.noteOff(it.note.pitch)
        }
    }

    fun restart() {
        pause()
        triggeredNotes.clear()
        pendingNoteOffs.clear()
        lastMetronomeBeat = -1
        _state.update { it.copy(currentBeat = 0.0) }
        pausedAtBeat = 0.0
        updateVisibleNotes(0.0)
    }

    fun seekToBeat(beat: Double) {
        val wasPlaying = _state.value.isPlaying
        pause()
        triggeredNotes.clear()
        pendingNoteOffs.clear()
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
        val enabling = !_state.value.isLooping
        _state.update {
            if (enabling) {
                it.copy(isLooping = true, loopStartBeat = 0.0, loopEndBeat = it.totalBeats)
            } else {
                it.copy(isLooping = false)
            }
        }
    }

    fun setLoopRange(startBeat: Double, endBeat: Double) {
        _state.update { it.copy(
            loopStartBeat = startBeat.coerceIn(0.0, it.totalBeats),
            loopEndBeat = endBeat.coerceIn(startBeat, it.totalBeats)
        )}
    }

    fun toggleWaitMode() {
        _state.update { it.copy(isWaitMode = !it.isWaitMode, isWaiting = false) }
    }

    fun toggleAudio() {
        val newEnabled = !_state.value.audioEnabled
        _state.update { it.copy(audioEnabled = newEnabled) }
        audioEngine.setEnabled(newEnabled)
    }

    fun toggleMetronome() {
        _state.update { it.copy(metronomeSubdivision = (it.metronomeSubdivision + 1) % 3) }
    }

    fun toggleListenMode() {
        _state.update { it.copy(isListenMode = !it.isListenMode) }
    }

    fun setVisibleBeats(beats: Double) {
        _state.update { it.copy(visibleBeats = beats.coerceIn(3.0, 12.0)) }
    }

    fun setHand(hand: PlaybackHand) {
        _state.update { it.copy(selectedHand = hand) }
        // Refresh visible notes to recalculate isAutoPlay
        updateVisibleNotes(_state.value.currentBeat)
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
        pendingNoteOffs.clear()
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

    /** Pending note-offs: (pitch, endBeat) — processed in the main playback loop */
    private data class PendingNoteOff(val pitch: Int, val endBeat: Double)
    private val pendingNoteOffs = mutableListOf<PendingNoteOff>()

    private fun triggerAutoNotes(currentBeat: Double) {
        if (!_state.value.audioEnabled) return

        val tolerance = 0.02

        // Process pending note-offs in the main loop instead of per-note coroutines
        val iterator = pendingNoteOffs.iterator()
        while (iterator.hasNext()) {
            val pending = iterator.next()
            if (currentBeat >= pending.endBeat) {
                audioEngine.noteOff(pending.pitch)
                iterator.remove()
            }
        }

        val state = _state.value
        val notes = state.visibleNotes
        for (i in notes.indices) {
            val noteWithHand = notes[i]
            val note = noteWithHand.note
            val noteKey = note.id

            // Skip notes at or past loop end when looping
            if (state.isLooping && state.loopEndBeat > 0 && note.startTime >= state.loopEndBeat) continue

            // Listen mode: auto-play ALL notes
            // Normal mode: only auto-trigger backing track notes (isAutoPlay)
            val shouldTrigger = state.isListenMode || noteWithHand.isAutoPlay

            if (shouldTrigger && !triggeredNotes.contains(noteKey) &&
                note.startTime in (currentBeat - tolerance)..(currentBeat + tolerance)) {
                // Listen mode notes play at 80, backing track at 60
                val velocity = if (state.isListenMode && !noteWithHand.isAutoPlay) 80 else if (noteWithHand.isAutoPlay) 60 else 80
                audioEngine.noteOn(note.pitch, velocity)
                triggeredNotes.add(noteKey)
                pendingNoteOffs.add(PendingNoteOff(note.pitch, note.startTime + note.duration))
            }

            if (note.startTime + note.duration < currentBeat - 1.0) {
                triggeredNotes.remove(noteKey)
            }
        }
    }

    // ─── State updates ────────────────────────────────────────────────────────

    // Pre-allocated list reused across frames to reduce GC pressure
    private val visibleBuffer = mutableListOf<NoteWithHand>()

    private fun updateVisibleNotes(currentBeat: Double) {
        val song = _state.value.song ?: return
        val phrase = _state.value.currentPhrase
        val selectedHand = _state.value.selectedHand

        val melodyNotes: List<NoteEvent>
        val chordNotes: List<NoteEvent>

        if (phrase != null) {
            melodyNotes = phrase.tracks.melody
            chordNotes = phrase.tracks.chords
        } else {
            // Use cached lists for full-song mode
            melodyNotes = cachedAllMelody ?: return
            chordNotes = cachedAllChords ?: return
        }

        val lookAhead = _state.value.visibleBeats + 1.0
        val windowStart = currentBeat - 0.5
        val windowEnd = currentBeat + lookAhead
        visibleBuffer.clear()

        // Helper to find visible notes using binary search on sorted lists
        fun addVisibleNotes(notes: List<NoteEvent>, isRightHand: Boolean) {
            // For cached (sorted) lists, use binary search; for phrase lists, scan linearly
            val isSorted = (phrase == null)
            val startIdx = if (isSorted) {
                // Find first note that could be visible: startTime + duration > windowStart
                // We search for startTime near windowStart, then scan back for long notes
                var lo = 0; var hi = notes.size
                while (lo < hi) {
                    val mid = (lo + hi) / 2
                    if (notes[mid].startTime < windowStart - 20.0) lo = mid + 1 else hi = mid
                }
                lo
            } else 0

            for (i in startIdx until notes.size) {
                val n = notes[i]
                if (n.startTime >= windowEnd) break
                if (n.startTime + n.duration > windowStart) {
                    val isActive = n.startTime <= currentBeat && n.startTime + n.duration > currentBeat
                    val isAutoPlay = when (selectedHand) {
                        PlaybackHand.BOTH -> false
                        PlaybackHand.RIGHT -> !isRightHand  // left hand notes are auto-play
                        PlaybackHand.LEFT -> isRightHand     // right hand notes are auto-play
                    }
                    visibleBuffer.add(NoteWithHand(n, isRightHand, isActive, isAutoPlay))
                }
            }
        }

        addVisibleNotes(melodyNotes, true)
        addVisibleNotes(chordNotes, false)

        // Create a snapshot list for the state (state must be immutable)
        val visible = ArrayList(visibleBuffer)
        _state.update { it.copy(visibleNotes = visible) }
    }

    private fun updateExpectedKeys(currentBeat: Double) {
        if (_state.value.isListenMode) {
            if (_state.value.expectedKeys.isNotEmpty()) {
                _state.update { it.copy(expectedKeys = emptySet()) }
            }
            return
        }
        val tolerance = 0.15
        val notes = _state.value.visibleNotes
        val expected = mutableSetOf<Int>()
        for (i in notes.indices) {
            val n = notes[i]
            if (!n.isAutoPlay && n.note.startTime in (currentBeat - tolerance)..(currentBeat + tolerance)) {
                expected.add(n.note.pitch)
            }
        }
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
            audioEngine = AudioEngine(context),
            initialMetronomeVolume = ThemePrefs.getMetronomeVolume(context)
        ) as T
    }
}
