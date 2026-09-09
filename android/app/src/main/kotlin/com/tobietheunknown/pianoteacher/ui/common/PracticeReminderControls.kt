package com.tobietheunknown.pianoteacher.ui.common

import android.Manifest
import android.app.TimePickerDialog
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.tobietheunknown.pianoteacher.reminders.PracticeReminderSettings
import com.tobietheunknown.pianoteacher.reminders.PracticeReminders
import com.tobietheunknown.pianoteacher.ui.theme.IndigoAccent
import com.tobietheunknown.pianoteacher.ui.theme.TextPrimary
import com.tobietheunknown.pianoteacher.ui.theme.TextSecondary
import com.tobietheunknown.pianoteacher.ui.theme.TextTertiary
import java.time.DayOfWeek

private val DAY_LABELS = listOf(
    DayOfWeek.MONDAY to "L",
    DayOfWeek.TUESDAY to "Ma",
    DayOfWeek.WEDNESDAY to "Me",
    DayOfWeek.THURSDAY to "J",
    DayOfWeek.FRIDAY to "V",
    DayOfWeek.SATURDAY to "S",
    DayOfWeek.SUNDAY to "D",
)

@Composable
fun PracticeReminderControls(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var settings by remember { mutableStateOf(PracticeReminders.load(context)) }
    var permissionDenied by remember { mutableStateOf(false) }
    var pendingEnable by remember { mutableStateOf<PracticeReminderSettings?>(null) }

    fun persist(next: PracticeReminderSettings) {
        settings = next
        PracticeReminders.save(context, next)
    }

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val pending = pendingEnable
        pendingEnable = null
        permissionDenied = !granted
        if (granted && pending != null) persist(pending)
    }

    fun requestEnabled(enabled: Boolean) {
        val next = settings.copy(enabled = enabled)
        if (enabled && Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingEnable = next
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            permissionDenied = false
            persist(next)
        }
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.NotificationsActive, null, tint = IndigoAccent, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Rappel de pratique", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                Text("Une notification locale aux jours choisis", color = TextTertiary, fontSize = 12.sp)
            }
            Switch(checked = settings.enabled, onCheckedChange = ::requestEnabled)
        }

        Text("JOURS", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            DAY_LABELS.forEach { (day, label) ->
                val selected = day in settings.daysOfWeek
                FilterChip(
                    selected = selected,
                    onClick = {
                        val days = if (selected) settings.daysOfWeek - day else settings.daysOfWeek + day
                        persist(settings.copy(daysOfWeek = days))
                    },
                    label = { Text(label) },
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = {
                    TimePickerDialog(
                        context,
                        { _, hour, minute -> persist(settings.copy(hour = hour, minute = minute)) },
                        settings.hour,
                        settings.minute,
                        true,
                    ).show()
                },
                modifier = Modifier.weight(1f),
            ) {
                Icon(Icons.Default.AccessTime, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(7.dp))
                Text("%02d:%02d".format(settings.hour, settings.minute))
            }
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { persist(settings.copy(durationMinutes = (settings.durationMinutes - 5).coerceAtLeast(5))) }) {
                    Text("−", fontSize = 20.sp)
                }
                Text(
                    "${settings.durationMinutes} min",
                    color = TextSecondary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                IconButton(onClick = { persist(settings.copy(durationMinutes = (settings.durationMinutes + 5).coerceAtMost(180))) }) {
                    Text("+", fontSize = 20.sp)
                }
            }
        }

        if (settings.enabled && settings.daysOfWeek.isEmpty()) {
            Text("Choisissez au moins un jour pour programmer le rappel.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        }
        if (permissionDenied) {
            Text("Autorisez les notifications pour activer ce rappel.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        }
    }
}
