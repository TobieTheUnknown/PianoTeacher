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
import com.tobietheunknown.pianoteacher.ui.library.LibraryScreen
import com.tobietheunknown.pianoteacher.ui.synthesia.SynthesiaScreen
import com.tobietheunknown.pianoteacher.ui.learning.LearningScreen
import com.tobietheunknown.pianoteacher.ui.settings.SettingsScreen

sealed class Screen(val route: String) {
    object Library : Screen("library")
    object Synthesia : Screen("synthesia/{songId}/{phraseIndex}") {
        // phraseIndex = -1 → full song view (all phrases merged)
        fun route(songId: String, phraseIndex: Int = -1) = "synthesia/$songId/$phraseIndex"
    }
    object Learning : Screen("learning/{songId}") {
        fun route(songId: String) = "learning/$songId"
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
                    navController.navigate(Screen.Synthesia.route(songId))
                },
                onSettings = {
                    navController.navigate(Screen.Settings.route)
                }
            )
        }

        composable(
            route = Screen.Synthesia.route,
            arguments = listOf(
                navArgument("songId") { type = NavType.StringType },
                navArgument("phraseIndex") { type = NavType.IntType; defaultValue = 0 }
            )
        ) { backStack ->
            val songId = backStack.arguments?.getString("songId") ?: return@composable
            val phraseIndex = backStack.arguments?.getInt("phraseIndex") ?: 0
            SynthesiaScreen(
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
                onPlayPhrase = { phraseIndex ->
                    navController.navigate(Screen.Synthesia.route(songId, phraseIndex))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
