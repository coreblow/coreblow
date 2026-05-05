package ai.coreblow.app.ui.compose

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ai.coreblow.app.viewmodel.GatewayViewModel
import ai.coreblow.app.viewmodel.SettingsViewModel
import ai.coreblow.app.viewmodel.VoiceViewModel

/**
 * Post-onboarding tab navigation shell.
 * Provides bottom navigation between Connect, Voice, and Settings tabs.
 */
@Composable
fun PostOnboardingTabs(
    gatewayViewModel: GatewayViewModel,
    voiceViewModel: VoiceViewModel,
    settingsViewModel: SettingsViewModel,
) {
    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Connect") },
                    label = { Text("Connect") },
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Voice") },
                    label = { Text("Voice") },
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") },
                )
            }
        }
    ) { paddingValues ->
        when (selectedTab) {
            0 -> ConnectScreen(viewModel = gatewayViewModel)
            1 -> VoiceTabScreen(viewModel = voiceViewModel)
            2 -> SettingsSheet(viewModel = settingsViewModel, gatewayViewModel = gatewayViewModel)
        }
    }
}
