package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.*
import java.util.UUID

fun splitPhraseAtMeasure(
    phrase: Phrase,
    splitMeasure: Int,
    unitsPerMeasure: Double,
    newName: String = "${phrase.name} bis",
): Pair<Phrase, Phrase>? {
    if (splitMeasure <= 0 || splitMeasure >= phrase.length || !unitsPerMeasure.isFinite() || unitsPerMeasure <= 0) return null
    val splitTime = splitMeasure * unitsPerMeasure
    // Keep crossing holds with their attack: splitting must not add a reattack
    // or shorten a note when playing the complete song or merging it again.
    fun partition(notes: List<NoteEvent>) = notes.filter { it.startTime < splitTime } to
        notes.filter { it.startTime >= splitTime }.map { it.copy(startTime = it.startTime - splitTime) }
    val (melodyBefore, melodyAfter) = partition(phrase.tracks.melody)
    val (chordsBefore, chordsAfter) = partition(phrase.tracks.chords)
    val beforeSeparators = phrase.handSeparators.filter { it.fromMeasure < splitMeasure }
    val afterSeparators = phrase.handSeparators.filter { it.fromMeasure >= splitMeasure }
        .map { it.copy(fromMeasure = it.fromMeasure - splitMeasure) }.toMutableList()
    val inherited = phrase.handSeparators.filter { it.fromMeasure <= splitMeasure }.maxByOrNull { it.fromMeasure }
    if (inherited != null && afterSeparators.none { it.fromMeasure == 0 }) {
        afterSeparators.add(0, inherited.copy(fromMeasure = 0))
    }
    return phrase.copy(
        length = splitMeasure,
        tracks = Tracks(melodyBefore, chordsBefore),
        handSeparators = beforeSeparators,
    ) to phrase.copy(
        id = UUID.randomUUID().toString(),
        name = newName,
        length = phrase.length - splitMeasure,
        tracks = Tracks(melodyAfter, chordsAfter),
        handSeparators = afterSeparators,
    )
}

fun mergePhrases(previous: Phrase, current: Phrase, unitsPerMeasure: Double): Phrase {
    val offset = previous.length * unitsPerMeasure
    return previous.copy(
        length = previous.length + current.length,
        tracks = Tracks(
            previous.tracks.melody + current.tracks.melody.map { it.copy(startTime = it.startTime + offset) },
            previous.tracks.chords + current.tracks.chords.map { it.copy(startTime = it.startTime + offset) },
        ),
        handSeparators = previous.handSeparators + current.handSeparators.map {
            it.copy(fromMeasure = it.fromMeasure + previous.length)
        },
    )
}
