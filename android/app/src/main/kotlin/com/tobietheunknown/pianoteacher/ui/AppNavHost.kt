package com.tobietheunknown.pianoteacher.ui

import android.content.Intent
import android.content.res.Configuration
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.tobietheunknown.pianoteacher.ui.common.AdaptiveNavigationFrame
import com.tobietheunknown.pianoteacher.ui.common.AppTab
import com.tobietheunknown.pianoteacher.ui.editor.EditorScreen
import com.tobietheunknown.pianoteacher.ui.library.LibraryScreen
import com.tobietheunknown.pianoteacher.ui.livelearning.LiveLearningScreen
import com.tobietheunknown.pianoteacher.ui.liveplay.LivePlayScreen
import com.tobietheunknown.pianoteacher.ui.learning.LearningScreen
import com.tobietheunknown.pianoteacher.ui.onboarding.OnboardingScreen
import com.tobietheunknown.pianoteacher.ui.onboarding.OnboardingState
import com.tobietheunknown.pianoteacher.ui.settings.SettingsScreen
import com.tobietheunknown.pianoteacher.ui.settings.AppPrefs
import com.tobietheunknown.pianoteacher.ui.settings.appPreferences
import kotlinx.coroutines.launch

sealed class Screen(val route: String) {
    object Onboarding : Screen("onboarding?replay={replay}") {
        fun route(replay: Boolean) = "onboarding?replay=$replay"
    }
    object Library : Screen("library")
    object LivePlay : Screen("liveplay/{songId}/{phraseIndex}") {
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
    val context = LocalContext.current
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    val onboardingComplete by OnboardingState.isComplete
    var pendingImportUri by rememberSaveable { mutableStateOf<String?>(null) }
    var lastSongId by rememberSaveable { mutableStateOf<String?>(null) }
    val appPrefs by context.appPreferences.collectAsState(initial = AppPrefs())
    val isLandscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE

    LaunchedEffect(intent) {
        intent?.data?.toString()?.let { pendingImportUri = it }
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val currentSongId = backStackEntry?.arguments?.getString("songId")
    LaunchedEffect(currentSongId) {
        if (!currentSongId.isNullOrBlank()) lastSongId = currentSongId
    }

    val activeTab = remember(currentRoute) {
        when {
            currentRoute == Screen.Library.route -> AppTab.LIBRARY
            currentRoute?.startsWith("liveplay") == true -> AppTab.LIVEPLAY
            currentRoute?.startsWith("learning") == true -> AppTab.PARTITION
            currentRoute?.startsWith("livelearning") == true -> AppTab.LEARN
            currentRoute?.startsWith("editor") == true -> AppTab.EDITOR
            else -> AppTab.LIBRARY
        }
    }
    val showNavigation = currentRoute?.startsWith("onboarding") != true &&
        !(currentRoute?.startsWith("liveplay") == true && isLandscape)

    fun requireSong(action: (String) -> Unit) {
        val songId = lastSongId
        if (songId == null) {
            navController.popBackStack(Screen.Library.route, inclusive = false)
            scope.launch { snackbar.showSnackbar("Choisissez d’abord un morceau dans la bibliothèque") }
        } else {
            action(songId)
        }
    }

    fun navigateTopLevel(route: String) {
        navController.navigate(route) {
            popUpTo(Screen.Library.route) { inclusive = false }
            launchSingleTop = true
        }
    }

    AdaptiveNavigationFrame(
        active = activeTab,
        showNavigation = showNavigation,
        showEditor = appPrefs.showEditorTab,
        onSelect = { tab ->
            when (tab) {
                AppTab.LIBRARY -> navController.popBackStack(Screen.Library.route, inclusive = false)
                AppTab.LEARN -> requireSong { id ->
                    if (currentRoute?.startsWith("livelearning") != true) {
                        navigateTopLevel(Screen.LiveLearning.route(id))
                    }
                }
                AppTab.EDITOR -> requireSong { id ->
                    if (currentRoute?.startsWith("editor") != true) {
                        navigateTopLevel(Screen.Editor.route(id))
                    }
                }
                AppTab.PARTITION -> requireSong { id ->
                    if (currentRoute?.startsWith("learning") != true) {
                        navigateTopLevel(Screen.Learning.route(id))
                    }
                }
                AppTab.LIVEPLAY -> requireSong { id ->
                    if (currentRoute?.startsWith("liveplay") != true) {
                        navigateTopLevel(Screen.LivePlay.route(id))
                    }
                }
            }
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            NavHost(
                navController = navController,
                startDestination = if (onboardingComplete) Screen.Library.route else Screen.Onboarding.route(false),
            ) {
                composable(
                    route = Screen.Onboarding.route,
                    arguments = listOf(navArgument("replay") {
                        type = NavType.BoolType
                        defaultValue = false
                    }),
                ) { entry ->
                    val replay = entry.arguments?.getBoolean("replay") ?: false
                    OnboardingScreen(
                        isReplay = replay,
                        onFinished = {
                            if (replay) {
                                navController.popBackStack()
                            } else {
                                navController.navigate(Screen.Library.route) {
                                    popUpTo(Screen.Onboarding.route) { inclusive = true }
                                    launchSingleTop = true
                                }
                            }
                        },
                    )
                }

                composable(Screen.Library.route) {
                    LibraryScreen(
                        importUriString = pendingImportUri,
                        onImportConsumed = { pendingImportUri = null },
                        onSongContextSelected = { lastSongId = it },
                        onSongDeleted = { deletedId ->
                            if (lastSongId == deletedId) lastSongId = null
                        },
                        onSongSelected = { songId ->
                            lastSongId = songId
                            navController.navigate(Screen.Learning.route(songId))
                        },
                        onEditSong = { songId ->
                            lastSongId = songId
                            navController.navigate(Screen.Editor.route(songId))
                        },
                        onPlaySong = { songId ->
                            lastSongId = songId
                            navController.navigate(Screen.LivePlay.route(songId))
                        },
                        onApprentissageSong = { songId ->
                            lastSongId = songId
                            navController.navigate(Screen.LiveLearning.route(songId))
                        },
                        onSettings = { navController.navigate(Screen.Settings.route) },
                    )
                }

                composable(
                    route = Screen.LivePlay.route,
                    arguments = listOf(
                        navArgument("songId") { type = NavType.StringType },
                        navArgument("phraseIndex") { type = NavType.IntType; defaultValue = -1 },
                    ),
                ) { entry ->
                    val songId = entry.arguments?.getString("songId") ?: return@composable
                    val phraseIndex = entry.arguments?.getInt("phraseIndex") ?: -1
                    LivePlayScreen(
                        songId = songId,
                        initialPhraseIndex = phraseIndex,
                        onBack = { navController.popBackStack() },
                    )
                }

                composable(
                    route = Screen.Learning.route,
                    arguments = listOf(navArgument("songId") { type = NavType.StringType }),
                ) { entry ->
                    val songId = entry.arguments?.getString("songId") ?: return@composable
                    LearningScreen(songId = songId, onBack = { navController.popBackStack() })
                }

                composable(
                    route = Screen.Editor.route,
                    arguments = listOf(navArgument("songId") { type = NavType.StringType }),
                ) { entry ->
                    val songId = entry.arguments?.getString("songId") ?: return@composable
                    EditorScreen(songId = songId, onBack = { navController.popBackStack() })
                }

                composable(
                    route = Screen.LiveLearning.route,
                    arguments = listOf(navArgument("songId") { type = NavType.StringType }),
                ) { entry ->
                    val songId = entry.arguments?.getString("songId") ?: return@composable
                    LiveLearningScreen(songId = songId, onBack = { navController.popBackStack() })
                }

                composable(Screen.Settings.route) {
                    SettingsScreen(
                        onBack = { navController.popBackStack() },
                        onReviewIntro = { navController.navigate(Screen.Onboarding.route(true)) },
                    )
                }
            }
            SnackbarHost(hostState = snackbar, modifier = Modifier.align(androidx.compose.ui.Alignment.BottomCenter))
        }
    }
}
