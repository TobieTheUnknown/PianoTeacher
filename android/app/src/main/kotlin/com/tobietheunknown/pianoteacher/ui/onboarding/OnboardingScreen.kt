package com.tobietheunknown.pianoteacher.ui.onboarding

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.theme.*

private const val LAST_PAGE = 3

@Composable
fun OnboardingScreen(
    isReplay: Boolean,
    onFinished: () -> Unit,
) {
    val context = LocalContext.current
    val saved = remember { OnboardingPreferences.profile(context) }
    var page by rememberSaveable { mutableIntStateOf(0) }
    var goal by rememberSaveable { mutableStateOf(saved.goal) }
    var experience by rememberSaveable { mutableStateOf(saved.experience) }
    var wantsMidi by rememberSaveable { mutableStateOf(saved.wantsMidi) }

    fun finish() {
        OnboardingState.complete(
            context,
            LearnerProfile(goal = goal, experience = experience, wantsMidi = wantsMidi),
        )
        onFinished()
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(IndigoAccent.copy(alpha = 0.18f), Background),
                    center = Offset(160f, 40f),
                    radius = 900f,
                )
            )
            .safeDrawingPadding(),
    ) {
        val wide = maxWidth >= 840.dp
        if (wide) {
            Row(Modifier.fillMaxSize()) {
                OnboardingVisual(
                    page = page,
                    modifier = Modifier.weight(0.92f).fillMaxHeight(),
                )
                OnboardingPanel(
                    page = page,
                    isReplay = isReplay,
                    goal = goal,
                    experience = experience,
                    wantsMidi = wantsMidi,
                    onGoal = { goal = it },
                    onExperience = { experience = it },
                    onMidi = { wantsMidi = it },
                    onBack = { page = (page - 1).coerceAtLeast(0) },
                    onNext = { if (page == LAST_PAGE) finish() else page++ },
                    onSkip = ::finish,
                    modifier = Modifier.weight(1.08f).fillMaxHeight(),
                )
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                OnboardingVisual(
                    page = page,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 154.dp, max = 220.dp).weight(0.32f),
                    compact = true,
                )
                OnboardingPanel(
                    page = page,
                    isReplay = isReplay,
                    goal = goal,
                    experience = experience,
                    wantsMidi = wantsMidi,
                    onGoal = { goal = it },
                    onExperience = { experience = it },
                    onMidi = { wantsMidi = it },
                    onBack = { page = (page - 1).coerceAtLeast(0) },
                    onNext = { if (page == LAST_PAGE) finish() else page++ },
                    onSkip = ::finish,
                    modifier = Modifier.fillMaxWidth().weight(0.68f),
                )
            }
        }
    }
}

@Composable
private fun OnboardingPanel(
    page: Int,
    isReplay: Boolean,
    goal: PracticeGoal,
    experience: ExperienceLevel,
    wantsMidi: Boolean,
    onGoal: (PracticeGoal) -> Unit,
    onExperience: (ExperienceLevel) -> Unit,
    onMidi: (Boolean) -> Unit,
    onBack: () -> Unit,
    onNext: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(Surface1.copy(alpha = 0.92f))
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (page > 0) {
                IconButton(onClick = onBack, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "Étape précédente", tint = TextPrimary)
                }
            } else {
                Spacer(Modifier.width(44.dp))
            }
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.Center,
            ) {
                repeat(LAST_PAGE + 1) { index ->
                    Box(
                        Modifier
                            .padding(horizontal = 3.dp)
                            .size(width = if (index == page) 22.dp else 7.dp, height = 7.dp)
                            .clip(CircleShape)
                            .background(if (index == page) IndigoAccent else BorderStrong)
                            .semantics { contentDescription = "Étape ${index + 1} sur ${LAST_PAGE + 1}" }
                    )
                }
            }
            TextButton(onClick = onSkip, modifier = Modifier.heightIn(min = 44.dp)) {
                Text(if (isReplay) "Fermer" else "Passer", color = TextSecondary)
            }
        }

        Crossfade(
            targetState = page,
            label = "onboarding-step",
            modifier = Modifier.weight(1f),
        ) { current ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(top = 12.dp, bottom = 12.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                when (current) {
                    0 -> WelcomeStep()
                    1 -> OrganizeStep()
                    2 -> LearnStep(
                        goal = goal,
                        experience = experience,
                        onGoal = onGoal,
                        onExperience = onExperience,
                    )
                    else -> ConnectStep(wantsMidi = wantsMidi, onMidi = onMidi)
                }
            }
        }

        Button(
            onClick = onNext,
            modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent),
        ) {
            val onAccent = MaterialTheme.colorScheme.onPrimary
            Text(
                if (page == LAST_PAGE) "Entrer dans mon studio" else "Continuer",
                color = onAccent,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Default.ArrowForward, null, tint = onAccent, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun StepHeading(eyebrow: String, title: String, body: String) {
    Text(
        eyebrow.uppercase(),
        color = IndigoAccent,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.2.sp,
    )
    Spacer(Modifier.height(10.dp))
    Text(
        title,
        color = TextPrimary,
        style = MaterialTheme.typography.headlineMedium,
        modifier = Modifier.semantics { heading() },
    )
    Spacer(Modifier.height(10.dp))
    Text(body, color = TextSecondary, style = MaterialTheme.typography.bodyLarge)
    Spacer(Modifier.height(22.dp))
}

@Composable
private fun WelcomeStep() {
    StepHeading(
        eyebrow = "Bienvenue",
        title = "Votre studio de piano, à votre rythme.",
        body = "De la première lecture à l’interprétation complète, Piano Teacher rassemble vos partitions, vos exercices et votre piano MIDI.",
    )
    FeatureLine(Icons.Default.AutoAwesome, "Un parcours clair", "Chaque morceau devient une suite d’étapes concrètes.")
    FeatureLine(Icons.Default.Tune, "Une pratique qui s’adapte", "Tempo, mains, boucles et attente MIDI à la demande.")
}

@Composable
private fun OrganizeStep() {
    StepHeading(
        eyebrow = "Organiser",
        title = "Toute votre musique, enfin lisible.",
        body = "Importez un MIDI ou un projet JSON. Les morceaux sont classés par tonalité, difficulté et phrases de travail.",
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        InfoPill("Do majeur", CyanMelody)
        InfoPill("Intermédiaire", IndigoAccent)
        InfoPill("6 phrases", PinkChords)
    }
    Spacer(Modifier.height(18.dp))
    FeatureLine(Icons.Default.Search, "Retrouver", "Recherche par titre, artiste ou tonalité.")
    FeatureLine(Icons.Default.ContentCut, "Structurer", "Découpez et regroupez les phrases sans altérer les notes.")
}

@Composable
private fun LearnStep(
    goal: PracticeGoal,
    experience: ExperienceLevel,
    onGoal: (PracticeGoal) -> Unit,
    onExperience: (ExperienceLevel) -> Unit,
) {
    StepHeading(
        eyebrow = "Apprendre",
        title = "Quel est votre cap ?",
        body = "Enregistrez votre intention de pratique pour garder un cap clair. Vous pourrez la modifier depuis les réglages.",
    )
    Text("MON OBJECTIF", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
    Spacer(Modifier.height(8.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        GoalChoice("Lire", Icons.Default.MenuBook, goal == PracticeGoal.READ, { onGoal(PracticeGoal.READ) }, Modifier.weight(1f))
        GoalChoice("Technique", Icons.Default.FitnessCenter, goal == PracticeGoal.TECHNIQUE, { onGoal(PracticeGoal.TECHNIQUE) }, Modifier.weight(1f))
        GoalChoice("Créer", Icons.Default.EditNote, goal == PracticeGoal.CREATE, { onGoal(PracticeGoal.CREATE) }, Modifier.weight(1f))
    }
    Spacer(Modifier.height(18.dp))
    Text("MON RYTHME ACTUEL", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
    Spacer(Modifier.height(8.dp))
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ExperienceChoice("Je commence", "Je découvre la lecture ou le clavier", experience == ExperienceLevel.STARTING) { onExperience(ExperienceLevel.STARTING) }
        ExperienceChoice("Je reprends", "J’ai déjà joué et je retrouve mes repères", experience == ExperienceLevel.RETURNING) { onExperience(ExperienceLevel.RETURNING) }
        ExperienceChoice("Je pratique régulièrement", "Je veux travailler plus précisément", experience == ExperienceLevel.REGULAR) { onExperience(ExperienceLevel.REGULAR) }
    }
}

@Composable
private fun ConnectStep(wantsMidi: Boolean, onMidi: (Boolean) -> Unit) {
    StepHeading(
        eyebrow = "Connecter",
        title = "Jouez. L’application vous écoute.",
        body = "Branchez un piano USB ou Bluetooth MIDI pour attendre les bonnes notes, suivre votre jeu et pratiquer sans toucher l’écran.",
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Surface2)
            .border(1.dp, BorderColor, RoundedCornerShape(18.dp))
            .clickable { onMidi(!wantsMidi) }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Icons.Default.Piano, null, tint = CyanMelody, modifier = Modifier.size(28.dp))
        Column(Modifier.weight(1f)) {
            Text("Je prévois d’utiliser un piano MIDI", color = TextPrimary, fontWeight = FontWeight.SemiBold)
            Text("Vous pourrez le sélectionner dans les réglages MIDI", color = TextTertiary, fontSize = 12.sp)
        }
        Switch(
            checked = wantsMidi,
            onCheckedChange = onMidi,
            colors = SwitchDefaults.colors(checkedTrackColor = IndigoAccent),
        )
    }
    Spacer(Modifier.height(18.dp))
    Text("APPARENCE", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
    Spacer(Modifier.height(10.dp))
    ThemeChoices()
    Spacer(Modifier.height(16.dp))
    Text("COULEUR D’ACCENT", color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
    Spacer(Modifier.height(10.dp))
    AccentChoices()
    Spacer(Modifier.height(18.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(PinkChords))
        Text("  Main gauche", color = TextSecondary, fontSize = 12.sp)
        Spacer(Modifier.width(18.dp))
        Box(Modifier.size(10.dp).clip(CircleShape).background(CyanMelody))
        Text("  Main droite", color = TextSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun ThemeChoices() {
    val context = LocalContext.current
    val theme by ThemeState.current
    Row(
        modifier = Modifier.selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        listOf("Sombre" to AppTheme.DARK, "Clair" to AppTheme.LIGHT).forEach { (label, value) ->
            val selected = theme == value || (value == AppTheme.DARK && theme != AppTheme.LIGHT)
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(13.dp))
                    .background(if (selected) IndigoAccent.copy(alpha = 0.13f) else Surface2)
                    .border(1.dp, if (selected) IndigoAccent else BorderColor, RoundedCornerShape(13.dp))
                    .selectable(selected = selected, onClick = { ThemeState.setTheme(context, value) }, role = Role.RadioButton)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(18.dp).clip(CircleShape)
                        .background(if (value == AppTheme.DARK) Color(0xFF0A0C10) else Color(0xFFF7F8FA))
                        .border(1.dp, BorderStrong, CircleShape)
                )
                Spacer(Modifier.width(8.dp))
                Text(label, color = if (selected) IndigoAccent else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun AccentChoices() {
    val context = LocalContext.current
    val accent by ThemeState.accent
    Row(
        modifier = Modifier.selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        AllAccents.forEach { preset ->
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(preset.color)
                    .border(if (accent.key == preset.key) 3.dp else 0.dp, TextPrimary, CircleShape)
                    .selectable(
                        selected = accent.key == preset.key,
                        onClick = { ThemeState.setAccent(context, preset) },
                        role = Role.RadioButton,
                    )
                    .semantics { contentDescription = "Accent ${preset.key}" },
                contentAlignment = Alignment.Center,
            ) {
                if (accent.key == preset.key) Icon(
                    Icons.Default.Check,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

@Composable
private fun FeatureLine(icon: ImageVector, title: String, subtitle: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(13.dp),
    ) {
        Box(
            Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(IndigoAccent.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, null, tint = IndigoAccent, modifier = Modifier.size(21.dp)) }
        Column(Modifier.weight(1f)) {
            Text(title, color = TextPrimary, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = TextTertiary, fontSize = 12.sp, lineHeight = 17.sp)
        }
    }
}

@Composable
private fun InfoPill(text: String, color: Color) {
    Text(
        text,
        color = color,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.clip(CircleShape).background(color.copy(alpha = 0.12f)).padding(horizontal = 10.dp, vertical = 6.dp),
    )
}

@Composable
private fun GoalChoice(label: String, icon: ImageVector, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    Column(
        modifier = modifier
            .heightIn(min = 86.dp)
            .clip(RoundedCornerShape(15.dp))
            .background(if (selected) IndigoAccent.copy(alpha = 0.14f) else Surface2)
            .border(1.dp, if (selected) IndigoAccent else BorderColor, RoundedCornerShape(15.dp))
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, null, tint = if (selected) IndigoAccent else TextTertiary, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(7.dp))
        Text(label, color = if (selected) IndigoAccent else TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ExperienceChoice(label: String, subtitle: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) IndigoAccent.copy(alpha = 0.10f) else Surface2)
            .border(1.dp, if (selected) IndigoAccent else BorderColor, RoundedCornerShape(14.dp))
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(20.dp).clip(CircleShape).border(2.dp, if (selected) IndigoAccent else TextMuted, CircleShape),
            contentAlignment = Alignment.Center,
        ) { if (selected) Box(Modifier.size(10.dp).clip(CircleShape).background(IndigoAccent)) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 14.sp)
            Text(subtitle, color = TextTertiary, fontSize = 11.sp)
        }
    }
}

@Composable
private fun OnboardingVisual(page: Int, modifier: Modifier = Modifier, compact: Boolean = false) {
    Box(
        modifier = modifier
            .background(
                Brush.verticalGradient(
                    listOf(IndigoAccent.copy(alpha = 0.14f), Background.copy(alpha = 0.3f)),
                )
            )
            .padding(if (compact) 18.dp else 34.dp),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val keyHeight = size.height * if (compact) 0.34f else 0.25f
            val keyTop = size.height - keyHeight
            val whiteWidth = size.width / 9f
            for (i in 0..8) {
                drawRoundRect(
                    color = KeyWhite.copy(alpha = if (i % 2 == 0) 0.88f else 0.68f),
                    topLeft = Offset(i * whiteWidth + 1f, keyTop),
                    size = Size(whiteWidth - 2f, keyHeight),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f, 5f),
                )
            }
            listOf(1, 2, 4, 5, 6, 8).forEach { i ->
                drawRoundRect(
                    color = KeyBlack.copy(alpha = 0.92f),
                    topLeft = Offset(i * whiteWidth - whiteWidth * .28f, keyTop),
                    size = Size(whiteWidth * .56f, keyHeight * .62f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f, 5f),
                )
            }
            val bars = if (compact) 5 else 8
            repeat(bars) { i ->
                val x = (i + 0.8f) * size.width / (bars + 1.5f)
                val h = size.height * (0.12f + (i % 3) * 0.055f)
                drawRoundRect(
                    color = if ((i + page) % 2 == 0) CyanMelody.copy(alpha = 0.75f) else PinkChords.copy(alpha = 0.72f),
                    topLeft = Offset(x, keyTop - h - (i % 2) * 22f),
                    size = Size((size.width / bars) * .42f, h),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(10f, 10f),
                )
            }
        }
        Column(Modifier.align(Alignment.TopStart)) {
            Box(
                Modifier.size(46.dp).clip(RoundedCornerShape(15.dp)).background(IndigoAccent),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Piano,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(26.dp),
                )
            }
            if (!compact) {
                Spacer(Modifier.height(18.dp))
                Text("PIANO TEACHER", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                Text("STUDIO", color = IndigoAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 3.sp)
            }
        }
    }
}
