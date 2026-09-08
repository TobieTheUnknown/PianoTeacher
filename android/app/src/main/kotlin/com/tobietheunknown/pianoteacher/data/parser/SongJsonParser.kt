package com.tobietheunknown.pianoteacher.data.parser

import com.tobietheunknown.pianoteacher.data.model.Song
import kotlinx.serialization.json.*
import java.util.UUID

/** Normalizes legacy flat tracks, named pitches and compact keys before decoding. */
object SongJsonParser {
    private val json = Json { ignoreUnknownKeys = true }

    fun parse(jsonString: String): Result<Song> = runCatching {
        decode(json.parseToJsonElement(jsonString).jsonObject)
    }

    fun parseLibrary(jsonString: String): Result<List<Song>> = runCatching {
        json.parseToJsonElement(jsonString).jsonArray.map { decode(it.jsonObject) }
    }

    private fun pitch(value: JsonElement): JsonPrimitive {
        val text = value.jsonPrimitive.content
        val numeric = text.toIntOrNull()
        val midi = numeric ?: run {
            val match = Regex("^([A-Ga-g])([#b]?)(-?\\d+)$").matchEntire(text)
                ?: error("Note invalide : $text")
            val base = mapOf('C' to 0, 'D' to 2, 'E' to 4, 'F' to 5, 'G' to 7, 'A' to 9, 'B' to 11)
                .getValue(match.groupValues[1].uppercase()[0])
            val accidental = when (match.groupValues[2]) { "#" -> 1; "b" -> -1; else -> 0 }
            (match.groupValues[3].toInt() + 1) * 12 + base + accidental
        }
        require(midi in 0..127) { "Note MIDI hors limites : $text" }
        return JsonPrimitive(midi)
    }

    private fun decode(source: JsonObject): Song {
        val normalized = source.toMutableMap()
        normalized.putIfAbsent("id", JsonPrimitive(UUID.randomUUID().toString()))
        val key = source["key"]
        if (key is JsonPrimitive && key.isString) {
            val match = Regex("^([A-Ga-g])([#b]?)(m|-(?:major|minor))?$").matchEntire(key.content)
                ?: error("Tonalité invalide : ${key.content}")
            normalized["key"] = buildJsonObject {
                put("note", match.groupValues[1].uppercase() + match.groupValues[2])
                put("mode", if (match.groupValues[3] in listOf("m", "-minor")) "minor" else "major")
            }
        }
        normalized["phrases"] = JsonArray((source["phrases"]?.jsonArray ?: JsonArray(emptyList())).map { item ->
            val phrase = item.jsonObject.toMutableMap()
            phrase.putIfAbsent("id", JsonPrimitive(UUID.randomUUID().toString()))
            val tracks = phrase["tracks"]?.jsonObject ?: JsonObject(emptyMap())
            phrase["tracks"] = buildJsonObject {
                for (hand in listOf("melody", "chords")) {
                    val notes = tracks[hand] ?: phrase[hand] ?: JsonArray(emptyList())
                    put(hand, JsonArray(notes.jsonArray.map { note ->
                        val fields = note.jsonObject.toMutableMap()
                        fields.putIfAbsent("id", JsonPrimitive(UUID.randomUUID().toString()))
                        fields["pitch"] = pitch(fields.getValue("pitch"))
                        JsonObject(fields)
                    }))
                    phrase.remove(hand)
                }
            }
            phrase["handSeparators"]?.let { separators ->
                phrase["handSeparators"] = JsonArray(separators.jsonArray.map { separator ->
                    JsonObject(separator.jsonObject.toMutableMap().apply { this["pitch"] = pitch(getValue("pitch")) })
                })
            }
            JsonObject(phrase)
        })
        val song = json.decodeFromJsonElement<Song>(JsonObject(normalized))
        require(song.tempo > 0) { "Tempo invalide" }
        require(song.timeSignature.numerator > 0 && song.timeSignature.denominator in listOf(1, 2, 4, 8, 16, 32, 64)) {
            "Signature rythmique invalide"
        }
        for (phrase in song.phrases) {
            require(phrase.length > 0) { "Longueur de phrase invalide" }
            for (note in phrase.tracks.melody + phrase.tracks.chords) {
                require(note.startTime.isFinite() && note.startTime >= 0 && note.duration.isFinite() && note.duration > 0) {
                    "Durée ou position de note invalide"
                }
            }
        }
        return song
    }
}
