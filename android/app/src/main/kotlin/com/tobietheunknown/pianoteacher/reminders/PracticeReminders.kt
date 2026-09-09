package com.tobietheunknown.pianoteacher.reminders

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.tobietheunknown.pianoteacher.MainActivity
import com.tobietheunknown.pianoteacher.R
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId

/** Persistent local reminders; no server or exact-alarm permission is required. */
object PracticeReminders {
    private const val PREFS = "practice_reminders"
    private const val CHANNEL = "practice"
    private const val REQUEST_CODE = 1701
    private const val NOTIFICATION_ID = 1701
    private const val KEY_SCHEDULED = "scheduled_at"
    internal const val ACTION_REMIND = "com.tobietheunknown.pianoteacher.PRACTICE_REMINDER"
    internal const val EXTRA_SCHEDULED = "scheduled_at"

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun load(context: Context): PracticeReminderSettings {
        val prefs = preferences(context)
        val defaults = PracticeReminderSettings()
        val days = prefs.getStringSet("days", null)?.mapNotNull { value ->
            value.toIntOrNull()?.takeIf { it in 1..7 }?.let(DayOfWeek::of)
        }?.toSet() ?: defaults.daysOfWeek
        return PracticeReminderSettings(
            enabled = prefs.getBoolean("enabled", false),
            daysOfWeek = days,
            hour = prefs.getInt("hour", defaults.hour).coerceIn(0, 23),
            minute = prefs.getInt("minute", defaults.minute).coerceIn(0, 59),
            durationMinutes = prefs.getInt("duration", defaults.durationMinutes).coerceIn(1, 1440),
        )
    }

    /** UI requests POST_NOTIFICATIONS before enabling on Android 13+. */
    fun save(context: Context, settings: PracticeReminderSettings) {
        preferences(context).edit()
            .putBoolean("enabled", settings.enabled)
            .putStringSet("days", settings.daysOfWeek.map { it.value.toString() }.toSet())
            .putInt("hour", settings.hour)
            .putInt("minute", settings.minute)
            .putInt("duration", settings.durationMinutes)
            .apply()
        reschedule(context)
        if (!settings.enabled) NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    fun notificationsAllowed(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) return false
        val manager = context.getSystemService(NotificationManager::class.java)
        return NotificationManagerCompat.from(context).areNotificationsEnabled() &&
            manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
    }

    /** Also call on app start / return from notification settings to restore the pending alarm. */
    fun reschedule(context: Context) {
        createChannel(context)
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        val next = nextPracticeReminder(load(context), Instant.now(), ZoneId.systemDefault())
        val operation = alarmIntent(context, next?.toEpochMilli() ?: 0L)
        alarmManager.cancel(operation)
        // Commit before scheduling: the receiver can run in a newly created process.
        preferences(context).edit().putLong(KEY_SCHEDULED, next?.toEpochMilli() ?: 0L).commit()
        if (next != null) {
            // Inexact by design: Android may defer delivery to save battery, including in Doze.
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.toEpochMilli(), operation)
        }
    }

    private fun alarmIntent(context: Context, at: Long): PendingIntent = PendingIntent.getBroadcast(
        context, REQUEST_CODE,
        Intent(context, PracticeReminderReceiver::class.java)
            .setAction(ACTION_REMIND).putExtra(EXTRA_SCHEDULED, at),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    internal fun deliver(context: Context, intent: Intent) {
        val prefs = preferences(context)
        val at = intent.getLongExtra(EXTRA_SCHEDULED, 0L)
        if (at <= 0L || at != prefs.getLong(KEY_SCHEDULED, 0L)) return
        val settings = load(context)
        // Consume and plan first, so denied notifications never break the recurring schedule.
        reschedule(context)
        if (!settings.enabled || settings.daysOfWeek.isEmpty() || !notificationsAllowed(context)) return
        // A delayed alarm should not prompt a practice session on an unrelated day after a restart.
        if (Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalDate() !=
            Instant.now().atZone(ZoneId.systemDefault()).toLocalDate()
        ) return
        val openApp = PendingIntent.getActivity(
            context, REQUEST_CODE,
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val message = "Prenez ${settings.durationMinutes} min pour jouer une phrase et progresser à votre rythme."
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_practice_notification)
            .setContentTitle("Un peu de piano ?")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Permission may have been revoked between the check and delivery.
        }
    }

    private fun createChannel(context: Context) {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, "Rappels de pratique", NotificationManager.IMPORTANCE_DEFAULT)
                .apply { description = "Vos séances de piano aux jours et à l’heure choisis." },
        )
    }
}

class PracticeReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == PracticeReminders.ACTION_REMIND) PracticeReminders.deliver(context, intent)
    }
}

class PracticeReminderRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED ->
                PracticeReminders.reschedule(context)
        }
    }
}
