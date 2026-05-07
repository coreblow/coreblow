package ai.coreblow.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import ai.coreblow.app.navigation.AppNavGraph
import ai.coreblow.app.navigation.BottomNavBar
import ai.coreblow.app.navigation.NavHelper
import ai.coreblow.app.navigation.Routes
import ai.coreblow.app.node.NodeForegroundService
import ai.coreblow.app.ui.compose.CoreBlowTheme
import ai.coreblow.app.ui.compose.SettingsSheet
import ai.coreblow.app.viewmodel.ChatViewModel
import ai.coreblow.app.viewmodel.ConversationViewModel
import ai.coreblow.app.viewmodel.VoiceViewModel
import ai.coreblow.app.worker.HealthCheckWorker
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Main entry activity for CoreBlow Android.
 * Hosts the Compose UI tree with navigation, bottom bar,
 * settings sheet, and lifecycle management.
 */
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val PREFS_ONBOARDED = "coreblow_onboarded"
    }

    private val chatViewModel by viewModels<ChatViewModel>()
    private val conversationViewModel by viewModels<ConversationViewModel>()
    private val voiceViewModel by viewModels<VoiceViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val isOnboarded = getSharedPreferences(PREFS_ONBOARDED, MODE_PRIVATE)
            .getBoolean("completed", false)

        Log.i(TAG, "MainActivity created (onboarded=$isOnboarded)")

        setContent {
            CoreBlowTheme {
                val navController = rememberNavController()
                var showSettings by remember { mutableStateOf(false) }
                val isNodeRunning by NodeForegroundService.isRunning.collectAsState()
                val connectionState by NodeForegroundService.connectionState.collectAsState()

                Scaffold(
                    bottomBar = {
                        BottomNavBar(
                            navController = navController,
                            badges = mapOf(
                                Routes.CHAT to chatViewModel.pendingRunCount.collectAsState().value,
                            ),
                        )
                    },
                ) { innerPadding ->
                    AppNavGraph(
                        navController = navController,
                        startDestination = if (isOnboarded) Routes.CHAT else Routes.ONBOARDING,
                        modifier = Modifier.padding(innerPadding),
                        onNavigateToChat = { conversationId ->
                            conversationId?.let { conversationViewModel.switchToSession(it) }
                        },
                    )
                }

                if (showSettings) {
                    // SettingsSheet would be shown here
                }
            }
        }

        // Handle deep links
        handleIntent(intent)

        // Start health checks if onboarded
        if (isOnboarded) {
            val prefs = getSharedPreferences("coreblow_settings", MODE_PRIVATE)
            val host = prefs.getString("gateway_host", null)
            if (host != null) {
                val port = prefs.getInt("gateway_port", 18789)
                HealthCheckWorker.schedule(this, host, port)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        Log.i(TAG, "MainActivity destroyed")
        super.onDestroy()
    }

    private fun handleIntent(intent: Intent?) {
        intent ?: return
        val uri = intent.data ?: return

        when (uri.host) {
            "chat" -> {
                val conversationId = uri.lastPathSegment
                conversationId?.let { conversationViewModel.switchToSession(it) }
            }
            "connect" -> {
                val host = uri.getQueryParameter("host") ?: return
                val port = uri.getQueryParameter("port")?.toIntOrNull() ?: 18789
                NodeForegroundService.start(this, host, port)
            }
            else -> Log.d(TAG, "Unhandled deep link: $uri")
        }
    }

    /**
     * Mark onboarding as complete.
     */
    fun completeOnboarding() {
        getSharedPreferences(PREFS_ONBOARDED, MODE_PRIVATE)
            .edit().putBoolean("completed", true).apply()
    }
}
