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
import com.tobietheunknown.pianoteacher.utils.MEASURE_EPSILON
import com.tobietheunknown.pianoteacher.utils.detectKeySignature
import com.tobietheunknown.pianoteacher.utils.musicKeySignatureFromStored
import com.tobietheunknown.pianoteacher.utils.StaffDisplayNote
import com.tobietheunknown.pianoteacher.utils.sliceNotesForStaff
import com.tobietheunknown.pianoteacher.audio.TimelineTransport
import com.tobietheunknown.pianoteacher.audio.TransportSettings
import com.tobietheunknown.pianoteacher.audio.songTimeline
import com.tobietheunknown.pianoteacher.audio.audioPlaybackDispatcher
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
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
    val melodyStaffNotes: List<StaffDisplayNote>,
    val chordStaffNotes: List<StaffDisplayNote>,
    val chordInfo: ChordInfo?,
    val arpeggioMotif: ArpeggioMotifResult? = null,
    // Activated arpeggio badge from the consecutive-measures run pass; null when
    // this measure is not part of a qualifying ≥2-measure arpeggio run.
    val arpeggioBadge: com.tobietheunknown.pianoteacher.utils.ArpeggioBadge? = null,
    // Per-hand role badges (arpège / ostinato / pédale) + combined-hands harmony
    // watermark, resolved by computeMeasureRoles (run rules + priority).
    val harmony: com.tobietheunknown.pianoteacher.utils.MeasureHarmony? = null,
    val leftRole: com.tobietheunknown.pianoteacher.utils.HandRole? = null,
    val rightRole: com.tobietheunknown.pianoteacher.utils.HandRole? = null,
    // Active ostinato per hand (for Détail-ON MotifRows grouping); null otherwise.
    val leftOstinato: com.tobietheunknown.pianoteacher.utils.OstinatoQualification? = null,
    val rightOstinato: com.tobietheunknown.pianoteacher.utils.OstinatoQualification? = null,
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
    private val midiManager: MidiManager,
    initialListenMode: Boolean = true,
) : ViewModel() {

    val audioReady: StateFlow<Boolean> = audioEngine.ready

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

    private val _listenMode = MutableStateFlow(initialListenMode)
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

            // Existing Android imports did not persist key provenance and older
            // versions stored a simplistic "most frequent note = major tonic"
            // guess. Keep the robust analysis authoritative whenever notes are
            // available; the stored spelling remains a fallback for empty songs.
            if (s != null) {
                val allNotes = s.phrases.flatMap { it.tracks.melody + it.tracks.chords }
                _keySignature.value = if (allNotes.isNotEmpty()) {
                    detectKeySignature(
                        pitches = allNotes.map { it.pitch },
                        durations = allNotes.map { it.duration }
                    )
                } else musicKeySignatureFromStored(s.key)
            }
        }
        audioEngine.start()
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
                    MidiEvent.Reset -> {
                        _pressedKeys.value = emptySet()
                        audioEngine.setSustainPedal(false)
                        audioEngine.noteOff(-1)
                    }
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

    fun setLoopRange(startIn: Int, endIn: Int) {
        // Loop UX: detect which end the user moved (compare with the
        // previous value) and pull the OTHER end along by 3 measures so
        // the range stays non-empty.
        val prevStart = _loopStart.value
        val prevEnd = _loopEnd.value
        var start = startIn
        var end = endIn
        if (start > end) {
            if (start != prevStart) {
                // User pushed start past end → drag end to start + 3
                end = start + 3
            } else {
                // User pulled end below start → drag start to end - 3
                start = (end - 3).coerceAtLeast(0)
            }
        }
        @Suppress("NAME_SHADOWING")
        val total = allMeasures.value.size
        if (total <= 0) return
        val clampedStart = start.coerceIn(0, total - 1)
        _loopStart.value = clampedStart
        _loopEnd.value = end.coerceIn(clampedStart, total - 1)
    }

    fun toggleDetails() { _showDetails.value = !_showDetails.value }
    fun toggleOctaves() { _showOctaves.value = !_showOctaves.value }
    fun focusMeasure(globalIdx: Int) {
        val lastIndex = allMeasures.value.lastIndex
        _focusedMeasureIndex.value = if (lastIndex >= 0) globalIdx.coerceIn(0, lastIndex) else 0
    }

    fun focusPreviousMeasure() {
        pause()
        focusMeasure(_focusedMeasureIndex.value - 1)
    }

    fun focusNextMeasure() {
        pause()
        focusMeasure(_focusedMeasureIndex.value + 1)
    }

    // ─── Playback ─────────────────────────────────────────────────────────────

    @Volatile private var playbackGeneration = 0

    /** The complete MIDI timeline drives playback; measures are position snapshots. */
    fun play() {
        if (_isPlaying.value) { pause(); return }
        val s = song.value ?: return
        if (s.totalMeasures == 0) return
        startTimeline(_focusedMeasureIndex.value.coerceIn(0, s.totalMeasures - 1), s.totalMeasures, allowLoop = true, preroll = true)
    }

    fun pause() { cancelPlayback() }

    fun stop() {
        cancelPlayback()
        _focusedMeasureIndex.value = 0
    }

    fun playMeasureSingle(globalIdx: Int) {
        val s = song.value ?: return
        if (globalIdx !in 0 until s.totalMeasures) return
        startTimeline(globalIdx, globalIdx + 1)
    }

    fun playMeasureHandSingle(globalIdx: Int, playRight: Boolean) {
        val s = song.value ?: return
        if (globalIdx !in 0 until s.totalMeasures) return
        startTimeline(globalIdx, globalIdx + 1, forcedRightHand = playRight)
    }

    fun playPhrase(phraseIdx: Int) {
        val s = song.value ?: return
        if (phraseIdx !in s.phrases.indices) return
        val start = s.phrases.take(phraseIdx).sumOf { it.length }
        startTimeline(start, start + s.phrases[phraseIdx].length)
    }

    private fun startTimeline(
        startMeasure: Int,
        endMeasure: Int,
        allowLoop: Boolean = false,
        preroll: Boolean = false,
        forcedRightHand: Boolean? = null,
    ) {
        val s = song.value ?: return
        cancelPlayback()
        val generation = playbackGeneration
        _isPlaying.value = true
        _focusedMeasureIndex.value = startMeasure
        playbackJob = viewModelScope.launch(audioPlaybackDispatcher) {
            try {
                TimelineTransport(audioEngine, songTimeline(s), s.beatsPerMeasure).run(
                    initialBeat = startMeasure * s.beatsPerMeasure,
                    settings = {
                        val loop = allowLoop && _isLooping.value
                        TransportSettings(
                            beatsPerSecond = s.tempo / 60.0 * _tempoPercent.value,
                            startBeat = if (loop) _loopStart.value * s.beatsPerMeasure else startMeasure * s.beatsPerMeasure,
                            endBeat = if (loop) (_loopEnd.value + 1).coerceAtMost(s.totalMeasures) * s.beatsPerMeasure else endMeasure * s.beatsPerMeasure,
                            loop = loop,
                            wait = forcedRightHand == null && _waitMode.value && !_listenMode.value,
                            metronomeSubdivision = if (_metronomeEnabled.value) 1 else 0,
                        )
                    },
                    autoPlay = { note ->
                        when {
                            forcedRightHand != null -> note.rightHand == forcedRightHand
                            _listenMode.value && _playbackHand.value == PlaybackHand.BOTH -> true
                            _playbackHand.value == PlaybackHand.LEFT -> note.rightHand
                            _playbackHand.value == PlaybackHand.RIGHT -> !note.rightHand
                            else -> false
                        }
                    },
                    pressedKeys = { _pressedKeys.value },
                    publish = { beat, _ ->
                        if (generation == playbackGeneration) {
                            val index = kotlin.math.floor(beat / s.beatsPerMeasure).toInt().coerceIn(0, s.totalMeasures - 1)
                            _playingMeasureIndex.value = index
                            _focusedMeasureIndex.value = index
                        }
                    },
                    preroll = preroll,
                )
            } finally {
                if (generation == playbackGeneration) {
                    _isPlaying.value = false
                    _playingMeasureIndex.value = -1
                }
            }
        }
    }

    private fun cancelPlayback() {
        playbackGeneration++
        playbackJob?.cancel()
        playbackJob = null
        _isPlaying.value = false
        _playingMeasureIndex.value = -1
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
        val sections = song.phrases.mapIndexed { phraseIndex, phrase ->
            val measures = (0 until phrase.length).map { mi ->
                val start = mi * bpm
                val end = (mi + 1) * bpm

                val isLastMeasure = mi == phrase.length - 1
                // EPSILON matches web/src/utils/measureUtils.js: a downbeat stored
                // with FP noise (e.g. 27.9999... for beat 28) snaps forward to
                // the next measure instead of rendering at the end of the current.
                val inMeasure: (Double) -> Boolean = { t ->
                    t >= start - MEASURE_EPSILON &&
                        (if (isLastMeasure) t <= end + MEASURE_EPSILON else t < end - MEASURE_EPSILON)
                }
                val melody = phrase.tracks.melody
                    .filter { inMeasure(it.startTime) }
                    .map { it.copy(startTime = it.startTime - start) }

                val chords = phrase.tracks.chords
                    .filter { inMeasure(it.startTime) }
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
                    melodyStaffNotes = sliceNotesForStaff(phrase.tracks.melody, start, end),
                    chordStaffNotes = sliceNotesForStaff(phrase.tracks.chords, start, end),
                    chordInfo = chordInfo,
                    arpeggioMotif = arpeggioMotif,
                    measureStart = start
                )
            }
            PhraseSectionData(phrase, phraseIndex, measures, phrase.id in mastered)
        }

        // ── Per-hand roles + harmony (consecutive-measures run rules) ───────
        // Run the pass over the flattened measure list, while passing phrase
        // identity explicitly so a role cannot be fabricated across a phrase
        // boundary. Results are then re-attached by global index.
        val flat = sections.flatMap { it.measures }
        val roles = com.tobietheunknown.pianoteacher.utils.computeMeasureRoles(
            leftHandNotes = flat.map { it.chordNotes },
            rightHandNotes = flat.map { it.melodyNotes },
            unitsPerMeasure = song.beatsPerMeasure,
            keySignature = keySig,
            phraseIndexes = flat.map { it.phraseIndex },
        )
        // Left-hand arpeggio badge survives separately so the arpège role badge
        // can render its glyph/×N regardless of role priority.
        val badges = com.tobietheunknown.pianoteacher.utils.computeArpeggioBadges(
            flat.map { it.chordNotes },
            keySig,
            flat.map { it.phraseIndex },
        )
        val byGlobal = flat.indices.associate { flat[it].globalIndex to (roles[it] to badges[it]) }
        return sections.map { sec ->
            sec.copy(measures = sec.measures.map { m ->
                val (r, badge) = byGlobal[m.globalIndex] ?: return@map m
                m.copy(
                    arpeggioBadge = badge,
                    harmony = r.harmony,
                    leftRole = r.leftRole,
                    rightRole = r.rightRole,
                    leftOstinato = r.leftOstinato,
                    rightOstinato = r.rightOstinato,
                )
            })
        }
    }

    class Factory(private val context: Context, private val songId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            val engine = AudioEngine.getInstance(context.applicationContext)
            val midi = MidiManager.getInstance(context.applicationContext)
            return LearningViewModel(
                SongRepository(context), songId, engine, midi,
                initialListenMode = true, // Partition already defaults to both-hand listening, with or without MIDI.
            ) as T
        }
    }
}
