package com.tobietheunknown.pianoteacher

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.tobietheunknown.pianoteacher.ui.theme.PianoTeacherTheme
import com.tobietheunknown.pianoteacher.ui.AppNavHost

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PianoTeacherTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppNavHost(intent = intent)
                }
            }
        }
    }
}
