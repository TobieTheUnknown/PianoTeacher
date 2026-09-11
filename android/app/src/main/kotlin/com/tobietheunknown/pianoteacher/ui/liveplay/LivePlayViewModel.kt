package com.tobietheunknown.pianoteacher.ui.liveplay

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.tobietheunknown.pianoteacher.audio.AudioEngine
import com.tobietheunknown.pianoteacher.audio.TimelineNote
import com.tobietheunknown.pianoteacher.audio.TimelineTransport
import com.tobietheunknown.pianoteacher.audio.TransportSettings
import com.tobietheunknown.pianoteacher.audio.scrubAuditionNotes
import com.tobietheunknown.pianoteacher.audio.songTimeline
import com.tobietheunknown.pianoteacher.audio.phraseTimeline
import com.tobietheunknown.pianoteacher.audio.audioPlaybackDispatcher
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.data.model.Phrase
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.repository.SongRepository
import com.tobietheunknown.pianoteacher.midi.MidiEvent
import com.tobietheunknown.pianoteacher.midi.MidiManager
import com.tobietheunknown.pianoteacher.ui.common.PlaybackHand
import com.tobietheunknown.pianoteacher.ui.theme.ThemePrefs
import com.tobietheunknown.pianoteacher.ui.onboarding.OnboardingPreferences
import com.tobietheunknown.pianoteacher.ui.settings.appPreferences
import com.tobietheunknown.pianoteacher.utils.detectKeySignature
import com.tobietheunknown.pianoteacher.utils.musicKeySignatureFromStored
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class NoteWithHand(
    val note: NoteEvent,
    val isRightHand: Boolean,
    val isActive: Boolean = false,
    val isAutoPlay: Boolean = false
)

data class LivePlayUiState(
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
    val visibleBeats: Double = 5.0,
    val useFlats: Boolean = false
)

class LivePlayViewModel(
    private val repo: SongRepository,
    private val songId: String,
    private val initialPhraseIndex: Int,
    private val midiManager: MidiManager,
    private val audioEngine: AudioEngine,
    private val initialMetronomeVolume: Int = 1,
    initialListenMode: Boolean = false,
    private val expectedKeysPreference: Flow<Boolean> = flowOf(true),
) : ViewModel() {

    val audioReady: StateFlow<Boolean> = audioEngine.ready

    private val _state = MutableStateFlow(LivePlayUiState(isListenMode = initialListenMode))
    val state: StateFlow<LivePlayUiState> = _state.asStateFlow()

    private var playbackJob: Job? = null
    private var pausedAtBeat: Double = 0.0
    @Volatile private var playbackGeneration = 0
    @Volatile private var showExpectedKeys = true

    // Cached flattened note lists for full-song mode (Phase 2 perf)
    private var cachedAllMelody: List<NoteEvent>? = null
    private var cachedAllChords: List<NoteEvent>? = null

    init {
        viewModelScope.launch {
            expectedKeysPreference.distinctUntilChanged().collect { enabled ->
                showExpectedKeys = enabled
                updateExpectedKeys(_state.value.currentBeat)
            }
        }
        viewModelScope.launch {
            state.map { listOf(it.currentBeat, it.currentPhraseIndex, it.selectedHand, it.visibleBeats, it.isListenMode) }
                .distinctUntilChanged().collect {
                    updateVisibleNotes(_state.value.currentBeat)
                    updateExpectedKeys(_state.value.currentBeat)
                }
        }
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

            // Older native imports stored a low-quality major-key guess without
            // provenance. Analyse the actual notes when possible; use the stored
            // key only for an empty song.
            val allNotesForKey = (allMelody + allChords)
            val keySignature = if (allNotesForKey.isNotEmpty()) {
                detectKeySignature(
                    pitches = allNotesForKey.map { it.pitch },
                    durations = allNotesForKey.map { it.duration }
                )
            } else musicKeySignatureFromStored(song.key)
            val useFlats = keySignature?.useFlats ?: false

            _state.update {
                it.copy(
                    song = song,
                    currentPhraseIndex = initialPhraseIndex,
                    currentPhrase = phrase,
                    songPhraseCount = song.phrases.size,
                    totalBeats = totalBeats,
                    minPitch = minPitch,
                    maxPitch = maxPitch,
                    useFlats = useFlats
                )
            }
            updateVisibleNotes(0.0)

            launch {
                midiManager.events.collect { event ->
                    when (event) {
                        is MidiEvent.NoteOn -> handleMidiNoteOn(event.pitch, event.velocity)
                        is MidiEvent.NoteOff -> handleMidiNoteOff(event.pitch)
                        is MidiEvent.SustainPedal -> audioEngine.setSustainPedal(event.engaged)
                        MidiEvent.Reset -> {
                            _state.update { it.copy(pressedKeys = emptySet(), wrongKeys = emptySet()) }
                            audioEngine.setSustainPedal(false)
                            audioEngine.noteOff(-1)
                        }
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

    private fun timelineNotes(): List<TimelineNote> {
        val state = _state.value
        val song = state.song ?: return emptyList()
        return if (state.currentPhrase == null) songTimeline(song)
            else phraseTimeline(song, state.currentPhraseIndex)
    }

    private fun shouldAutoPlay(note: TimelineNote): Boolean {
        val state = _state.value
        return state.isListenMode || when (state.selectedHand) {
            PlaybackHand.BOTH -> false
            PlaybackHand.RIGHT -> !note.rightHand
            PlaybackHand.LEFT -> note.rightHand
        }
    }

    private fun play(preroll: Boolean = true) {
        if (_state.value.isPlaying) return
        val song = _state.value.song ?: return
        if (_state.value.totalBeats <= 0) return
        if (_state.value.currentBeat >= _state.value.totalBeats) seekToBeat(0.0)
        pausedAtBeat = _state.value.currentBeat
        val generation = ++playbackGeneration
        _state.update { it.copy(isPlaying = true, isWaiting = false) }
        val notes = timelineNotes()
        playbackJob = viewModelScope.launch(audioPlaybackDispatcher) {
            try {
                val completed = TimelineTransport(audioEngine, notes, song.beatsPerMeasure).run(
                    initialBeat = pausedAtBeat,
                    settings = {
                        val state = _state.value
                        TransportSettings(
                            beatsPerSecond = song.tempo / 60.0 * state.playbackSpeed,
                            startBeat = if (state.isLooping) state.loopStartBeat else 0.0,
                            endBeat = if (state.isLooping && state.loopEndBeat > 0) state.loopEndBeat else state.totalBeats,
                            loop = state.isLooping,
                            wait = state.isWaitMode && !state.isListenMode,
                            metronomeSubdivision = state.metronomeSubdivision,
                            metronomeAmplitude = when (initialMetronomeVolume) { 0 -> 0.25f; 2 -> 0.70f; else -> 0.45f },
                        )
                    },
                    autoPlay = ::shouldAutoPlay,
                    pressedKeys = { _state.value.pressedKeys },
                    publish = { beat, waiting ->
                        if (generation == playbackGeneration) _state.update { it.copy(currentBeat = beat, isWaiting = waiting) }
                    },
                    preroll = preroll,
                )
                // Phrase-only views retain their next-phrase navigation after playback.
                if (completed && generation == playbackGeneration) withContext(Dispatchers.Main) {
                    _state.update { it.copy(isPlaying = false, isWaiting = false) }
                    val index = _state.value.currentPhraseIndex
                    if (index >= 0 && index + 1 < song.phrases.size) {
                        delay(600)
                        if (generation == playbackGeneration) goToPhrase(index + 1)
                    }
                }
            } finally {
                if (generation == playbackGeneration) _state.update { it.copy(isPlaying = false, isWaiting = false) }
            }
        }
    }

    private fun pause() {
        playbackGeneration++
        playbackJob?.cancel()
        playbackJob = null
        pausedAtBeat = _state.value.currentBeat
        _state.update { it.copy(isPlaying = false, isWaiting = false) }
    }

    fun restart() { pause(); seekToBeat(0.0) }

    fun seekToBeat(beat: Double) {
        val wasPlaying = _state.value.isPlaying
        pause()
        pausedAtBeat = beat.coerceIn(0.0, _state.value.totalBeats)
        _state.update { it.copy(currentBeat = pausedAtBeat) }
        updateVisibleNotes(pausedAtBeat)
        updateExpectedKeys(pausedAtBeat)
        if (wasPlaying) play(preroll = false)
    }

    fun setSpeed(speed: Float) {
        // The monotone clock integrates the new rate without replaying a preroll.
        _state.update { it.copy(playbackSpeed = speed.coerceIn(0.3f, 1.5f)) }
    }

    private var scrubWasPlaying = false
    private var scrubbing = false
    private var scrubNotes = emptyList<TimelineNote>()
    private val scrubbedOccurrences = mutableSetOf<Int>()
    private var lastAuditionNanos = 0L

    fun beginScrub() {
        if (scrubbing) return
        scrubbing = true
        scrubWasPlaying = _state.value.isPlaying
        pause()
        scrubNotes = timelineNotes()
        scrubbedOccurrences.clear()
        lastAuditionNanos = 0L
    }

    fun scrubToBeat(beat: Double, audition: Boolean = true) {
        if (!scrubbing) beginScrub()
        val target = beat.coerceIn(0.0, _state.value.totalBeats)
        val from = _state.value.currentBeat
        val now = System.nanoTime()
        if (audition && _state.value.audioEnabled && now - lastAuditionNanos >= 45_000_000L) {
            val chord = scrubAuditionNotes(scrubNotes, from, target, _state.value.audioEnabled, scrubbedOccurrences)
            if (chord.isNotEmpty()) {
                lastAuditionNanos = now
                scrubbedOccurrences.addAll(chord.map { it.occurrence })
                viewModelScope.launch(start = CoroutineStart.UNDISPATCHED) {
                    val session = audioEngine.beginPlayback()
                    if (session != 0L) {
                        val voices = mutableListOf<Long>()
                        try {
                            // Opening may suspend: only the latest, still active gesture auditions.
                            if (!scrubbing || lastAuditionNanos != now) return@launch
                            voices += chord.map { audioEngine.playVoice(session, it.note.pitch, 65) }
                            delay(110)
                        } finally {
                            voices.forEach(audioEngine::stopVoice)
                            audioEngine.endPlayback(session)
                        }
                    }
                }
            }
        }
        pausedAtBeat = target
        _state.update { it.copy(currentBeat = target) }
        updateVisibleNotes(target)
        updateExpectedKeys(target)
    }

    fun endScrub(resumePlayback: Boolean = true) {
        if (!scrubbing) return
        scrubbing = false
        scrubNotes = emptyList()
        if (resumePlayback && scrubWasPlaying) play(preroll = false)
        scrubWasPlaying = false
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
        _state.update {
            val start = startBeat.coerceIn(0.0, it.totalBeats)
            it.copy(loopStartBeat = start, loopEndBeat = endBeat.coerceIn(start, it.totalBeats))
        }
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
        val totalBeats = phrase.length.toDouble() * song.beatsPerMeasure
        _state.update {
            it.copy(
                currentPhraseIndex = index,
                currentPhrase = phrase,
                totalBeats = totalBeats,
                currentBeat = 0.0,
                loopStartBeat = 0.0,
                loopEndBeat = totalBeats,
            )
        }
        pausedAtBeat = 0.0
        updateVisibleNotes(0.0)
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
            melodyNotes = phrase.tracks.melody.sortedBy { it.startTime }
            chordNotes = phrase.tracks.chords.sortedBy { it.startTime }
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
        if (!showExpectedKeys || _state.value.isListenMode) {
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
        pause()
        // MidiManager is shared (singleton via getInstance) — do not stop it, other
        // screens may still want events. AudioEngine is also a singleton: silence
        // ringing notes and pedal state but leave the engine warm.
        audioEngine.setSustainPedal(false)
        audioEngine.noteOff(-1)
    }

    class Factory(
        private val context: Context,
        private val songId: String,
        private val phraseIndex: Int
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val engine = AudioEngine.getInstance(context)
            engine.setRelease(ThemePrefs.getReleaseLevel(context))
            return LivePlayViewModel(
                repo = SongRepository(context),
                songId = songId,
                initialPhraseIndex = phraseIndex,
                midiManager = MidiManager.getInstance(context),
                audioEngine = engine,
                initialMetronomeVolume = ThemePrefs.getMetronomeVolume(context),
                initialListenMode = !OnboardingPreferences.profile(context).wantsMidi,
                expectedKeysPreference = context.applicationContext.appPreferences
                    .map { it.showExpectedKeys },
            ) as T
        }
    }
}
