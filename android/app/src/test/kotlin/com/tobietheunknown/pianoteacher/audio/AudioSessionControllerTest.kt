package com.tobietheunknown.pianoteacher.audio

import org.junit.Assert.*
import org.junit.Test

class AudioSessionControllerTest {
    private class Fixture {
        val events = mutableListOf<String>()
        var grantFocus = true
        var canOpen = true
        var outputRevision = 0L
        var onOpen: () -> Unit = {}
        val controller = AudioSessionController(
            requestFocus = { events += "request"; grantFocus },
            abandonFocus = { events += "abandon" },
            openOutput = { events += "open"; onOpen(); canOpen },
            silenceAndCloseOutput = { events += "silence-close" },
            outputRevision = { outputRevision },
        )
    }

    @Test fun `opening and returning to app never claims focus without playback`() {
        val f = Fixture()
        f.controller.setForeground(true)
        assertTrue(f.events.isEmpty())
        f.controller.setForeground(false)
        f.controller.setForeground(true)
        assertEquals(listOf("silence-close"), f.events)
    }

    @Test fun `focus loss invalidates old transport and explicit play recovers output`() {
        val f = Fixture()
        f.controller.setForeground(true)
        val first = f.controller.beginPlayback()
        assertTrue(f.controller.isActive(first))
        f.controller.interrupt()
        assertFalse(f.controller.isActive(first))
        assertFalse(f.controller.prepareOutput()) // Old scheduled notes cannot steal focus back.
        val second = f.controller.beginPlayback()
        assertTrue(second != first)
        assertTrue(f.controller.isActive(second))
        assertFalse(f.controller.isActive(first))
        f.controller.endPlayback(first) // Late cancellation must not release the new owner.
        f.controller.releaseIfIdle(false)
        assertTrue(f.controller.isActive(second))
        assertEquals(listOf("request", "open", "silence-close", "abandon", "request", "open"), f.events)
    }

    @Test fun `background prevents playback until foreground and a fresh user action`() {
        val f = Fixture()
        f.controller.setForeground(true)
        val first = f.controller.beginPlayback()
        f.controller.setForeground(false)
        assertFalse(f.controller.isActive(first))
        assertEquals(0L, f.controller.beginPlayback())
        f.controller.setForeground(true)
        assertFalse(f.controller.isActive(first))
        assertTrue(f.controller.beginPlayback() > 0)
    }

    @Test fun `denied focus does not open output and can retry later`() {
        val f = Fixture()
        f.controller.setForeground(true)
        f.grantFocus = false
        assertEquals(0L, f.controller.beginPlayback())
        assertEquals(listOf("request"), f.events)
        f.grantFocus = true
        assertTrue(f.controller.beginPlayback() > 0)
    }

    @Test fun `failed output relinquishes focus and a later retry succeeds`() {
        val f = Fixture()
        f.controller.setForeground(true)
        f.canOpen = false
        assertEquals(0L, f.controller.beginPlayback())
        assertEquals(listOf("request", "open", "silence-close", "abandon"), f.events)
        f.canOpen = true
        assertTrue(f.controller.beginPlayback() > 0)
    }

    @Test fun `idle release waits for both transport and midi voices`() {
        val f = Fixture()
        f.controller.setForeground(true)
        val session = f.controller.beginPlayback()
        f.controller.releaseIfIdle(false)
        assertTrue(f.controller.isActive(session))
        f.controller.endPlayback(session)
        f.controller.releaseIfIdle(true)
        assertFalse("abandon" in f.events)
        f.controller.releaseIfIdle(false)
        assertEquals("abandon", f.events.last())
        assertTrue(f.controller.prepareOutput())
    }

    @Test fun `route notification immediately invalidates session without transport polling`() {
        val f = Fixture()
        f.controller.setForeground(true)
        val first = f.controller.beginPlayback()
        f.outputRevision++
        assertTrue(f.controller.reconcileOutput())
        assertEquals(listOf("silence-close", "abandon"), f.events.takeLast(2))
        assertFalse(f.controller.isActive(first))
        assertFalse(f.controller.prepareOutput())
    }

    @Test fun `midi reopen before route notification clears handles and cannot revive old session`() {
        var revision = 0L
        val handles = mutableSetOf(11L)
        var clears = 0
        val controller = AudioSessionController(
            requestFocus = { true }, abandonFocus = {}, openOutput = { true },
            silenceAndCloseOutput = { handles.clear(); clears++ },
            outputRevision = { revision },
        )
        controller.setForeground(true)
        val old = controller.beginPlayback()
        revision++ // Native output closed; JNI notification has not acquired the Kotlin lock yet.
        assertTrue(controller.prepareOutput(explicit = true)) // MIDI note arrives first.
        assertTrue(handles.isEmpty())
        handles.add(22L)
        val fresh = controller.beginPlayback()
        assertFalse(controller.reconcileOutput()) // Delayed notification must be harmless.
        assertEquals(setOf(22L), handles)
        assertEquals(1, clears)
        assertFalse(controller.isActive(old))
        assertTrue(controller.isActive(fresh))
    }

    @Test fun `route interruption during opening does not issue a usable session`() {
        val f = Fixture()
        f.controller.setForeground(true)
        f.onOpen = { f.outputRevision++ }
        assertEquals(0L, f.controller.beginPlayback())
        assertEquals(listOf("silence-close", "abandon"), f.events.takeLast(2))
        f.onOpen = {}
        assertTrue(f.controller.beginPlayback() > 0)
    }

    @Test fun `old attack and click are rejected after check then interruption and reacquisition`() {
        val f = Fixture()
        f.controller.setForeground(true)
        val old = f.controller.beginPlayback()
        assertTrue(f.controller.isActive(old)) // Transport check before it is suspended.
        f.controller.interrupt()
        val fresh = f.controller.beginPlayback()
        val emitted = mutableListOf<String>()
        assertEquals(0L, f.controller.withPlayback(old, 0L) { emitted += "old-note"; 1L })
        f.controller.withPlayback(old, Unit) { emitted += "old-click" }
        assertEquals(2L, f.controller.withPlayback(fresh, 0L) { emitted += "fresh-note"; 2L })
        f.controller.withPlayback(fresh, Unit) { emitted += "fresh-click" }
        assertEquals(listOf("fresh-note", "fresh-click"), emitted)
    }
}
