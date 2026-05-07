package ai.coreblow.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.*
import ai.coreblow.app.navigation.AppNavGraph
import ai.coreblow.app.navigation.BottomNavItem
import ai.coreblow.app.ui.compose.*
import ai.coreblow.app.viewmodel.*

/**
 * Main activity — entry point for the CoreBlow app.
 * Hosts the navigation graph, initializes ViewModels,
 * and handles deep link intent routing.
 */
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    private val chatViewModel: ChatViewModel by viewModels()
    private val voiceViewModel: VoiceViewModel by viewModels()
    private val gatewayViewModel: GatewayViewModel by viewModels()
    private val settingsViewModel: SettingsViewModel by viewModels()
    private val onboardingViewModel: OnboardingViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(TAG, "MainActivity created")

        handleDeepLink(intent)

        setContent {
            var currentRoute by remember { mutableStateOf(BottomNavItem.CHAT.route) }
            val isOnboarded by onboardingViewModel.isCompleted.collectAsState()

            if (!isOnboarded) {
                OnboardingFlow(
                    viewModel = onboardingViewModel,
                    gatewayViewModel = gatewayViewModel,
                    onComplete = { onboardingViewModel.completeOnboarding() },
                )
            } else {
                AppNavGraph(
                    currentRoute = currentRoute,
                    onRouteChanged = { currentRoute = it },
                    chatContent = { ChatScreen(viewModel = chatViewModel) },
                    voiceContent = { VoiceTabScreen(viewModel = voiceViewModel) },
                    connectContent = { ConnectScreen(viewModel = gatewayViewModel) },
                    settingsContent = {
                        SettingsSheet(
                            viewModel = settingsViewModel,
                            onDismiss = { currentRoute = BottomNavItem.CHAT.route },
                        )
                    },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        Log.i(TAG, "Deep link: $uri")
        val host = uri.getQueryParameter("host")
        val port = uri.getQueryParameter("port")?.toIntOrNull()
        if (!host.isNullOrBlank()) {
            gatewayViewModel.connectManual(host, port ?: 18789)
        }
    }
}
