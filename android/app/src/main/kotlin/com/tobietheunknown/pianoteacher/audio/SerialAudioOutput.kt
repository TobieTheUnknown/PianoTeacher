package com.tobietheunknown.pianoteacher.audio

import java.util.concurrent.Executor
import java.util.concurrent.Executors
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred

internal val audioOutputExecutor: Executor = Executors.newSingleThreadExecutor { task ->
    Thread(task, "PianoOutputLifecycle").apply { isDaemon = true }
}

/** A serial executor owns blocking device operations; neither operation holds a Kotlin state lock. */
class SerialAudioOutput(
    private val executor: Executor,
    private val openDevice: () -> Boolean,
    private val closeDevice: () -> Unit,
) {
    private val lock = Any()
    private var generation = 0L
    private var ready = false
    private var opening: CompletableDeferred<Boolean>? = null

    fun isReady(): Boolean = synchronized(lock) { ready }

    fun open(): Deferred<Boolean> = synchronized(lock) {
        if (ready) return@synchronized CompletableDeferred(true)
        opening?.let { return@synchronized it }
        val result = CompletableDeferred<Boolean>()
        val requestedGeneration = generation
        opening = result
        // Submission is serialized with close. The injected executor must queue serially.
        executor.execute {
            val current = synchronized(lock) { generation == requestedGeneration && opening === result }
            val success = current && runCatching(openDevice).getOrDefault(false)
            val accepted = synchronized(lock) {
                if (generation != requestedGeneration || opening !== result) false
                else {
                    ready = success
                    opening = null
                    success
                }
            }
            // Resuming an unconfined waiter may enter session code: never do it under lock.
            result.complete(accepted)
        }
        result
    }

    fun close() {
        val pending = synchronized(lock) {
            generation++
            ready = false
            val previous = opening
            opening = null
            // An in-flight open finishes, then this close, then any new open. A stale
            // close therefore cannot close a replacement stream, regardless of delays.
            executor.execute { runCatching(closeDevice) }
            previous
        }
        pending?.complete(false)
    }
}
