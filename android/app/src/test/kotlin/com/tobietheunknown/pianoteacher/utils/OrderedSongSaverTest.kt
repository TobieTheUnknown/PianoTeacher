package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.Song
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class OrderedSongSaverTest {
    @Test fun `rapid edits cannot persist an older song after the latest edit`() = runBlocking {
        val scope = CoroutineScope(coroutineContext + Job())
        val firstStarted = CompletableDeferred<Unit>()
        val releaseFirst = CompletableDeferred<Unit>()
        val allSaved = CompletableDeferred<Unit>()
        val titles = mutableListOf<String>()
        val saver = OrderedSongSaver(scope) { song ->
            if (song.title == "split") {
                firstStarted.complete(Unit)
                releaseFirst.await()
            }
            titles += song.title
            if (song.title == "merge") allSaved.complete(Unit)
        }
        try {
            saver.enqueue(Song("s", "split"))
            firstStarted.await()
            saver.enqueue(Song("s", "rename"))
            saver.enqueue(Song("s", "merge"))
            yield()
            assertTrue(titles.isEmpty())
            releaseFirst.complete(Unit)
            withTimeout(2000) { allSaved.await() }
            assertEquals(listOf("split", "rename", "merge"), titles)
        } finally {
            scope.cancel()
        }
    }
}
