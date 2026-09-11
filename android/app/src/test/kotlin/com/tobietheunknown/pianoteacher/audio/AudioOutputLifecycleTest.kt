package com.tobietheunknown.pianoteacher.audio

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class AudioOutputLifecycleTest {
    private class ManualExecutor : Executor {
        val tasks = ArrayDeque<Runnable>()
        override fun execute(command: Runnable) { tasks.addLast(command) }
        fun next() = tasks.removeFirst().run()
        fun drain() { while (tasks.isNotEmpty()) next() }
    }

    @Test(timeout = 4000) fun `blocked hardware close never blocks interrupt or holds voice lock`() = runBlocking {
        val executor = Executors.newSingleThreadExecutor()
        val closeEntered = CountDownLatch(1)
        val allowClose = CountDownLatch(1)
        val lock = Any()
        var silenced = false
        val controller = AudioSessionController(
            lock = lock, requestFocus = { true }, abandonFocus = {},
            openOutput = { assertFalse(Thread.holdsLock(lock)); true },
            silenceOutput = { silenced = true },
            closeOutput = {
                assertFalse(Thread.holdsLock(lock))
                closeEntered.countDown()
                check(allowClose.await(2, TimeUnit.SECONDS))
            }, executor = executor,
        )
        try {
            controller.setForeground(true)
            val session = controller.beginPlayback()
            controller.interrupt() // Must return before allowClose is released.
            assertTrue(silenced)
            assertFalse(controller.isActive(session))
            assertTrue(closeEntered.await(1, TimeUnit.SECONDS))
            synchronized(lock) { assertFalse(controller.isActive(session)) }
        } finally {
            allowClose.countDown()
            executor.shutdownNow()
        }
    }

    @Test fun `stop then start waits behind old close and late route notification preserves new owner`() = runBlocking {
        val executor = ManualExecutor()
        val events = mutableListOf<String>()
        var revision = 0L
        val controller = AudioSessionController(
            requestFocus = { true }, abandonFocus = {},
            openOutput = { events += "open"; true },
            silenceOutput = { events += "silence" }, closeOutput = { events += "close" },
            outputRevision = { revision }, executor = executor,
        )
        controller.setForeground(true)
        val first = async(start = CoroutineStart.UNDISPATCHED) { controller.beginPlayback() }
        executor.next()
        val old = first.await()
        revision++
        controller.reconcileOutput()
        val second = async(start = CoroutineStart.UNDISPATCHED) { controller.beginPlayback() }
        assertFalse(second.isCompleted)
        executor.next() // Old close finishes before replacement open can run.
        assertEquals(listOf("open", "silence", "close"), events)
        assertFalse(second.isCompleted)
        executor.next()
        val fresh = second.await()
        assertTrue(fresh > 0)
        assertFalse(controller.reconcileOutput())
        executor.drain()
        assertFalse(controller.isActive(old))
        assertTrue(controller.isActive(fresh))
        assertEquals(listOf("open", "silence", "close", "open"), events)
    }

    @Test fun `background during opening rejects completion and closes its output`() = runBlocking {
        val executor = ManualExecutor()
        lateinit var controller: AudioSessionController
        var closed = 0
        controller = AudioSessionController(
            requestFocus = { true }, abandonFocus = {},
            openOutput = { controller.setForeground(false); true },
            silenceOutput = {}, closeOutput = { closed++ }, executor = executor,
        )
        controller.setForeground(true)
        val pending = async(start = CoroutineStart.UNDISPATCHED) { controller.beginPlayback() }
        executor.next()
        assertEquals(0L, pending.await())
        executor.drain()
        assertEquals(1, closed)
    }

    @Test fun `released pending midi handle never sounds after output becomes available`() = runBlocking {
        val executor = ManualExecutor()
        val midi = MidiVoiceRegistry()
        val controller = AudioSessionController(
            requestFocus = { true }, abandonFocus = {}, openOutput = { true },
            silenceOutput = { midi.clear() }, closeOutput = {}, executor = executor,
        )
        controller.setForeground(true)
        midi.reserve(60, 7L)
        var emitted = 0
        val pending = async(start = CoroutineStart.UNDISPATCHED) {
            val ticket = controller.prepare(explicit = true)
            if (midi.activate(7L) && ticket != null) {
                controller.withPrepared(ticket, Unit) { emitted++; Unit }
            }
        }
        assertTrue(midi.release(60)!!.pending)
        executor.next()
        pending.await()
        assertEquals(0, emitted)
        assertNull(midi.release(60))
        // Same pitch re-attacked while warm gets a distinct, immediately usable handle.
        midi.reserve(60, 8L)
        val ticket = controller.prepare(explicit = true)!!
        assertTrue(midi.activate(8L))
        controller.withPrepared(ticket, Unit) { emitted++; Unit }
        assertEquals(1, emitted)
        assertEquals(8L, midi.release(60)!!.id)
    }

    @Test fun `queued obsolete opening is skipped before replacement opening`() = runBlocking {
        val executor = ManualExecutor()
        val output = SerialAudioOutput(executor, { true }, {})
        val first = output.open()
        output.close()
        val fresh = output.open()
        assertFalse(first.await())
        executor.drain()
        assertTrue(fresh.await())
        assertTrue(output.isReady())
    }

    @Test fun `cancelled preparation releases its interest and old ticket cannot emit later`() = runBlocking {
        val executor = ManualExecutor()
        var abandoned = 0
        val controller = AudioSessionController(
            requestFocus = { true }, abandonFocus = { abandoned++ }, openOutput = { true },
            silenceOutput = {}, closeOutput = {}, executor = executor,
        )
        controller.setForeground(true)
        val cancelled = async(start = CoroutineStart.UNDISPATCHED) { controller.beginPlayback() }
        cancelled.cancelAndJoin()
        controller.releaseIfIdle(false)
        assertEquals(1, abandoned)
        executor.drain()
        val opening = async(start = CoroutineStart.UNDISPATCHED) { controller.prepare(explicit = true)!! }
        executor.drain()
        val old = opening.await()
        controller.interrupt()
        val fresh = async(start = CoroutineStart.UNDISPATCHED) { controller.beginPlayback() }
        executor.drain()
        assertTrue(fresh.await() > 0)
        var emitted = false
        controller.withPrepared(old, Unit) { emitted = true }
        assertFalse(emitted)
    }

    @Test fun `equal pitches keep separate pending and sounding ownership`() {
        val midi = MidiVoiceRegistry()
        midi.reserve(60, 1L)
        midi.reserve(60, 2L)
        assertTrue(midi.activate(1L))
        assertEquals(MidiVoiceRegistry.Released(1L, false), midi.release(60))
        assertEquals(MidiVoiceRegistry.Released(2L, true), midi.release(60))
        assertFalse(midi.activate(2L))
        midi.reserve(60, 3L)
        midi.cancel(2L)
        assertTrue(midi.activate(3L))
        midi.clear()
        assertNull(midi.release(60))
        assertFalse(midi.hasPending())
    }
}
