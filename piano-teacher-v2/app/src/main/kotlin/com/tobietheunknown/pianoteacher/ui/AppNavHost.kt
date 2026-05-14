package com.tobietheunknown.pianoteacher.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavBackStackEntry
import androidx.navigation.compose.currentBackStackEntryAsState
import com.tobietheunknown.pianoteacher.ui.common.AppTab
import com.tobietheunknown.pianoteacher.ui.common.BottomTabBar
import com.tobietheunknown.pianoteacher.ui.editor.EditorScreen
import com.tobietheunknown.pianoteacher.ui.library.LibraryScreen
import com.tobietheunknown.pianoteacher.ui.livelearning.LiveLearningScreen
import com.tobietheunknown.pianoteacher.ui.liveplay.LivePlayScreen
import com.tobietheunknown.pianoteacher.ui.learning.LearningScreen
import com.tobietheunknown.pianoteacher.ui.settings.SettingsScreen

sealed class Screen(val route: String) {
    object Library : Screen("library")
    object LivePlay : Screen("liveplay/{songId}/{phraseIndex}") {
        // phraseIndex = -1 → full song view (all phrases merged)
        fun route(songId: String, phraseIndex: Int = -1) = "liveplay/$songId/$phraseIndex"
    }
    object Learning : Screen("learning/{songId}") {
        fun route(songId: String) = "learning/$songId"
    }
    object Editor : Screen("editor/{songId}") {
        fun route(songId: String) = "editor/$songId"
    }
    object LiveLearning : Screen("livelearning/{songId}") {
        fun route(songId: String) = "livelearning/$songId"
    }
    object Settings : Screen("settings")
}

@Composable
fun AppNavHost(intent: Intent? = null) {
    val navController = rememberNavController()

    // Handle deep link import intent
    LaunchedEffect(intent) {
        intent?.data?.let { uri ->
            // Pass import URI to library screen via saved state
            navController.currentBackStackEntry
                ?.savedStateHandle
                ?.set("import_uri", uri.toString())
        }
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val activeTab = remember(currentRoute) {
        when {
            currentRoute == Screen.Library.route -> AppTab.LIBRARY
            currentRoute?.startsWith("editor") == true -> AppTab.EDITOR
            currentRoute?.startsWith("livelearning") == true -> AppTab.LEARN
            currentRoute?.startsWith("learning") == true -> AppTab.SHEET
            currentRoute?.startsWith("liveplay") == true -> AppTab.LIVEPLAY
            currentRoute == Screen.Settings.route -> AppTab.SETTINGS
            else -> AppTab.LIBRARY
        }
    }

    // Track the last song id seen on a music tab so tab clicks can navigate
    // back to the right song.
    val currentSongId = backStackEntry?.arguments?.getString("songId")
    val lastSongIdRef = remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
    androidx.compose.runtime.LaunchedEffect(currentSongId) {
        if (!currentSongId.isNullOrBlank()) lastSongIdRef.value = currentSongId
    }

    // LivePlay should be fullscreen — hide the tab bar.
    val showTabBar = currentRoute?.startsWith("liveplay") != true

    Column(modifier = Modifier.fillMaxSize()) {
        Box(modifier = Modifier.fillMaxSize().weight(1f)) {
    NavHost(navController = navController, startDestination = Screen.Library.route) {

        composable(Screen.Library.route) { backStack ->
            val importUriString = backStack.savedStateHandle.getStateFlow<String?>("import_uri", null)
                .collectAsState()
            LibraryScreen(
                importUriString = importUriString.value,
                onImportConsumed = { backStack.savedStateHandle.remove<String>("import_uri") },
                onSongSelected = { songId ->
                    navController.navigate(Screen.Learning.route(songId))
                },
                onPlaySong = { songId ->
                    navController.navigate(Screen.LivePlay.route(songId))
                },
                onApprentissageSong = { songId ->
                    navController.navigate(Screen.LiveLearning.route(songId))
                },
                onSettings = {
                    navController.navigate(Screen.Settings.route)
                }
            )
        }

        composable(
            route = Screen.LivePlay.route,
            arguments = listOf(
                navArgument("songId") { type = NavType.StringType },
                navArgument("phraseIndex") { type = NavType.IntType; defaultValue = 0 }
            )
        ) { backStack ->
            val songId = backStack.arguments?.getString("songId") ?: return@composable
            val phraseIndex = backStack.arguments?.getInt("phraseIndex") ?: 0
            LivePlayScreen(
                songId = songId,
                initialPhraseIndex = phraseIndex,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Learning.route,
            arguments = listOf(navArgument("songId") { type = NavType.StringType })
        ) { backStack ->
            val songId = backStack.arguments?.getString("songId") ?: return@composable
            LearningScreen(
                songId = songId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Editor.route,
            arguments = listOf(navArgument("songId") { type = NavType.StringType })
        ) { backStack ->
            val songId = backStack.arguments?.getString("songId") ?: return@composable
            EditorScreen(
                songId = songId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.LiveLearning.route,
            arguments = listOf(navArgument("songId") { type = NavType.StringType })
        ) { backStack ->
            val songId = backStack.arguments?.getString("songId") ?: return@composable
            LiveLearningScreen(
                songId = songId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
        }

        // Shared BottomTabBar at the very bottom — hidden on LivePlay
        // (fullscreen falling-notes view).
        if (showTabBar) {
            BottomTabBar(
                active = activeTab,
                onSelect = { tab ->
                    val songId = lastSongIdRef.value
                    when (tab) {
                        AppTab.LIBRARY -> {
                            // Pop everything back to Library — guaranteed root reset.
                            navController.popBackStack(Screen.Library.route, inclusive = false)
                        }
                        AppTab.SETTINGS -> {
                            if (currentRoute != Screen.Settings.route) {
                                navController.navigate(Screen.Settings.route) { launchSingleTop = true }
                            }
                        }
                        AppTab.SHEET -> {
                            if (songId == null) {
                                navController.popBackStack(Screen.Library.route, inclusive = false)
                            } else if (currentRoute?.startsWith("learning") != true) {
                                navController.navigate(Screen.Learning.route(songId)) { launchSingleTop = true }
                            }
                        }
                        AppTab.LEARN -> {
                            if (songId == null) {
                                navController.popBackStack(Screen.Library.route, inclusive = false)
                            } else if (currentRoute?.startsWith("livelearning") != true) {
                                navController.navigate(Screen.LiveLearning.route(songId)) { launchSingleTop = true }
                            }
                        }
                        AppTab.LIVEPLAY -> {
                            if (songId == null) {
                                navController.popBackStack(Screen.Library.route, inclusive = false)
                            } else if (currentRoute?.startsWith("liveplay") != true) {
                                navController.navigate(Screen.LivePlay.route(songId)) { launchSingleTop = true }
                            }
                        }
                        AppTab.EDITOR -> {
                            if (songId == null) {
                                navController.popBackStack(Screen.Library.route, inclusive = false)
                            } else if (currentRoute?.startsWith("editor") != true) {
                                navController.navigate(Screen.Editor.route(songId)) { launchSingleTop = true }
                            }
                        }
                    }
                },
            )
        }
    }
}
