package ai.coreblow.app.ui

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import ai.coreblow.app.ui.compose.*

// ============================================================
// ChatActivity — standalone chat entry point (deep link / shortcut)
// ============================================================

class ChatActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("ChatActivity", "Chat launched via shortcut/deep-link")
        val conversationId = intent?.getStringExtra("conversation_id")
        setContent {
            // Direct chat launch — minimal wrapper
            Text("Chat: ${conversationId ?: "new"}")
        }
    }
}

@Composable
private fun Text(text: String) {
    androidx.compose.material3.Text(text)
}

// ============================================================
// LoginActivity — gateway authentication flow
// ============================================================

class LoginActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("LoginActivity", "Login flow started")
        setContent {
            var token by remember { mutableStateOf("") }
            androidx.compose.foundation.layout.Column(
                modifier = androidx.compose.ui.Modifier.fillMaxSize().padding(24.dp),
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
            ) {
                androidx.compose.material3.Text("Gateway Login", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                androidx.compose.foundation.layout.Spacer(androidx.compose.ui.Modifier.height(16.dp))
                androidx.compose.material3.OutlinedTextField(
                    value = token,
                    onValueChange = { token = it },
                    label = { androidx.compose.material3.Text("Token") },
                    singleLine = true,
                )
                androidx.compose.foundation.layout.Spacer(androidx.compose.ui.Modifier.height(16.dp))
                androidx.compose.material3.Button(onClick = { finish() }) {
                    androidx.compose.material3.Text("Connect")
                }
            }
        }
    }
    private fun androidx.compose.ui.Modifier.padding(dp: androidx.compose.ui.unit.Dp) = this.then(androidx.compose.foundation.layout.PaddingModifier(dp))
    private fun androidx.compose.ui.Modifier.fillMaxSize() = this.then(androidx.compose.foundation.layout.FillModifier())
}

private val dp = 24.dp
private val _16dp = 16.dp

// ============================================================
// OnboardingActivity — legacy onboarding wrapper
// ============================================================

class OnboardingActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("OnboardingActivity", "Onboarding started")
        setContent { OnboardingScreen(onComplete = { finish() }) }
    }
}

// ============================================================
// SettingsActivity — standalone settings entry point
// ============================================================

class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("SettingsActivity", "Settings launched")
        setContent {
            SettingsScreen(
                gatewayHost = "",
                isConnected = false,
                deviceModel = android.os.Build.MODEL,
                appVersion = "1.0.0",
                debugMode = false,
                onToggleDebug = {},
                onResetOnboarding = {},
                onClearCache = {},
                onAbout = {},
            )
        }
    }
}

private val androidx.compose.ui.unit.Int.dp: androidx.compose.ui.unit.Dp
    get() = androidx.compose.ui.unit.Dp(this.toFloat())
