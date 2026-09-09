package com.tobietheunknown.pianoteacher.reminders

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

data class PracticeReminderSettings(
    val enabled: Boolean = false,
    val daysOfWeek: Set<DayOfWeek> = setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY),
    val hour: Int = 18,
    val minute: Int = 0,
    val durationMinutes: Int = 15,
) {
    init {
        require(hour in 0..23)
        require(minute in 0..59)
        require(durationMinutes in 1..1440)
    }
}

/**
 * One reminder per selected local date, strictly after [after]. On a spring clock change,
 * a missing local time shifts forward by the gap; on an autumn change the first offset wins.
 * Calculating calendar dates rather than adding 24 hours keeps the requested local hour.
 */
fun nextPracticeReminder(
    settings: PracticeReminderSettings,
    after: Instant,
    zone: ZoneId,
): Instant? {
    if (!settings.enabled || settings.daysOfWeek.isEmpty()) return null
    val today = after.atZone(zone).toLocalDate()
    val time = LocalTime.of(settings.hour, settings.minute)
    return (0L..7L).asSequence()
        .map { today.plusDays(it) }
        .filter { it.dayOfWeek in settings.daysOfWeek }
        .map { it.atTime(time).atZone(zone).toInstant() }
        .firstOrNull { it.isAfter(after) }
}
