package com.tobietheunknown.pianoteacher.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.audio.MetronomeEngine
import com.tobietheunknown.pianoteacher.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    vm: SettingsViewModel = viewModel(
        factory = SettingsViewModel.Factory(LocalContext.current)
    )
) {
    val context = LocalContext.current
    val prefs by vm.prefs.collectAsState()
    var versionTapCount by remember { mutableIntStateOf(0) }
    var selectedTheme by remember { mutableStateOf(ThemePrefs.getTheme(context)) }
    var metronomeVolume by remember { mutableIntStateOf(ThemePrefs.getMetronomeVolume(context)) }
    val previewMetronome = remember { MetronomeEngine() }

    Scaffold(
        containerColor = Background,
        topBar = {
            TopAppBar(
                title = { Text("Réglages", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Surface)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Theme picker
            SettingsSection(title = "Thème") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ThemeCard(
                        label = "Sombre",
                        colors = DarkTheme,
                        selected = selectedTheme == AppTheme.DARK,
                        onClick = {
                            selectedTheme = AppTheme.DARK
                            ThemePrefs.setTheme(context, AppTheme.DARK)
                        },
                        modifier = Modifier.weight(1f)
                    )
                    ThemeCard(
                        label = "Midnight",
                        colors = MidnightBlueTheme,
                        selected = selectedTheme == AppTheme.MIDNIGHT_BLUE,
                        onClick = {
                            selectedTheme = AppTheme.MIDNIGHT_BLUE
                            ThemePrefs.setTheme(context, AppTheme.MIDNIGHT_BLUE)
                        },
                        modifier = Modifier.weight(1f)
                    )
                    ThemeCard(
                        label = "Pastel",
                        colors = PastelCozyTheme,
                        selected = selectedTheme == AppTheme.PASTEL_COZY,
                        onClick = {
                            selectedTheme = AppTheme.PASTEL_COZY
                            ThemePrefs.setTheme(context, AppTheme.PASTEL_COZY)
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
                Text(
                    "Redémarre l'app pour appliquer le thème",
                    fontSize = 11.sp,
                    color = Color(0xFF475569),
                    modifier = Modifier.padding(horizontal = 16.dp, bottom = 12.dp)
                )
            }

            // Audio section
            SettingsSection(title = "Audio") {
                ToggleSetting(
                    label = "Son activé",
                    subtitle = "Joue les samples Salamander via Oboe",
                    icon = Icons.AutoMirrored.Filled.VolumeUp,
                    checked = prefs.audioEnabled,
                    onToggle = vm::setAudioEnabled
                )
            }

            // Metronome volume
            SettingsSection(title = "Métronome") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.MusicNote, null, tint = Color(0xFF64748B), modifier = Modifier.size(20.dp))
                    Text("Volume", color = Color.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    listOf("Bas" to 0, "Moyen" to 1, "Fort" to 2).forEach { (label, level) ->
                        val isSelected = metronomeVolume == level
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (isSelected) IndigoAccent.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.06f))
                                .then(
                                    if (isSelected) Modifier.border(1.dp, IndigoAccent, RoundedCornerShape(6.dp))
                                    else Modifier
                                )
                                .clickable {
                                    metronomeVolume = level
                                    ThemePrefs.setMetronomeVolume(context, level)
                                    previewMetronome.setVolume(level)
                                    previewMetronome.playClick(true)
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                label,
                                fontSize = 12.sp,
                                color = if (isSelected) IndigoAccent else Color(0xFF64748B),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // MIDI section
            SettingsSection(title = "MIDI") {
                ToggleSetting(
                    label = "MIDI Bluetooth",
                    subtitle = "Connexion BLE MIDI (plus de batterie)",
                    icon = Icons.Default.Bluetooth,
                    checked = prefs.bleMidiEnabled,
                    onToggle = vm::setBleMidiEnabled
                )
                ToggleSetting(
                    label = "MIDI USB",
                    subtitle = "Connexion via câble USB OTG",
                    icon = Icons.Default.Usb,
                    checked = prefs.usbMidiEnabled,
                    onToggle = vm::setUsbMidiEnabled
                )
            }

            // Synthesia section
            SettingsSection(title = "Synthesia") {
                ToggleSetting(
                    label = "Couleurs MG/MD",
                    subtitle = "Cyan = main droite, Rose = main gauche",
                    icon = Icons.Default.Palette,
                    checked = prefs.handColorsEnabled,
                    onToggle = vm::setHandColorsEnabled
                )
                ToggleSetting(
                    label = "Touches attendues",
                    subtitle = "Surligne les prochaines touches à jouer",
                    icon = Icons.Default.MusicNote,
                    checked = prefs.showExpectedKeys,
                    onToggle = vm::setShowExpectedKeys
                )
            }

            // Hidden Gemini section (visible only after Easter egg unlock)
            if (prefs.geminiEnabled) {
                SettingsSection(title = "🤖 Gemini Nano (expérimental)") {
                    ToggleSetting(
                        label = "Feedback intelligent",
                        subtitle = "Analyse on-device tes performances",
                        icon = Icons.Default.Stars,
                        checked = prefs.geminiEnabled,
                        onToggle = vm::setGeminiEnabled
                    )
                }
            }

            Spacer(Modifier.height(32.dp))

            // Version (Easter egg: tap 7x to unlock Gemini)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SurfaceVariant)
                    .clickable {
                        versionTapCount++
                        if (versionTapCount >= 7 && !prefs.geminiEnabled) {
                            vm.setGeminiEnabled(true)
                        }
                    }
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Piano Teacher v2.0.0", color = Color(0xFF475569), fontSize = 13.sp)
                    if (versionTapCount in 1..6) {
                        Text(
                            "${7 - versionTapCount} tap(s) restants…",
                            color = Color(0xFF334155),
                            fontSize = 11.sp
                        )
                    }
                    if (prefs.geminiEnabled) {
                        Text("✨ Mode développeur actif", color = IndigoAccent, fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceVariant)
    ) {
        Text(
            title,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF64748B),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
        HorizontalDivider(color = Color.White.copy(alpha = 0.05f))
        content()
    }
}

@Composable
private fun ThemeCard(
    label: String,
    colors: ThemeColors,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(colors.background)
            .then(
                if (selected) Modifier.border(2.dp, colors.accent, RoundedCornerShape(10.dp))
                else Modifier.border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
            )
            .clickable(onClick = onClick)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(colors.melodyColor)
            )
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(colors.chordsColor)
            )
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(colors.accent)
            )
        }
        Text(
            label,
            fontSize = 11.sp,
            color = if (selected) colors.accent else Color(0xFF94A3B8),
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun ToggleSetting(
    label: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    checked: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(icon, null, tint = Color(0xFF64748B), modifier = Modifier.size(20.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, color = Color.White, fontSize = 14.sp)
            Text(subtitle, color = Color(0xFF64748B), fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = IndigoAccent
            )
        )
    }
}
