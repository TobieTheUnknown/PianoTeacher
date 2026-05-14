package com.tobietheunknown.pianoteacher.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.common.MobileHeader
import com.tobietheunknown.pianoteacher.ui.common.PlaybackDock
import com.tobietheunknown.pianoteacher.ui.common.HandMode
import com.tobietheunknown.pianoteacher.ui.theme.*

/**
 * Editor mobile — read-only metadata + phrase list with the shared
 * PlaybackDock at the bottom. Mirrors the web Editor mobile design.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    songId: String,
    onBack: () -> Unit
) {
    var playing by remember { mutableStateOf(false) }
    var speed by remember { mutableStateOf(100) }
    var handMode by remember { mutableStateOf(HandMode.BOTH) }
    var metronome by remember { mutableStateOf(false) }
    var loop by remember { mutableStateOf(false) }
    var loopEditorOpen by remember { mutableStateOf(false) }

    Scaffold(containerColor = Background) { padding ->
        Box(modifier = Modifier
            .fillMaxSize()
            .padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(bottom = 130.dp + 64.dp),
            ) {
                // Header row with back button + MobileHeader content
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Retour", tint = Color.White)
                    }
                    Column {
                        Text(
                            "Éditeur",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp,
                            letterSpacing = (-0.02).sp,
                        )
                        Text(
                            songId,
                            color = Color(0xFF6B7280),
                            fontSize = 11.sp,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                // Info banner — design-aligned compact pill
                Row(
                    modifier = Modifier
                        .padding(horizontal = 18.dp, vertical = 4.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(IndigoAccent.copy(alpha = 0.12f))
                        .border(1.dp, IndigoAccent.copy(alpha = 0.30f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(22.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(IndigoAccent.copy(alpha = 0.20f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("i", color = IndigoAccent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                    Text(
                        "Édition complète disponible sur ordinateur. Sur mobile, seules les métadonnées sont modifiables.",
                        color = Color(0xFFA8AEBD),
                        fontSize = 12.sp,
                    )
                }

                Spacer(Modifier.height(12.dp))

                // Détails du Morceau placeholder card
                Box(
                    modifier = Modifier
                        .padding(horizontal = 18.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(SurfaceVariant)
                        .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(14.dp))
                        .padding(16.dp)
                ) {
                    Column {
                        Text(
                            "Détails du Morceau",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                        )
                        Text(
                            "Configurez les informations de votre composition",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }

            // Sticky bottom: PlaybackDock above bottom tab bar
            Box(modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 64.dp)
                .fillMaxWidth()) {
                PlaybackDock(
                    playing = playing,
                    onPlayPause = { playing = !playing },
                    speed = speed,
                    onSpeed = { speed = it },
                    handMode = handMode,
                    onHandMode = { handMode = it },
                    metronome = metronome,
                    onMetronome = { metronome = !metronome },
                    loop = loop,
                    onLoop = { loop = !loop },
                    loopRange = 1..1,
                    loopEditorOpen = loopEditorOpen,
                    onToggleLoopEditor = { loopEditorOpen = !loopEditorOpen },
                    totalMeasures = 1,
                )
            }
        }
    }
}
