package com.tobietheunknown.pianoteacher.data.repository;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityDeletionOrUpdateAdapter;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import com.tobietheunknown.pianoteacher.data.model.SongEntity;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class SongDao_Impl implements SongDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<SongEntity> __insertionAdapterOfSongEntity;

  private final EntityDeletionOrUpdateAdapter<SongEntity> __deletionAdapterOfSongEntity;

  private final SharedSQLiteStatement __preparedStmtOfUpdateLastPlayed;

  private final SharedSQLiteStatement __preparedStmtOfUpdateMasteredPhrases;

  private final SharedSQLiteStatement __preparedStmtOfUpdateTitle;

  public SongDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfSongEntity = new EntityInsertionAdapter<SongEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR REPLACE INTO `songs` (`id`,`title`,`artist`,`tempo`,`keyNote`,`keyMode`,`timeSignatureNumerator`,`timeSignatureDenominator`,`phrasesJson`,`highlightedMeasures`,`createdAt`,`lastPlayedAt`,`masteredPhrases`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final SongEntity entity) {
        statement.bindString(1, entity.getId());
        statement.bindString(2, entity.getTitle());
        statement.bindString(3, entity.getArtist());
        statement.bindLong(4, entity.getTempo());
        statement.bindString(5, entity.getKeyNote());
        statement.bindString(6, entity.getKeyMode());
        statement.bindLong(7, entity.getTimeSignatureNumerator());
        statement.bindLong(8, entity.getTimeSignatureDenominator());
        statement.bindString(9, entity.getPhrasesJson());
        statement.bindString(10, entity.getHighlightedMeasures());
        statement.bindString(11, entity.getCreatedAt());
        statement.bindString(12, entity.getLastPlayedAt());
        statement.bindString(13, entity.getMasteredPhrases());
      }
    };
    this.__deletionAdapterOfSongEntity = new EntityDeletionOrUpdateAdapter<SongEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "DELETE FROM `songs` WHERE `id` = ?";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final SongEntity entity) {
        statement.bindString(1, entity.getId());
      }
    };
    this.__preparedStmtOfUpdateLastPlayed = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "UPDATE songs SET lastPlayedAt = ? WHERE id = ?";
        return _query;
      }
    };
    this.__preparedStmtOfUpdateMasteredPhrases = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "UPDATE songs SET masteredPhrases = ? WHERE id = ?";
        return _query;
      }
    };
    this.__preparedStmtOfUpdateTitle = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "UPDATE songs SET title = ? WHERE id = ?";
        return _query;
      }
    };
  }

  @Override
  public Object insertSong(final SongEntity song, final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfSongEntity.insert(song);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object deleteSong(final SongEntity song, final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __deletionAdapterOfSongEntity.handle(song);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object updateLastPlayed(final String id, final String timestamp,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfUpdateLastPlayed.acquire();
        int _argIndex = 1;
        _stmt.bindString(_argIndex, timestamp);
        _argIndex = 2;
        _stmt.bindString(_argIndex, id);
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfUpdateLastPlayed.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Object updateMasteredPhrases(final String id, final String masteredJson,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfUpdateMasteredPhrases.acquire();
        int _argIndex = 1;
        _stmt.bindString(_argIndex, masteredJson);
        _argIndex = 2;
        _stmt.bindString(_argIndex, id);
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfUpdateMasteredPhrases.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Object updateTitle(final String id, final String title,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfUpdateTitle.acquire();
        int _argIndex = 1;
        _stmt.bindString(_argIndex, title);
        _argIndex = 2;
        _stmt.bindString(_argIndex, id);
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfUpdateTitle.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<SongEntity>> getAllSongs() {
    final String _sql = "SELECT * FROM songs ORDER BY lastPlayedAt DESC, createdAt DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"songs"}, new Callable<List<SongEntity>>() {
      @Override
      @NonNull
      public List<SongEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfTitle = CursorUtil.getColumnIndexOrThrow(_cursor, "title");
          final int _cursorIndexOfArtist = CursorUtil.getColumnIndexOrThrow(_cursor, "artist");
          final int _cursorIndexOfTempo = CursorUtil.getColumnIndexOrThrow(_cursor, "tempo");
          final int _cursorIndexOfKeyNote = CursorUtil.getColumnIndexOrThrow(_cursor, "keyNote");
          final int _cursorIndexOfKeyMode = CursorUtil.getColumnIndexOrThrow(_cursor, "keyMode");
          final int _cursorIndexOfTimeSignatureNumerator = CursorUtil.getColumnIndexOrThrow(_cursor, "timeSignatureNumerator");
          final int _cursorIndexOfTimeSignatureDenominator = CursorUtil.getColumnIndexOrThrow(_cursor, "timeSignatureDenominator");
          final int _cursorIndexOfPhrasesJson = CursorUtil.getColumnIndexOrThrow(_cursor, "phrasesJson");
          final int _cursorIndexOfHighlightedMeasures = CursorUtil.getColumnIndexOrThrow(_cursor, "highlightedMeasures");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfLastPlayedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "lastPlayedAt");
          final int _cursorIndexOfMasteredPhrases = CursorUtil.getColumnIndexOrThrow(_cursor, "masteredPhrases");
          final List<SongEntity> _result = new ArrayList<SongEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final SongEntity _item;
            final String _tmpId;
            _tmpId = _cursor.getString(_cursorIndexOfId);
            final String _tmpTitle;
            _tmpTitle = _cursor.getString(_cursorIndexOfTitle);
            final String _tmpArtist;
            _tmpArtist = _cursor.getString(_cursorIndexOfArtist);
            final int _tmpTempo;
            _tmpTempo = _cursor.getInt(_cursorIndexOfTempo);
            final String _tmpKeyNote;
            _tmpKeyNote = _cursor.getString(_cursorIndexOfKeyNote);
            final String _tmpKeyMode;
            _tmpKeyMode = _cursor.getString(_cursorIndexOfKeyMode);
            final int _tmpTimeSignatureNumerator;
            _tmpTimeSignatureNumerator = _cursor.getInt(_cursorIndexOfTimeSignatureNumerator);
            final int _tmpTimeSignatureDenominator;
            _tmpTimeSignatureDenominator = _cursor.getInt(_cursorIndexOfTimeSignatureDenominator);
            final String _tmpPhrasesJson;
            _tmpPhrasesJson = _cursor.getString(_cursorIndexOfPhrasesJson);
            final String _tmpHighlightedMeasures;
            _tmpHighlightedMeasures = _cursor.getString(_cursorIndexOfHighlightedMeasures);
            final String _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getString(_cursorIndexOfCreatedAt);
            final String _tmpLastPlayedAt;
            _tmpLastPlayedAt = _cursor.getString(_cursorIndexOfLastPlayedAt);
            final String _tmpMasteredPhrases;
            _tmpMasteredPhrases = _cursor.getString(_cursorIndexOfMasteredPhrases);
            _item = new SongEntity(_tmpId,_tmpTitle,_tmpArtist,_tmpTempo,_tmpKeyNote,_tmpKeyMode,_tmpTimeSignatureNumerator,_tmpTimeSignatureDenominator,_tmpPhrasesJson,_tmpHighlightedMeasures,_tmpCreatedAt,_tmpLastPlayedAt,_tmpMasteredPhrases);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object getSongById(final String id, final Continuation<? super SongEntity> $completion) {
    final String _sql = "SELECT * FROM songs WHERE id = ?";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 1);
    int _argIndex = 1;
    _statement.bindString(_argIndex, id);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<SongEntity>() {
      @Override
      @Nullable
      public SongEntity call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfTitle = CursorUtil.getColumnIndexOrThrow(_cursor, "title");
          final int _cursorIndexOfArtist = CursorUtil.getColumnIndexOrThrow(_cursor, "artist");
          final int _cursorIndexOfTempo = CursorUtil.getColumnIndexOrThrow(_cursor, "tempo");
          final int _cursorIndexOfKeyNote = CursorUtil.getColumnIndexOrThrow(_cursor, "keyNote");
          final int _cursorIndexOfKeyMode = CursorUtil.getColumnIndexOrThrow(_cursor, "keyMode");
          final int _cursorIndexOfTimeSignatureNumerator = CursorUtil.getColumnIndexOrThrow(_cursor, "timeSignatureNumerator");
          final int _cursorIndexOfTimeSignatureDenominator = CursorUtil.getColumnIndexOrThrow(_cursor, "timeSignatureDenominator");
          final int _cursorIndexOfPhrasesJson = CursorUtil.getColumnIndexOrThrow(_cursor, "phrasesJson");
          final int _cursorIndexOfHighlightedMeasures = CursorUtil.getColumnIndexOrThrow(_cursor, "highlightedMeasures");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfLastPlayedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "lastPlayedAt");
          final int _cursorIndexOfMasteredPhrases = CursorUtil.getColumnIndexOrThrow(_cursor, "masteredPhrases");
          final SongEntity _result;
          if (_cursor.moveToFirst()) {
            final String _tmpId;
            _tmpId = _cursor.getString(_cursorIndexOfId);
            final String _tmpTitle;
            _tmpTitle = _cursor.getString(_cursorIndexOfTitle);
            final String _tmpArtist;
            _tmpArtist = _cursor.getString(_cursorIndexOfArtist);
            final int _tmpTempo;
            _tmpTempo = _cursor.getInt(_cursorIndexOfTempo);
            final String _tmpKeyNote;
            _tmpKeyNote = _cursor.getString(_cursorIndexOfKeyNote);
            final String _tmpKeyMode;
            _tmpKeyMode = _cursor.getString(_cursorIndexOfKeyMode);
            final int _tmpTimeSignatureNumerator;
            _tmpTimeSignatureNumerator = _cursor.getInt(_cursorIndexOfTimeSignatureNumerator);
            final int _tmpTimeSignatureDenominator;
            _tmpTimeSignatureDenominator = _cursor.getInt(_cursorIndexOfTimeSignatureDenominator);
            final String _tmpPhrasesJson;
            _tmpPhrasesJson = _cursor.getString(_cursorIndexOfPhrasesJson);
            final String _tmpHighlightedMeasures;
            _tmpHighlightedMeasures = _cursor.getString(_cursorIndexOfHighlightedMeasures);
            final String _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getString(_cursorIndexOfCreatedAt);
            final String _tmpLastPlayedAt;
            _tmpLastPlayedAt = _cursor.getString(_cursorIndexOfLastPlayedAt);
            final String _tmpMasteredPhrases;
            _tmpMasteredPhrases = _cursor.getString(_cursorIndexOfMasteredPhrases);
            _result = new SongEntity(_tmpId,_tmpTitle,_tmpArtist,_tmpTempo,_tmpKeyNote,_tmpKeyMode,_tmpTimeSignatureNumerator,_tmpTimeSignatureDenominator,_tmpPhrasesJson,_tmpHighlightedMeasures,_tmpCreatedAt,_tmpLastPlayedAt,_tmpMasteredPhrases);
          } else {
            _result = null;
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @NonNull
  public static List<Class<?>> getRequiredConverters() {
    return Collections.emptyList();
  }
}
