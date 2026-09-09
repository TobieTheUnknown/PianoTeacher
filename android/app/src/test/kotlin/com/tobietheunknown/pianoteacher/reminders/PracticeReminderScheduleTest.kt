package com.tobietheunknown.pianoteacher.reminders

import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PracticeReminderScheduleTest {
    private val paris = ZoneId.of("Europe/Paris")
    private val monday = PracticeReminderSettings(enabled = true, daysOfWeek = setOf(DayOfWeek.MONDAY))

    @Test fun `disabled and empty selection do not schedule`() {
        val now = Instant.parse("2026-09-07T10:00:00Z")
        assertNull(nextPracticeReminder(monday.copy(enabled = false), now, paris))
        assertNull(nextPracticeReminder(monday.copy(daysOfWeek = emptySet()), now, paris))
    }

    @Test fun `today is selected if requested hour is still ahead`() {
        assertEquals(Instant.parse("2026-09-07T16:00:00Z"),
            nextPracticeReminder(monday, Instant.parse("2026-09-07T10:00:00Z"), paris))
    }

    @Test fun `at exact trigger time next occurrence is next week`() {
        assertEquals(Instant.parse("2026-09-14T16:00:00Z"),
            nextPracticeReminder(monday, Instant.parse("2026-09-07T16:00:00Z"), paris))
    }

    @Test fun `multiple selected days pick earliest after now and preserve minutes`() {
        val settings = monday.copy(daysOfWeek = setOf(DayOfWeek.FRIDAY, DayOfWeek.WEDNESDAY, DayOfWeek.MONDAY), minute = 25)
        assertEquals(Instant.parse("2026-09-09T16:25:00Z"),
            nextPracticeReminder(settings, Instant.parse("2026-09-07T17:00:00Z"), paris))
    }

    @Test fun `sunday rolls into following monday`() {
        assertEquals(Instant.parse("2026-09-14T16:00:00Z"),
            nextPracticeReminder(monday, Instant.parse("2026-09-13T21:00:00Z"), paris))
    }

    @Test fun `spring missing local time shifts through gap`() {
        val settings = monday.copy(daysOfWeek = setOf(DayOfWeek.SUNDAY), hour = 2, minute = 30)
        assertEquals(Instant.parse("2026-03-29T01:30:00Z"),
            nextPracticeReminder(settings, Instant.parse("2026-03-28T12:00:00Z"), paris))
    }

    @Test fun `autumn repeated hour fires only once on that local date`() {
        val settings = monday.copy(daysOfWeek = setOf(DayOfWeek.SUNDAY), hour = 2, minute = 30)
        assertEquals(Instant.parse("2026-10-25T00:30:00Z"),
            nextPracticeReminder(settings, Instant.parse("2026-10-24T12:00:00Z"), paris))
        assertEquals(Instant.parse("2026-11-01T01:30:00Z"),
            nextPracticeReminder(settings, Instant.parse("2026-10-25T00:45:00Z"), paris))
    }

    @Test fun `timezone change keeps configured local hour`() {
        val now = Instant.parse("2026-09-07T10:00:00Z")
        assertEquals(Instant.parse("2026-09-07T22:00:00Z"),
            nextPracticeReminder(monday, now, ZoneId.of("America/New_York")))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `invalid time is rejected`() { monday.copy(hour = 24) }

    @Test(expected = IllegalArgumentException::class)
    fun `zero duration is rejected`() { monday.copy(durationMinutes = 0) }
}
