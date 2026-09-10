package com.tobietheunknown.pianoteacher.utils

import com.tobietheunknown.pianoteacher.data.model.Song
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch

/** One writer preserves edit order even when persistence suspends on the IO dispatcher. */
class OrderedSongSaver(scope: CoroutineScope, save: suspend (Song) -> Unit) {
    private val pending = Channel<Song>(Channel.UNLIMITED)

    init {
        scope.launch {
            try {
                for (song in pending) save(song)
            } finally {
                pending.cancel()
            }
        }
    }

    fun enqueue(song: Song) {
        pending.trySend(song).getOrThrow()
    }
}
