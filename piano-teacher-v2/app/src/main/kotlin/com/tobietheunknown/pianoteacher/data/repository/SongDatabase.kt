package com.tobietheunknown.pianoteacher.data.repository

import android.content.Context
import androidx.room.*
import com.tobietheunknown.pianoteacher.data.model.SongEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SongDao {
    @Query("SELECT * FROM songs ORDER BY lastPlayedAt DESC, createdAt DESC")
    fun getAllSongs(): Flow<List<SongEntity>>

    @Query("SELECT * FROM songs WHERE id = :id")
    suspend fun getSongById(id: String): SongEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSong(song: SongEntity)

    @Delete
    suspend fun deleteSong(song: SongEntity)

    @Query("UPDATE songs SET lastPlayedAt = :timestamp WHERE id = :id")
    suspend fun updateLastPlayed(id: String, timestamp: String)

    @Query("UPDATE songs SET masteredPhrases = :masteredJson WHERE id = :id")
    suspend fun updateMasteredPhrases(id: String, masteredJson: String)
}

@Database(entities = [SongEntity::class], version = 1, exportSchema = false)
abstract class SongDatabase : RoomDatabase() {
    abstract fun songDao(): SongDao

    companion object {
        @Volatile private var INSTANCE: SongDatabase? = null

        fun getInstance(context: Context): SongDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    SongDatabase::class.java,
                    "piano_teacher.db"
                ).build().also { INSTANCE = it }
            }
    }
}
