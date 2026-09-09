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
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.EditNote
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

/** Stable top-level destinations. Settings stays available from the Library header. */
enum class AppTab { LIBRARY, EDITOR, PARTITION, LEARN, LIVEPLAY }

data class TabItem(val tab: AppTab, val label: String, val icon: ImageVector)

private fun tabs(showEditor: Boolean) = buildList {
    add(TabItem(AppTab.LIBRARY, "Bibliothèque", Icons.AutoMirrored.Filled.LibraryBooks))
    if (showEditor) add(TabItem(AppTab.EDITOR, "Éditeur", Icons.Default.EditNote))
    add(TabItem(AppTab.PARTITION, "Partition", Icons.Default.QueueMusic))
    add(TabItem(AppTab.LEARN, "Coach", Icons.Default.School))
    add(TabItem(AppTab.LIVEPLAY, "Live", Icons.Default.GraphicEq))
}

@Composable
fun AdaptiveNavigationFrame(
    active: AppTab,
    onSelect: (AppTab) -> Unit,
    showNavigation: Boolean = true,
    showEditor: Boolean = true,
    content: @Composable BoxScope.() -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val compactRail = maxHeight < 620.dp
        val useRail = maxWidth >= 720.dp && maxHeight >= 520.dp
        when {
            !showNavigation -> Box(Modifier.fillMaxSize(), content = content)
            useRail -> Row(Modifier.fillMaxSize()) {
                StudioNavigationRail(
                    active = active,
                    onSelect = onSelect,
                    compact = compactRail,
                    showEditor = showEditor,
                )
                Box(Modifier.weight(1f).fillMaxHeight(), content = content)
            }
            else -> Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxWidth(), content = content)
                BottomTabBar(active = active, onSelect = onSelect, showEditor = showEditor)
            }
        }
    }
}

/** Phone navigation: five clear targets, compact labels and safe-area support. */
@Composable
fun BottomTabBar(
    active: AppTab,
    onSelect: (AppTab) -> Unit,
    modifier: Modifier = Modifier,
    showEditor: Boolean = true,
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .background(Surface1)
            .navigationBarsPadding(),
    ) {
        val compactLabels = maxWidth < 380.dp
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(68.dp)
                .padding(horizontal = 4.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            tabs(showEditor).forEach { item ->
                NavigationItem(
                    item = item,
                    selected = item.tab == active,
                    onClick = { onSelect(item.tab) },
                    compactLabel = compactLabels,
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                )
            }
        }
    }
}

@Composable
private fun StudioNavigationRail(active: AppTab, onSelect: (AppTab) -> Unit, compact: Boolean, showEditor: Boolean) {
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
        Spacer(Modifier.height(if (compact) 12.dp else 20.dp))
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.Center,
        ) {
            tabs(showEditor).forEach { item ->
                NavigationItem(
                    item = item,
                    selected = item.tab == active,
                    onClick = { onSelect(item.tab) },
                    compactLabel = compact,
                    modifier = Modifier.fillMaxWidth().height(if (compact) 58.dp else 66.dp),
                )
                Spacer(Modifier.height(if (compact) 2.dp else 4.dp))
            }
        }
    }
}

@Composable
private fun NavigationItem(
    item: TabItem,
    selected: Boolean,
    onClick: () -> Unit,
    compactLabel: Boolean = false,
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
        val displayLabel = when {
            item.tab == AppTab.LIBRARY -> "Biblio"
            compactLabel && item.tab == AppTab.PARTITION -> "Part."
            else -> item.label
        }
        Text(
            text = displayLabel,
            color = if (selected) IndigoAccent else TextTertiary,
            fontSize = if (compactLabel) 9.sp else 10.sp,
            lineHeight = 12.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
