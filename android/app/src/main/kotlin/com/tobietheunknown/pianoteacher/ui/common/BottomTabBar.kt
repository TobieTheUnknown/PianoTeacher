package com.tobietheunknown.pianoteacher.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.LibraryBooks
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Piano
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tobietheunknown.pianoteacher.ui.theme.*

/** Stable top-level destinations. Partition and Editor deliberately remain
 * contextual actions of a song instead of competing for scarce navigation. */
enum class AppTab { LIBRARY, LEARN, LIVEPLAY, SETTINGS }

data class TabItem(val tab: AppTab, val label: String, val icon: ImageVector)

private val TABS = listOf(
    TabItem(AppTab.LIBRARY, "Bibliothèque", Icons.AutoMirrored.Filled.LibraryBooks),
    TabItem(AppTab.LEARN, "Apprendre", Icons.Default.School),
    TabItem(AppTab.LIVEPLAY, "Live", Icons.Default.GraphicEq),
    TabItem(AppTab.SETTINGS, "Réglages", Icons.Default.Settings),
)

@Composable
fun AdaptiveNavigationFrame(
    active: AppTab,
    onSelect: (AppTab) -> Unit,
    showNavigation: Boolean = true,
    content: @Composable BoxScope.() -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val useRail = maxWidth >= 720.dp
        when {
            !showNavigation -> Box(Modifier.fillMaxSize(), content = content)
            useRail -> Row(Modifier.fillMaxSize()) {
                StudioNavigationRail(active = active, onSelect = onSelect)
                Box(Modifier.weight(1f).fillMaxHeight(), content = content)
            }
            else -> Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxWidth(), content = content)
                BottomTabBar(active = active, onSelect = onSelect)
            }
        }
    }
}

/** Phone navigation: four clear targets, 48dp minimum tap areas and safe-area support. */
@Composable
fun BottomTabBar(
    active: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Surface1)
            .navigationBarsPadding()
            .height(68.dp)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        TABS.forEach { item ->
            NavigationItem(
                item = item,
                selected = item.tab == active,
                onClick = { onSelect(item.tab) },
                modifier = Modifier.weight(1f).fillMaxHeight(),
            )
        }
    }
}

@Composable
private fun StudioNavigationRail(active: AppTab, onSelect: (AppTab) -> Unit) {
    Column(
        modifier = Modifier
            .width(96.dp)
            .fillMaxHeight()
            .background(Surface1)
            .safeDrawingPadding()
            .padding(horizontal = 8.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(15.dp))
                .background(IndigoAccent.copy(alpha = 0.16f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Piano, contentDescription = "Piano Teacher", tint = IndigoAccent)
        }
        Spacer(Modifier.height(24.dp))
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.Center,
        ) {
            TABS.forEach { item ->
                NavigationItem(
                    item = item,
                    selected = item.tab == active,
                    onClick = { onSelect(item.tab) },
                    modifier = Modifier.fillMaxWidth().height(72.dp),
                )
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}

@Composable
private fun NavigationItem(
    item: TabItem,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .selectable(
                selected = selected,
                onClick = onClick,
                role = Role.Tab,
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            )
            .background(if (selected) IndigoAccent.copy(alpha = 0.13f) else androidx.compose.ui.graphics.Color.Transparent)
            .semantics { contentDescription = item.label }
            .padding(horizontal = 4.dp, vertical = 5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(width = 42.dp, height = 30.dp)
                .clip(CircleShape)
                .background(if (selected) IndigoAccent.copy(alpha = 0.12f) else androidx.compose.ui.graphics.Color.Transparent),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                item.icon,
                contentDescription = null,
                tint = if (selected) IndigoAccent else TextTertiary,
                modifier = Modifier.size(21.dp),
            )
        }
        Text(
            text = if (item.tab == AppTab.LIBRARY) "Biblio" else item.label,
            color = if (selected) IndigoAccent else TextTertiary,
            fontSize = 10.sp,
            lineHeight = 12.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
