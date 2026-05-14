package com.tobietheunknown.pianoteacher.data.parser

import com.tobietheunknown.pianoteacher.data.model.Song
import kotlinx.serialization.json.Json

/**
 * Parses Piano Teacher v1 exported JSON files into Song domain objects.
 * Compatible with all v1/v2/v4 export formats including legacy pitch-as-string.
 */
object SongJsonParser {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    fun parse(jsonString: String): Result<Song> = runCatching {
        json.decodeFromString<Song>(jsonString)
    }

    fun parseLibrary(jsonString: String): Result<List<Song>> = runCatching {
        json.decodeFromString<List<Song>>(jsonString)
    }
}
