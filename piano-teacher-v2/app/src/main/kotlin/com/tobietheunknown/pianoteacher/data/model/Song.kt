package com.tobietheunknown.pianoteacher.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// ─── Core models (mirrors Piano Teacher v1 JSON format) ───────────────────────

@Serializable
data class NoteEvent(
    val id: String,
    val pitch: Int,          // MIDI note number (0–127)
    val startTime: Double,   // in beats
    val duration: Double     // in beats
)

@Serializable
data class Tracks(
    val melody: List<NoteEvent> = emptyList(),  // Right hand
    val chords: List<NoteEvent> = emptyList()   // Left hand
)

@Serializable
data class Phrase(
    val id: String,
    val name: String,
    val length: Int,         // in measures
    val tracks: Tracks = Tracks(),
    val handSeparators: List<HandSeparator> = emptyList()
)

@Serializable
data class HandSeparator(
    val fromMeasure: Int,
    val pitch: Int
)

@Serializable
data class KeySignature(
    val note: String = "C",
    val mode: String = "major"
)

@Serializable
data class TimeSignature(
    val numerator: Int = 4,
    val denominator: Int = 4
)

@Serializable
data class Song(
    val id: String,
    val title: String,
    val artist: String = "",
    val key: KeySignature = KeySignature(),
    val tempo: Int = 120,
    val timeSignature: TimeSignature = TimeSignature(),
    val phrases: List<Phrase> = emptyList(),
    val highlightedMeasures: List<Int> = emptyList(),
    val createdAt: String = ""
) {
    val totalMeasures: Int get() = phrases.sumOf { it.length }
    val beatsPerMeasure: Int get() = timeSignature.numerator
    val totalBeats: Double get() = totalMeasures.toDouble() * beatsPerMeasure
    val durationSeconds: Double get() = totalBeats / (tempo / 60.0)
}

// ─── Room Entity ──────────────────────────────────────────────────────────────

@Entity(tableName = "songs")
@TypeConverters(SongConverters::class)
data class SongEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val tempo: Int,
    val keyNote: String,
    val keyMode: String,
    val timeSignatureNumerator: Int,
    val timeSignatureDenominator: Int,
    val phrasesJson: String,        // JSON-serialized List<Phrase>
    val highlightedMeasures: String, // JSON-serialized List<Int>
    val createdAt: String,
    val lastPlayedAt: String = "",
    val masteredPhrases: String = "[]" // JSON list of mastered phrase IDs
)

fun Song.toEntity() = SongEntity(
    id = id,
    title = title,
    artist = artist,
    tempo = tempo,
    keyNote = key.note,
    keyMode = key.mode,
    timeSignatureNumerator = timeSignature.numerator,
    timeSignatureDenominator = timeSignature.denominator,
    phrasesJson = Json.encodeToString<List<Phrase>>(phrases),
    highlightedMeasures = Json.encodeToString<List<Int>>(highlightedMeasures),
    createdAt = createdAt
)

fun SongEntity.toDomain() = Song(
    id = id,
    title = title,
    artist = artist,
    key = KeySignature(keyNote, keyMode),
    tempo = tempo,
    timeSignature = TimeSignature(timeSignatureNumerator, timeSignatureDenominator),
    phrases = Json.decodeFromString(phrasesJson),
    highlightedMeasures = Json.decodeFromString(highlightedMeasures),
    createdAt = createdAt
)

class SongConverters {
    private val phraseListSerializer = kotlinx.serialization.builtins.ListSerializer(Phrase.serializer())

    @TypeConverter
    fun fromPhraseList(value: List<Phrase>): String = Json.encodeToString(phraseListSerializer, value)
    @TypeConverter
    fun toPhraseList(value: String): List<Phrase> = Json.decodeFromString(phraseListSerializer, value)
}
