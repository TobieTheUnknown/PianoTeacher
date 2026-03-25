package com.tobietheunknown.pianoteacher

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.tobietheunknown.pianoteacher.ui.theme.PianoTeacherTheme
import com.tobietheunknown.pianoteacher.ui.theme.ThemeState
import com.tobietheunknown.pianoteacher.ui.theme.getThemeColors
import com.tobietheunknown.pianoteacher.ui.AppNavHost

class MainActivity : ComponentActivity() {

    private var currentIntent by mutableStateOf<Intent?>(null)

    private val blePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* BLE scan will be guarded by try-catch if denied */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        currentIntent = intent
        // BLE permissions are now requested from Settings when BLE MIDI is toggled on
        // requestBlePermissionsIfNeeded()

        ThemeState.init(this)

        setContent {
            val currentTheme by ThemeState.current
            val colors = getThemeColors(currentTheme)
            PianoTeacherTheme(colors = colors) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNavHost(intent = currentIntent)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        currentIntent = intent
    }

    private fun requestBlePermissionsIfNeeded() {
        val needed = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED)
                    add(Manifest.permission.BLUETOOTH_SCAN)
                if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED)
                    add(Manifest.permission.BLUETOOTH_CONNECT)
            } else {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
                    add(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
        if (needed.isNotEmpty()) blePermissionLauncher.launch(needed.toTypedArray())
    }
}
