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
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
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

    suspend fun getMasteredPhrases(songId: String): Set<String> = withContext(Dispatchers.IO) {
        val entity = dao.getSongById(songId) ?: return@withContext emptySet()
        Json.decodeFromString(ListSerializer(String.serializer()), entity.masteredPhrases).toSet()
    }

    suspend fun updateMasteredPhrases(songId: String, masteredPhraseIds: Set<String>) =
        withContext(Dispatchers.IO) {
            dao.updateMasteredPhrases(songId, Json.encodeToString(ListSerializer(String.serializer()), masteredPhraseIds.toList()))
        }

    suspend fun updateSong(song: Song) = withContext(Dispatchers.IO) {
        dao.insertSong(song.toEntity()) // REPLACE on conflict
    }

    suspend fun updateSongTitle(songId: String, title: String) = withContext(Dispatchers.IO) {
        dao.updateTitle(songId, title)
    }

    suspend fun importFromAssets(assetName: String, title: String): ImportResult = withContext(Dispatchers.IO) {
        runCatching {
            val input = context.assets.open(assetName)
            val song = MidiParser.parse(input, title).getOrElse {
                return@runCatching ImportResult.Error("Erreur MIDI : ${it.message}")
            }
            if (song.phrases.isEmpty()) {
                return@runCatching ImportResult.Error("Aucune note trouvée")
            }
            saveSong(song)
            ImportResult.Success(song)
        }.getOrElse { ImportResult.Error(it.message ?: "Erreur inconnue") }
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

            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: return@runCatching ImportResult.Error("Impossible d'ouvrir le fichier")

            // Detect MIDI by mime type, extension, or magic bytes (MThd = 4D 54 68 64)
            val isMidi = mimeType.contains("midi", ignoreCase = true) ||
                         mimeType.contains("/mid", ignoreCase = true) ||
                         fileName.endsWith(".mid", ignoreCase = true) ||
                         fileName.endsWith(".midi", ignoreCase = true) ||
                         (bytes.size >= 4 &&
                          bytes[0] == 0x4D.toByte() && bytes[1] == 0x54.toByte() &&
                          bytes[2] == 0x68.toByte() && bytes[3] == 0x64.toByte())

            if (isMidi) {
                val result = MidiParser.parse(bytes.inputStream(), titleFromFile)
                val song = result.getOrElse {
                    return@runCatching ImportResult.Error("Erreur MIDI : ${it.message}")
                }
                if (song.phrases.isEmpty()) {
                    return@runCatching ImportResult.Error("Aucune note trouvée dans ce fichier MIDI")
                }
                saveSong(song)
                ImportResult.Success(song)
            } else {
                val json = bytes.toString(Charsets.UTF_8)
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
                        ImportResult.Error("Format non reconnu (.mid ou .json attendu)")
                    }
                }
            }
        }.getOrElse { ImportResult.Error(it.message ?: "Erreur inconnue") }
    }
}
