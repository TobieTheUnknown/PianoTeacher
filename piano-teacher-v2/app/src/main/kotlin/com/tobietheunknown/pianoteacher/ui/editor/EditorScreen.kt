package com.tobietheunknown.pianoteacher.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.theme.*

/**
 * Placeholder for the Piano Roll editor.
 *
 * The full implementation is a Compose port of the web's
 * `components/editor/PianoRollEditor.jsx` (~990 lines) — pan/zoom canvas,
 * rectangle selection, copy/paste, MIDI recording. Tracked as Phase 3 of
 * the fusion plan.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    songId: String,
    onBack: () -> Unit
) {
    Scaffold(
        containerColor = Background,
        topBar = {
            TopAppBar(
                title = { Text("Éditeur", color = Color.White, fontWeight = FontWeight.Bold) },
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(120.dp, 80.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.White.copy(alpha = 0.06f))
            ) {
                Icon(
                    Icons.Default.Edit,
                    contentDescription = null,
                    tint = CyanMelody.copy(alpha = 0.6f),
                    modifier = Modifier
                        .size(36.dp)
                        .align(Alignment.Center)
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                "Éditeur Piano Roll",
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Édition + enregistrement MIDI.\nVersion native Android en cours d'intégration.",
                color = Color(0xFF94A3B8),
                fontSize = 14.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                "Morceau : $songId",
                color = Color(0xFF64748B),
                fontSize = 11.sp
            )
        }
    }
}
