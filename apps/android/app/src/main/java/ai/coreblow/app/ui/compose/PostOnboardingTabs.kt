package ai.coreblow.app.ui.compose

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Main tab container shown after onboarding completes.
 * Houses Connect, Chat, Voice, and Canvas tabs with
 * animated transitions between content screens.
 */
enum class CoreBlowTab(val label: String, val icon: ImageVector) {
    Connect("Connect", Icons.Default.Link),
    Chat("Chat", Icons.Default.Chat),
    Voice("Voice", Icons.Default.Mic),
    Canvas("Canvas", Icons.Default.Dashboard),
}

@Composable
fun PostOnboardingTabs(
    connectContent: @Composable () -> Unit,
    chatContent: @Composable () -> Unit,
    voiceContent: @Composable () -> Unit,
    canvasContent: @Composable () -> Unit,
    initialTab: CoreBlowTab = CoreBlowTab.Connect,
    onTabChanged: (CoreBlowTab) -> Unit = {},
    settingsAction: @Composable (() -> Unit)? = null,
    statusBadge: @Composable ((CoreBlowTab) -> Unit)? = null,
) {
    var selectedTab by remember { mutableStateOf(initialTab) }

    Scaffold(
        topBar = {
            if (settingsAction != null) {
                @OptIn(ExperimentalMaterial3Api::class)
                TopAppBar(
                    title = { Text("CoreBlow") },
                    actions = { settingsAction() },
                )
            }
        },
        bottomBar = {
            NavigationBar {
                CoreBlowTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = {
                            if (selectedTab != tab) {
                                selectedTab = tab
                                onTabChanged(tab)
                            }
                        },
                        icon = {
                            if (statusBadge != null) {
                                BadgedBox(badge = { statusBadge(tab) }) {
                                    Icon(tab.icon, contentDescription = tab.label)
                                }
                            } else {
                                Icon(tab.icon, contentDescription = tab.label)
                            }
                        },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            AnimatedContent(targetState = selectedTab, label = "tab_transition") { tab ->
                when (tab) {
                    CoreBlowTab.Connect -> connectContent()
                    CoreBlowTab.Chat -> chatContent()
                    CoreBlowTab.Voice -> voiceContent()
                    CoreBlowTab.Canvas -> canvasContent()
                }
            }
        }
    }
}

/**
 * Resolve tab from deep-link route name.
 */
fun tabFromRoute(route: String?): CoreBlowTab {
    return when (route?.trim()?.lowercase()) {
        "chat" -> CoreBlowTab.Chat
        "voice" -> CoreBlowTab.Voice
        "canvas" -> CoreBlowTab.Canvas
        else -> CoreBlowTab.Connect
    }
}
