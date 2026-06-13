package com.tobietheunknown.pianoteacher.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.LibraryBooks
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.theme.*

enum class AppTab { LIBRARY, EDITOR, LEARN, SHEET, LIVEPLAY, SETTINGS }

data class TabItem(val tab: AppTab, val label: String, val icon: ImageVector)

private val TABS = listOf(
    TabItem(AppTab.LIBRARY, "Biblio", Icons.AutoMirrored.Filled.LibraryBooks),
    TabItem(AppTab.EDITOR, "Éditeur", Icons.Default.Edit),
    TabItem(AppTab.LEARN, "Apprent.", Icons.Default.School),
    TabItem(AppTab.SHEET, "Partition", Icons.Default.Reorder),
    TabItem(AppTab.LIVEPLAY, "LivePlay", Icons.Default.PlayArrow),
    TabItem(AppTab.SETTINGS, "Réglages", Icons.Default.Settings),
)

/**
 * Shared bottom tab bar — mirrors the web BottomTabBar.
 * 6 tabs, 3px accent top border on the active one, 10sp label.
 */
@Composable
fun BottomTabBar(
    active: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(64.dp)
            .background(com.tobietheunknown.pianoteacher.ui.theme.Background)
            .padding(top = 1.dp),
    ) {
        TABS.forEach { item ->
            val isActive = item.tab == active
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clickable { onSelect(item.tab) },
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    if (isActive) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(0.6f)
                                .height(3.dp)
                                .clip(RoundedCornerShape(bottomStart = 2.dp, bottomEnd = 2.dp))
                                .background(com.tobietheunknown.pianoteacher.ui.theme.IndigoAccent)
                        )
                    } else {
                        Spacer(Modifier.height(3.dp))
                    }
                    Spacer(Modifier.height(4.dp))
                    Icon(
                        item.icon,
                        contentDescription = item.label,
                        tint = if (isActive) com.tobietheunknown.pianoteacher.ui.theme.IndigoAccent else TextTertiary,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        item.label,
                        color = if (isActive) com.tobietheunknown.pianoteacher.ui.theme.IndigoAccent else TextTertiary,
                        fontSize = 10.sp,
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
