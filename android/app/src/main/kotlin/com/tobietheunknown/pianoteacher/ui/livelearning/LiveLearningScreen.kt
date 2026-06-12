package com.tobietheunknown.pianoteacher.ui.livelearning

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.data.model.NoteEvent
import com.tobietheunknown.pianoteacher.utils.KeySignature as MusicKeySignature
import com.tobietheunknown.pianoteacher.utils.chordDegree
import com.tobietheunknown.pianoteacher.ui.common.MiniKeyboard
import com.tobietheunknown.pianoteacher.ui.common.PlaybackDock
import com.tobietheunknown.pianoteacher.ui.common.HandMode
import com.tobietheunknown.pianoteacher.ui.common.PhraseRange
import com.tobietheunknown.pianoteacher.ui.common.fixedKeyboardRange
import com.tobietheunknown.pianoteacher.ui.learning.LearningViewModel
import com.tobietheunknown.pianoteacher.ui.learning.MeasureData
import com.tobietheunknown.pianoteacher.ui.theme.*

// File-level color palette: hoisted out of Canvas DrawScope to avoid per-frame
// allocations. Without this, each Color() literal inside the per-note forEach
// allocates ~60×/sec per dot × ~30 dots × 4 cards ≈ 7k Color objects/sec.
private val IndigoAccentRaw = Color(0xFF6366F1)
private val LL_LABEL_GRAY = TextTertiary
private val LL_MUTED_LABEL = TextSecondary
private val LL_BEAT_DIV_DIM = Color(0x33FFFFFF)
private val LL_BEAT_DIV_BRIGHT = Color(0x40FFFFFF)
// Hand colors routed through design tokens (default classic preset).
private val LL_MELODY_BRIGHT = Tokens.HandRight
private val LL_MELODY_GLOW = Tokens.HandRight.copy(alpha = 0.25f)
private val LL_CHORD_BRIGHT = Tokens.HandLeft
private val LL_CHORD_GLOW = Tokens.HandLeft.copy(alpha = 0.25f)
private val LL_PLAYHEAD_CORE = IndigoAccentRaw
private val LL_PLAYHEAD_GLOW = IndigoAccentRaw.copy(alpha = 0.20f)
private val LL_BG_DARK = Color(0xFF0F1218)
private val LL_DIVIDER_GRAY = TextMuted
private val LL_ICON_GRAY = TextSecondary
private val LL_KEY_WHITE = KeyWhite
private val LL_KEY_WHITE_SHADOW = KeyWhiteShadow
private val LL_KEY_BLACK = KeyBlack

private val NOTE_NAMES = arrayOf("Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si")
private fun noteName(pitch: Int): String = NOTE_NAMES[((pitch % 12) + 12) % 12]

/**
 * Apprentissage mobile — measure-by-measure cards with real data.
 *
 * MESURES EN COURS · 01-04 group header, 2x2 compact MeasureCards
 * showing real melody/chord notes from the song, sticky PlaybackDock.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveLearningScreen(
    songId: String,
    onBack: () -> Unit,
    vm: LearningViewModel = viewModel(
        factory = LearningViewModel.Factory(LocalContext.current, songId)
    ),
) {
    val song by vm.song.collectAsState()
    val allMeasures by vm.allMeasures.collectAsState()
    val playingMeasure by vm.playingMeasureIndex.collectAsState()
    val focusedMeasure by vm.focusedMeasureIndex.collectAsState()
    val isPlaying by vm.isPlaying.collectAsState()
    val tempoPercent by vm.tempoPercent.collectAsState()
    val handVm by vm.playbackHand.collectAsState()
    val isMetronomeEnabled by vm.metronomeEnabled.collectAsState()
    val isLooping by vm.isLooping.collectAsState()
    val loopStart by vm.loopStart.collectAsState()
    val loopEnd by vm.loopEnd.collectAsState()
    val showDetails by vm.showDetails.collectAsState()
    val keySignature by vm.keySignature.collectAsState()

    var loopEditorOpen by remember { mutableStateOf(false) }

    val totalMeasures = allMeasures.size
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()

    // Single measure duration computation, shared across all cells in the
    // LazyColumn so we don't recompute (and re-allocate) per cell every recomp.
    val measureDurationMs = remember(song?.tempo, song?.beatsPerMeasure, tempoPercent) {
        val bpm = song?.tempo ?: 120
        val bpmPerMeasure = song?.beatsPerMeasure ?: 4
        (60_000L * bpmPerMeasure) / (bpm * tempoPercent).toLong().coerceAtLeast(1L)
    }

    // Auto-scroll to the group containing the playing measure.
    LaunchedEffect(playingMeasure) {
        if (playingMeasure >= 0) {
            val groupIdx = playingMeasure / 4
            val firstVisible = listState.firstVisibleItemIndex
            if (groupIdx < firstVisible) {
                listState.scrollToItem(groupIdx)
            } else {
                listState.animateScrollToItem(groupIdx)
            }
        }
    }

    val focusedMeasureData = allMeasures.getOrNull(focusedMeasure)

    Scaffold(containerColor = Background) { padding ->
        Box(modifier = Modifier
            .fillMaxSize()
            .padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 130.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = TextPrimary)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            song?.title ?: "Sans titre",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp,
                            letterSpacing = (-0.02).sp,
                        )
                        val tsText = song?.timeSignature?.let { "${it.numerator}/${it.denominator}" }
                        val parts = listOfNotNull(
                            song?.let { "${it.tempo} BPM" },
                            tsText,
                            "$totalMeasures mesures",
                        )
                        Text(
                            parts.joinToString(" · "),
                            color = LL_LABEL_GRAY,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                    DetailToggle(active = showDetails, onClick = vm::toggleDetails)
                    Spacer(Modifier.width(8.dp))
                }

                Spacer(Modifier.height(8.dp))

                if (allMeasures.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            "Aucune mesure",
                            color = LL_LABEL_GRAY,
                            fontSize = 14.sp,
                        )
                    }
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(18.dp),
                    ) {
                        val groups = allMeasures.chunked(4)
                        items(groups.size) { gi ->
                            val group = groups[gi]
                            val startIdx = gi * 4 + 1
                            val endIdx = (gi * 4 + group.size).coerceAtMost(totalMeasures)
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        "MESURES EN COURS",
                                        color = LL_LABEL_GRAY,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.08.sp,
                                    )
                                    Text(
                                        "${String.format("%02d", startIdx)}–${String.format("%02d", endIdx)}",
                                        color = LL_LABEL_GRAY,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                                for (row in 0 until 2) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        for (col in 0..1) {
                                            val cellIdx = row * 2 + col
                                            if (cellIdx < group.size) {
                                                val measure = group[cellIdx]
                                                val globalIdx = measure.globalIndex
                                                // Stabilise the click lambda so MeasureCardCompact
                                                // stays skippable across unrelated recompositions
                                                // (e.g. tempo / hand changes).
                                                val onCellClick = remember(globalIdx) {
                                                    { vm.playMeasureSingle(globalIdx) }
                                                }
                                                MeasureCardCompact(
                                                    measure = measure,
                                                    beatsPerMeasure = song?.beatsPerMeasure ?: 4,
                                                    isCurrent = globalIdx == focusedMeasure || globalIdx == playingMeasure,
                                                    isPlaying = isPlaying && globalIdx == playingMeasure,
                                                    measureDurationMs = measureDurationMs,
                                                    showDetails = showDetails,
                                                    keySignature = keySignature,
                                                    onClick = onCellClick,
                                                    modifier = Modifier.weight(1f),
                                                )
                                            } else {
                                                Box(modifier = Modifier.weight(1f))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Mini keyboard + PlaybackDock stacked at the very bottom.
            Column(modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()) {
                if (focusedMeasureData != null) {
                    // Pre-compute fixed-zoom window size across the whole
                    // song so the keyboard doesn't re-scale every measure.
                    val songSpan = remember(allMeasures) {
                        fixedKeyboardRange(
                            allMeasures.mapNotNull { m ->
                                val all = m.melodyNotes + m.chordNotes
                                if (all.isEmpty()) null
                                else all.minOf { it.pitch } to all.maxOf { it.pitch }
                            }
                        )
                    }
                    val activeRight = remember(focusedMeasureData) {
                        focusedMeasureData.melodyNotes.map { it.pitch }.toSet()
                    }
                    val activeLeft = remember(focusedMeasureData) {
                        focusedMeasureData.chordNotes.map { it.pitch }.toSet()
                    }
                    MiniKeyboard(
                        activeRight = activeRight,
                        activeLeft = activeLeft,
                        fixedRange = songSpan,
                    )
                }
                PlaybackDock(
                    playing = isPlaying,
                    onPlayPause = { if (isPlaying) vm.stop() else vm.play() },
                    speed = (tempoPercent * 100).toInt(),
                    onSpeed = { pct -> vm.adjustTempo(pct / 100f - tempoPercent) },
                    handMode = when (handVm) {
                        com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.LEFT -> HandMode.LEFT
                        com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.RIGHT -> HandMode.RIGHT
                        else -> HandMode.BOTH
                    },
                    onHandMode = { m ->
                        vm.setHand(when (m) {
                            HandMode.LEFT -> com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.LEFT
                            HandMode.RIGHT -> com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.RIGHT
                            else -> com.tobietheunknown.pianoteacher.ui.common.PlaybackHand.BOTH
                        })
                    },
                    metronome = isMetronomeEnabled,
                    onMetronome = vm::toggleMetronome,
                    loop = isLooping,
                    onLoop = vm::toggleLoop,
                    loopRange = ((loopStart ?: 0) + 1)..((loopEnd ?: 0) + 1),
                    onLoopRangeChange = { r -> vm.setLoopRange(r.first - 1, r.last - 1) },
                    loopEditorOpen = loopEditorOpen,
                    onToggleLoopEditor = { loopEditorOpen = !loopEditorOpen },
                    totalMeasures = totalMeasures.coerceAtLeast(1),
                    phrases = remember(song) {
                        val list = song?.phrases ?: emptyList()
                        var start = 1
                        list.mapIndexed { i, p ->
                            val end = start + p.length - 1
                            val r = PhraseRange(p.name.ifBlank { "Phrase ${i + 1}" }, start, end)
                            start = end + 1
                            r
                        }
                    },
                    onPrev = {
                        val tgt = (focusedMeasure - 1).coerceAtLeast(0)
                        vm.focusMeasure(tgt)
                    },
                    onNext = {
                        val tgt = (focusedMeasure + 1).coerceAtMost(totalMeasures - 1)
                        vm.focusMeasure(tgt)
                    },
                    // Recommencer: stop playback and return to the first measure.
                    onRestart = {
                        vm.stop()
                        vm.focusMeasure(0)
                    },
                )
            }
        }
    }
}

@Composable
private fun MeasureCardCompact(
    measure: MeasureData,
    beatsPerMeasure: Int,
    isCurrent: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    measureDurationMs: Long = 2000L,
    showDetails: Boolean = false,
    keySignature: MusicKeySignature? = null,
) {
    val border = if (isCurrent) IndigoAccent else BorderColor
    val bg = if (isCurrent) IndigoAccent.copy(alpha = 0.08f) else SurfaceVariant
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(bg)
            .border(1.5.dp, border, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            // Measure number (the harmony degree lives ONLY in the watermark).
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    String.format("%02d", measure.globalIndex + 1),
                    color = if (isCurrent) IndigoAccent else LL_MUTED_LABEL,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                )
            }

            // ── RIGHT hand (melody) ──────────────────────────────────────────
            //   Détail OFF + a role → role badge only.
            //   Détail OFF + no role → wrapped melody note chips.
            //   Détail ON → badge (if any) at top, then MotifRows / NotesRow below.
            val rightRole = measure.rightRole
            when {
                !showDetails && rightRole != null ->
                    HandRoleBadge(rightRole, hand = HandSide.RIGHT, keySignature = keySignature)
                !showDetails ->
                    NotesRow(measure.melodyNotes, color = CyanMelody)
                else -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (rightRole != null) {
                        HandRoleBadge(rightRole, hand = HandSide.RIGHT, keySignature = keySignature)
                    }
                    when {
                        measure.rightOstinato != null && measure.melodyNotes.isNotEmpty() ->
                            MotifRows(measure.melodyNotes, measure.rightOstinato!!.motifPcs.size, CyanMelody)
                        chordCycleLen(rightRole, measure.melodyNotes) != null ->
                            MotifRows(measure.melodyNotes, chordCycleLen(rightRole, measure.melodyNotes)!!, CyanMelody)
                        else -> NotesRow(measure.melodyNotes, color = CyanMelody)
                    }
                }
            }

            // ── LEFT hand (chords) ───────────────────────────────────────────
            //   Détail OFF + a role → role badge only.
            //   Détail OFF + no role + notes → ≤4 note chips + "…".
            //   Détail OFF + no role + no notes → empty spacer.
            //   Détail ON → badge (if any) at top, then MotifRows / NotesRow below.
            val leftRole = measure.leftRole
            when {
                !showDetails && leftRole != null ->
                    HandRoleBadge(leftRole, hand = HandSide.LEFT, keySignature = keySignature)
                !showDetails && measure.chordNotes.isNotEmpty() ->
                    LeftHandChips(measure.chordNotes)
                !showDetails ->
                    Box(modifier = Modifier.fillMaxWidth().height(18.dp))
                else -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (leftRole != null) {
                        HandRoleBadge(leftRole, hand = HandSide.LEFT, keySignature = keySignature)
                    }
                    when {
                        measure.leftOstinato != null && measure.chordNotes.isNotEmpty() ->
                            MotifRows(measure.chordNotes, measure.leftOstinato!!.motifPcs.size, PinkChords)
                        chordCycleLen(leftRole, measure.chordNotes) != null ->
                            MotifRows(measure.chordNotes, chordCycleLen(leftRole, measure.chordNotes)!!, PinkChords)
                        else -> NotesRow(measure.chordNotes, color = PinkChords)
                    }
                }
            }

            // Beat strip with cyan/pink dots aligned to note startTime
            BeatStrip(
                beatsPerMeasure = beatsPerMeasure,
                isCurrent = isCurrent,
                isPlaying = isPlaying,
                melody = measure.melodyNotes,
                chords = measure.chordNotes,
                measureDurationMs = measureDurationMs,
            )
        }

        // ── Combined-harmony WATERMARK ───────────────────────────────────────
        // Very top-right, discreet semi-transparent monospace, no border/box.
        // Carries the harmonic degree exclusively. "SIB Maj7/Ré · VI7".
        val harmony = measure.harmony
        if (harmony != null) {
            val text = harmony.degree?.let { "${harmony.label} · $it" } ?: harmony.label
            Text(
                text,
                color = LL_MUTED_LABEL.copy(alpha = 0.55f),
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.3.sp,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .fillMaxWidth(0.68f)
                    .wrapContentWidth(Alignment.End),
            )
        }
    }
}

/** Which hand a role badge belongs to (color resolved at render via theme tokens). */
private enum class HandSide { RIGHT, LEFT }

/**
 * Détail-ON cycle length for a CHORD-REDUCIBLE arpeggio hand — mirrors the web
 * `arpeggioBadge && motifInfo.notesPerCycle` MotifRows path. The role is a
 * HandRole.Ostinato with a literal motif absent (`ostinato == null`) whose
 * exact ordered cycle repeats (`chordReps > 1`). One cycle spans
 * noteCount / chordReps notes, so we chunk the ordered notes by that length.
 * Returns null when the hand is not a chord-reducible arpeggio with a real ×N
 * (the caller then falls back to a wrapped NotesRow — never a single line).
 */
private fun chordCycleLen(
    role: com.tobietheunknown.pianoteacher.utils.HandRole?,
    notes: List<NoteEvent>,
): Int? {
    val ost = role as? com.tobietheunknown.pianoteacher.utils.HandRole.Ostinato ?: return null
    // Literal-motif ostinatos are handled by the dedicated leftOstinato /
    // rightOstinato MotifRows branch; this path is the chord-reducible one.
    if (ost.ostinato != null) return null
    val noteCount = notes.size
    if (noteCount <= 0) return null
    if (ost.chordReps > 1 && noteCount % ost.chordReps == 0) {
        return noteCount / ost.chordReps
    }
    // No literal ×N: fall back to the display-cycle search (distinct-bass
    // sub-figures — Departure's do-mib-sol-mib / sol-mib-sol-mib halves).
    return com.tobietheunknown.pianoteacher.utils.displayCycleLen(
        notes.sortedBy { it.startTime }.map { it.pitch }
    )
}

@Composable
private fun handSideColor(hand: HandSide): Color =
    if (hand == HandSide.RIGHT) CyanMelody else PinkChords

/** Small "Détail" pill toggle in the header — ON shows the full per-note
 *  breakdown, OFF shows the combined arpeggio-badge layout. */
@Composable
private fun DetailToggle(active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(if (active) IndigoAccent else SurfaceVariant)
            .border(1.dp, if (active) IndigoAccent else BorderColor, RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            "Détail",
            color = if (active) Color.White else TextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * Renders the resolved per-hand role badge (arpège / ostinato / pédale) for a
 * measure card, hand-colored. The harmonic degree lives ONLY in the watermark,
 * so role badges no longer carry it. Mirrors web HandRoleBadge.
 */
@Composable
private fun HandRoleBadge(
    role: com.tobietheunknown.pianoteacher.utils.HandRole,
    hand: HandSide,
    keySignature: MusicKeySignature? = null,
) {
    when (role) {
        is com.tobietheunknown.pianoteacher.utils.HandRole.Ostinato ->
            OstinatoRoleBadge(role, hand)
        is com.tobietheunknown.pianoteacher.utils.HandRole.Pedal ->
            PedalRoleBadge(role.pedal, hand)
    }
}

// Shared dense role-chip frame: 11sp bold, padding ~3×8dp, radius 8dp.
@Composable
private fun RoleChip(
    tone: Color,
    contentDesc: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(tone.copy(alpha = 0.14f))
            .border(2.dp, tone, RoundedCornerShape(8.dp))
            .semantics { contentDescription = contentDesc }
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) { content() }
}

@Composable
private fun OstinatoRoleBadge(
    role: com.tobietheunknown.pianoteacher.utils.HandRole.Ostinato,
    hand: HandSide,
) {
    // Unified badge (user decision): every badged figure repeats across ≥2
    // measures, so it IS an ostinato — "arpège" survives in the description.
    val tone = handSideColor(hand)
    val isChord = role.chordLabel != null
    val label: String
    val desc: String
    val reps: Int
    if (isChord) {
        label = "Ostinato ${role.chordLabel}"
        val altMention = if (role.chordAltered)
            " — altération" + (role.chordAlteredNote?.let { " ($it)" } ?: "")
        else ""
        desc = "Ostinato — accord ${role.chordLabel} égrené (arpège)$altMention"
        reps = role.chordReps
    } else {
        val notes = role.ostinato!!.motifLabels.joinToString("·")
        label = "Ostinato $notes"
        desc = "Ostinato — motif répété ${role.ostinato.repetitions}× ($notes)"
        reps = role.ostinato.repetitions
    }
    // The note list ellipsizes on narrow cards but the ×N never clips: it sits
    // as a non-shrinking suffix outside the weighted/ellipsized text. The chip
    // fills the card width so the weighted text actually has a bound to shrink to.
    RoleChip(tone, desc, modifier = Modifier.fillMaxWidth()) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OstinatoGlyph(tone)
            Text(
                label,
                color = tone, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                letterSpacing = 0.2.sp, maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            if (reps > 1) {
                Text(
                    "×$reps",
                    color = tone.copy(alpha = 0.8f), fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun PedalRoleBadge(
    pedal: com.tobietheunknown.pianoteacher.utils.PedalQualification,
    hand: HandSide,
) {
    val tone = handSideColor(hand)
    val desc = if (pedal.octave) "Pédale jouée en octave (8va)" else "Pédale — note tenue / répétée"
    RoleChip(tone, desc) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PedalGlyph(tone)
            Text(
                "Pédale ${pedal.label}" + if (pedal.octave) " · 8va" else "",
                color = tone, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                letterSpacing = 0.2.sp,
            )
        }
    }
}

// Repeating-wave glyph — reads as "ostinato" (a motif looping).
@Composable
private fun OstinatoGlyph(tone: Color) {
    Canvas(modifier = Modifier.size(width = 16.dp, height = 12.dp)) {
        val w = size.width
        fun wave(yMid: Float, alpha: Float) {
            val path = androidx.compose.ui.graphics.Path()
            val amp = 2.dp.toPx()
            val seg = w / 6f
            path.moveTo(seg * 0.3f, yMid)
            var x = seg * 0.3f
            var up = true
            while (x < w) {
                val cx = x + seg / 2f
                val cy = if (up) yMid - amp else yMid + amp
                path.quadraticTo(cx, cy, x + seg, yMid)
                x += seg; up = !up
            }
            drawPath(path, tone.copy(alpha = alpha),
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.4.dp.toPx()))
        }
        wave(size.height * 0.58f, 1f)
        wave(size.height * 0.83f, 0.5f)
    }
}

// Sustained-line glyph for a pédale (a single long held tone): dot + line.
@Composable
private fun PedalGlyph(tone: Color) {
    Canvas(modifier = Modifier.size(width = 16.dp, height = 12.dp)) {
        val midY = size.height / 2f
        drawCircle(tone, radius = 2.dp.toPx(), center = Offset(3.dp.toPx(), midY))
        drawLine(
            tone, Offset(5.dp.toPx(), midY), Offset(15.dp.toPx(), midY),
            strokeWidth = 1.6.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round,
        )
    }
}

/**
 * Détail-OFF fallback for a left hand with notes but no role badge: up to 4
 * note chips + a trailing "…" when truncated. Mirrors the web LH fallback.
 */
@Composable
private fun LeftHandChips(notes: List<NoteEvent>) {
    val labels = remember(notes) {
        notes.sortedBy { it.startTime }.map { noteName(it.pitch) }
    }
    val tone = PinkChords  // HandLeft
    Row(
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.heightIn(min = 18.dp),
    ) {
        labels.take(4).forEach { lab ->
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(tone.copy(alpha = 0.22f))
                    .border(1.dp, tone.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 5.dp, vertical = 1.dp),
            ) {
                Text(lab, color = tone, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (labels.size > 4) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .border(1.dp, tone.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
                    .padding(horizontal = 5.dp, vertical = 1.dp),
            ) {
                Text("…", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * Détail-ON note chips for an ostinato hand, grouped BY MOTIF OCCURRENCE — one
 * Row per repetition; the last row may be the truncated prefix. Mirrors web
 * MotifRows.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MotifRows(notes: List<NoteEvent>, motifLen: Int, tone: Color) {
    val labels = remember(notes) {
        notes.sortedBy { it.startTime }.map { noteName(it.pitch) }
    }
    val rows = remember(labels, motifLen) {
        if (motifLen <= 0) listOf(labels) else labels.chunked(motifLen)
    }
    Column(
        verticalArrangement = Arrangement.spacedBy(3.dp),
        modifier = Modifier.heightIn(min = 18.dp),
    ) {
        rows.forEach { row ->
            // Each motif occurrence is itself a FlowRow so a long cycle wraps to
            // the next line instead of overflowing the card width.
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                row.forEach { lab ->
                    NoteChip(lab, tone)
                }
            }
        }
    }
}

/** Small dense note chip — 10sp bold, padding ~1×5dp, rounded 4dp. */
@Composable
private fun NoteChip(label: String, tone: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(tone.copy(alpha = 0.22f))
            .border(1.dp, tone.copy(alpha = 0.5f), RoundedCornerShape(4.dp))
            .padding(horizontal = 5.dp, vertical = 1.dp),
    ) {
        Text(label, color = tone, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NotesRow(notes: List<NoteEvent>, color: Color) {
    val labels = remember(notes) {
        notes
            .sortedBy { it.startTime }
            .map { noteName(it.pitch) }
            .take(16)
    }
    if (labels.isEmpty()) {
        Box(modifier = Modifier.fillMaxWidth().height(18.dp))
        return
    }
    // FlowRow so a long sequence wraps onto multiple lines instead of
    // overflowing the card on a single unreadable line (the Détail-ON bug).
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        labels.forEach { lab ->
            NoteChip(lab, color)
        }
    }
}

@Composable
private fun BeatStrip(
    beatsPerMeasure: Int,
    isCurrent: Boolean,
    isPlaying: Boolean,
    melody: List<NoteEvent>,
    chords: List<NoteEvent>,
    measureDurationMs: Long = 2000L,
) {
    // Two-row visible track: cyan dots on top, pink dots on bottom, with
    // a thicker divider mid-line and brighter dots.
    // Wall-clock playhead progress within the active measure.
    val playheadFrac by androidx.compose.runtime.produceState(
        initialValue = 0f,
        isCurrent, isPlaying, measureDurationMs,
    ) {
        if (!(isCurrent && isPlaying)) { value = 0f; return@produceState }
        val start = android.os.SystemClock.elapsedRealtime()
        while (true) {
            val elapsed = android.os.SystemClock.elapsedRealtime() - start
            value = ((elapsed.toFloat() / measureDurationMs.coerceAtLeast(1L)) % 1f).coerceIn(0f, 1f)
            kotlinx.coroutines.delay(16)
        }
    }

    Box(modifier = Modifier
        .fillMaxWidth()
        .height(22.dp)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val cyanY = h * 0.30f
            val pinkY = h * 0.70f
            val midY = h / 2f
            // Middle hairline divider
            drawRect(
                color = LL_BEAT_DIV_DIM,
                topLeft = Offset(0f, midY - 0.5f),
                size = Size(w, 1f),
            )
            // Beat division lines (N-1) — taller, brighter
            for (i in 1 until beatsPerMeasure) {
                val x = w * i / beatsPerMeasure
                drawRect(
                    color = LL_BEAT_DIV_BRIGHT,
                    topLeft = Offset(x - 0.5f, 0f),
                    size = Size(1f, h),
                )
            }

            val measureBeats = beatsPerMeasure.toDouble()
            val measureStart = (melody + chords).firstOrNull()?.startTime?.let {
                (it / measureBeats).toInt() * measureBeats
            } ?: 0.0

            // Melody dots — top row, bigger + glow
            melody.forEach { n ->
                val frac = ((n.startTime - measureStart) / measureBeats).coerceIn(0.0, 1.0)
                val x = w * frac.toFloat()
                drawCircle(color = LL_MELODY_GLOW, radius = 7f, center = Offset(x, cyanY))
                drawCircle(color = LL_MELODY_BRIGHT, radius = 4f, center = Offset(x, cyanY))
            }
            // Chord dots — bottom row
            chords.forEach { n ->
                val frac = ((n.startTime - measureStart) / measureBeats).coerceIn(0.0, 1.0)
                val x = w * frac.toFloat()
                drawCircle(color = LL_CHORD_GLOW, radius = 7f, center = Offset(x, pinkY))
                drawCircle(color = LL_CHORD_BRIGHT, radius = 4f, center = Offset(x, pinkY))
            }
            // Playhead — accent vertical line scrubbing across the strip
            if (isCurrent && isPlaying) {
                val px = w * playheadFrac
                drawRect(
                    color = LL_PLAYHEAD_GLOW,
                    topLeft = Offset(px - 6f, 0f),
                    size = Size(12f, h),
                )
                drawRect(
                    color = LL_PLAYHEAD_CORE,
                    topLeft = Offset(px - 1f, 0f),
                    size = Size(2f, h),
                )
            }
        }
    }
}

