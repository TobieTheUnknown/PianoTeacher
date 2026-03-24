package com.tobietheunknown.pianoteacher.data.repository

import android.content.Context
import android.net.Uri
import com.tobietheunknown.pianoteacher.data.model.Song
import com.tobietheunknown.pianoteacher.data.model.toDomain
import com.tobietheunknown.pianoteacher.data.model.toEntity
import com.tobietheunknown.pianoteacher.data.parser.MidiParser
import com.tobietheunknown.pianoteacher.data.parser.SongJsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.time.Instant

class SongRepository(private val context: Context) {

    private val dao = SongDatabase.getInstance(context).songDao()

    val songs: Flow<List<Song>> = dao.getAllSongs().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun getSong(id: String): Song? = withContext(Dispatchers.IO) {
        dao.getSongById(id)?.toDomain()
    }

    suspend fun saveSong(song: Song) = withContext(Dispatchers.IO) {
        dao.insertSong(song.toEntity())
    }

    suspend fun deleteSong(song: Song) = withContext(Dispatchers.IO) {
        dao.deleteSong(song.toEntity())
    }

    suspend fun markPlayed(songId: String) = withContext(Dispatchers.IO) {
        dao.updateLastPlayed(songId, Instant.now().toString())
    }

    suspend fun updateMasteredPhrases(songId: String, masteredPhraseIds: Set<String>) =
        withContext(Dispatchers.IO) {
            dao.updateMasteredPhrases(songId, Json.encodeToString(masteredPhraseIds.toList()))
        }

    // ─── Import ───────────────────────────────────────────────────────────────

    sealed class ImportResult {
        data class Success(val song: Song) : ImportResult()
        data class MultiSuccess(val songs: List<Song>) : ImportResult()
        data class Error(val message: String) : ImportResult()
    }

    suspend fun importFromUri(uri: Uri): ImportResult = withContext(Dispatchers.IO) {
        runCatching {
            val mimeType = context.contentResolver.getType(uri) ?: ""
            val fileName = uri.lastPathSegment?.substringAfterLast("/") ?: "Untitled"
            val titleFromFile = fileName.substringBeforeLast(".")

            context.contentResolver.openInputStream(uri)?.use { stream ->
                when {
                    mimeType.contains("midi") || mimeType.contains("mid") ||
                    fileName.endsWith(".mid", ignoreCase = true) -> {
                        MidiParser.parse(stream, titleFromFile).fold(
                            onSuccess = { song ->
                                saveSong(song)
                                ImportResult.Success(song)
                            },
                            onFailure = { ImportResult.Error("MIDI parse error: ${it.message}") }
                        )
                    }
                    else -> {
                        // Try JSON (single song or library)
                        val json = stream.bufferedReader().readText()
                        val singleResult = SongJsonParser.parse(json)
                        if (singleResult.isSuccess) {
                            val song = singleResult.getOrThrow()
                            saveSong(song)
                            ImportResult.Success(song)
                        } else {
                            val libraryResult = SongJsonParser.parseLibrary(json)
                            if (libraryResult.isSuccess) {
                                val songs = libraryResult.getOrThrow()
                                songs.forEach { saveSong(it) }
                                ImportResult.MultiSuccess(songs)
                            } else {
                                ImportResult.Error("Format non reconnu")
                            }
                        }
                    }
                }
            } ?: ImportResult.Error("Impossible d'ouvrir le fichier")
        }.getOrElse { ImportResult.Error(it.message ?: "Erreur inconnue") }
    }
}
