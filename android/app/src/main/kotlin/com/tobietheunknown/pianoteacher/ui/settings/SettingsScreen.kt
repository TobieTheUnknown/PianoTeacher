package com.tobietheunknown.pianoteacher.ui.settings

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tobietheunknown.pianoteacher.audio.AudioEngine
import com.tobietheunknown.pianoteacher.audio.MetronomeEngine
import com.tobietheunknown.pianoteacher.ui.theme.*
import com.tobietheunknown.pianoteacher.ui.onboarding.ExperienceLevel
import com.tobietheunknown.pianoteacher.ui.onboarding.OnboardingPreferences
import com.tobietheunknown.pianoteacher.ui.onboarding.PracticeGoal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onReviewIntro: () -> Unit,
    vm: SettingsViewModel = viewModel(
        factory = SettingsViewModel.Factory(LocalContext.current)
    )
) {
    val context = LocalContext.current
    val prefs by vm.prefs.collectAsState()
    val midiManager = remember { com.tobietheunknown.pianoteacher.midi.MidiManager.getInstance(context) }
    val blePermissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        val enabled = grants.values.all { it }
        vm.setBleMidiEnabled(enabled)
        if (enabled) midiManager.startBleScanning()
    }
    var selectedTheme by remember { mutableStateOf(ThemePrefs.getTheme(context)) }
    var metronomeVolume by remember { mutableIntStateOf(ThemePrefs.getMetronomeVolume(context)) }
    val previewMetronome = remember { MetronomeEngine() }
    val audioEngine = remember { AudioEngine.getInstance(context) }
    var releaseLevel by remember { mutableIntStateOf(ThemePrefs.getReleaseLevel(context)) }
    val midiDeviceName by com.tobietheunknown.pianoteacher.midi.MidiManager.getInstance(context).deviceName.collectAsState()
    val learnerProfile = OnboardingPreferences.profile(context)

    Scaffold(
        containerColor = Background,
        topBar = {
            TopAppBar(
                title = { Text("Réglages", color = TextPrimary, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        }
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
        Column(
            modifier = Modifier
                .fillMaxHeight()
                .widthIn(max = 860.dp)
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = if (maxWidth >= 720.dp) 28.dp else 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            StudioProfileCard(
                goal = learnerProfile.goal,
                experience = learnerProfile.experience,
                wantsMidi = learnerProfile.wantsMidi,
                onReviewIntro = onReviewIntro,
            )

            // Apparence — design picker (mirrors web's DesignAppearance section)
            SettingsSection(title = "Apparence") {
                DesignAppearanceSection(
                    currentTheme = selectedTheme,
                    onThemeChange = { t -> selectedTheme = t; ThemeState.setTheme(context, t) }
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

            // Sustain / Release
            SettingsSection(title = "Sustain") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Tune, null, tint = TextTertiary, modifier = Modifier.size(20.dp))
                    Text("Résonance", color = TextPrimary, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    listOf("Court" to 0, "Normal" to 1, "Long" to 2).forEach { (label, level) ->
                        val isSelected = releaseLevel == level
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (isSelected) IndigoAccent.copy(alpha = 0.18f) else Surface2)
                                .then(
                                    if (isSelected) Modifier.border(1.dp, IndigoAccent, RoundedCornerShape(6.dp))
                                    else Modifier
                                )
                                .clickable {
                                    releaseLevel = level
                                    ThemePrefs.setReleaseLevel(context, level)
                                    audioEngine.setRelease(level)
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                label,
                                fontSize = 12.sp,
                                color = if (isSelected) IndigoAccent else TextTertiary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
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
                    Icon(Icons.Default.MusicNote, null, tint = TextTertiary, modifier = Modifier.size(20.dp))
                    Text("Volume", color = TextPrimary, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    listOf("Bas" to 0, "Moyen" to 1, "Fort" to 2).forEach { (label, level) ->
                        val isSelected = metronomeVolume == level
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (isSelected) IndigoAccent.copy(alpha = 0.18f) else Surface2)
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
                                color = if (isSelected) IndigoAccent else TextTertiary,
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
                    subtitle = "Scanner les claviers BLE MIDI",
                    icon = Icons.Default.Bluetooth,
                    checked = prefs.bleMidiEnabled,
                    onToggle = { enabled ->
                        val needed = if (enabled) buildList {
                            val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                                listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
                            else listOf(Manifest.permission.ACCESS_FINE_LOCATION)
                            permissions.filterTo(this) { context.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
                        } else emptyList()
                        if (needed.isNotEmpty()) blePermissions.launch(needed.toTypedArray())
                        else {
                            vm.setBleMidiEnabled(enabled)
                            if (enabled) midiManager.startBleScanning()
                        }
                    }
                )
                ToggleSetting(
                    label = "MIDI USB",
                    subtitle = "Connexion via câble USB OTG",
                    icon = Icons.Default.Usb,
                    checked = prefs.usbMidiEnabled,
                    onToggle = vm::setUsbMidiEnabled
                )
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Piano,
                        null,
                        tint = if (midiDeviceName != null) Success else TextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        if (midiDeviceName != null) "Connecté : $midiDeviceName" else "Aucun appareil connecté",
                        color = if (midiDeviceName != null) Success else TextTertiary,
                        fontSize = 12.sp
                    )
                }
            }

            // Piano LivePlay section
            SettingsSection(title = "Piano LivePlay") {
                ToggleSetting(
                    label = "Touches attendues",
                    subtitle = "Surligne les prochaines touches à jouer",
                    icon = Icons.Default.MusicNote,
                    checked = prefs.showExpectedKeys,
                    onToggle = vm::setShowExpectedKeys
                )
            }

            Spacer(Modifier.height(32.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SurfaceVariant)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("Piano Teacher · Studio Android", color = TextMuted, fontSize = 13.sp)
            }
        }
        }
    }
}

@Composable
private fun StudioProfileCard(
    goal: PracticeGoal,
    experience: ExperienceLevel,
    wantsMidi: Boolean,
    onReviewIntro: () -> Unit,
) {
    val goalLabel = when (goal) {
        PracticeGoal.READ -> "Lire"
        PracticeGoal.TECHNIQUE -> "Technique"
        PracticeGoal.CREATE -> "Créer"
    }
    val levelLabel = when (experience) {
        ExperienceLevel.STARTING -> "Je commence"
        ExperienceLevel.RETURNING -> "Je reprends"
        ExperienceLevel.REGULAR -> "Pratique régulière"
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(
                androidx.compose.ui.graphics.Brush.horizontalGradient(
                    listOf(IndigoAccent.copy(alpha = 0.18f), CyanMelody.copy(alpha = 0.07f)),
                )
            )
            .border(1.dp, IndigoAccent.copy(alpha = 0.24f), RoundedCornerShape(20.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier.size(46.dp).clip(RoundedCornerShape(14.dp)).background(IndigoAccent),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Piano,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(25.dp),
                )
            }
            Column(Modifier.weight(1f)) {
                Text("Mon parcours", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Text("Objectif $goalLabel · $levelLabel", color = TextSecondary, fontSize = 12.sp)
                Text(
                    if (wantsMidi) "Piano MIDI prévu" else "Pratique sans MIDI",
                    color = TextTertiary,
                    fontSize = 11.sp,
                )
            }
        }
        OutlinedButton(
            onClick = onReviewIntro,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, IndigoAccent.copy(alpha = 0.6f)),
            shape = RoundedCornerShape(14.dp),
        ) {
            Icon(Icons.Default.AutoAwesome, null, tint = IndigoAccent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Revoir l’introduction", color = IndigoAccent, fontWeight = FontWeight.SemiBold)
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
            color = TextTertiary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
        HorizontalDivider(color = Hairline)
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
                else Modifier.border(1.dp, BorderColor, RoundedCornerShape(10.dp))
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
            color = if (selected) colors.accent else TextSecondary,
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
        Icon(icon, null, tint = TextTertiary, modifier = Modifier.size(20.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, color = TextPrimary, fontSize = 14.sp)
            Text(subtitle, color = TextTertiary, fontSize = 12.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                checkedTrackColor = IndigoAccent
            )
        )
    }
}
