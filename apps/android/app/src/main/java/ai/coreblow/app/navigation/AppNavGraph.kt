package ai.coreblow.app.navigation

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Bottom navigation destinations.
 */
enum class BottomNavItem(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector,
) {
    CHAT("chat", "Chat", Icons.Default.ChatBubbleOutline, Icons.Default.ChatBubble),
    VOICE("voice", "Voice", Icons.Default.MicNone, Icons.Default.Mic),
    CONNECT("connect", "Connect", Icons.Default.LinkOff, Icons.Default.Link),
    SETTINGS("settings", "Settings", Icons.Default.SettingsOutlined, Icons.Default.Settings),
}

/**
 * App-level navigation graph composable.
 */
@Composable
fun AppNavGraph(
    currentRoute: String,
    onRouteChanged: (String) -> Unit,
    chatContent: @Composable () -> Unit,
    voiceContent: @Composable () -> Unit,
    connectContent: @Composable () -> Unit,
    settingsContent: @Composable () -> Unit,
) {
    Scaffold(
        bottomBar = {
            BottomNavBar(currentRoute = currentRoute, onItemSelected = onRouteChanged)
        },
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            AnimatedContent(
                targetState = currentRoute,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "nav_crossfade",
            ) { route ->
                when (route) {
                    BottomNavItem.CHAT.route -> chatContent()
                    BottomNavItem.VOICE.route -> voiceContent()
                    BottomNavItem.CONNECT.route -> connectContent()
                    BottomNavItem.SETTINGS.route -> settingsContent()
                    else -> chatContent()
                }
            }
        }
    }
}

/**
 * Bottom navigation bar with badge support.
 */
@Composable
fun BottomNavBar(
    currentRoute: String,
    onItemSelected: (String) -> Unit,
    badges: Map<String, Int> = emptyMap(),
) {
    NavigationBar {
        BottomNavItem.entries.forEach { item ->
            val selected = currentRoute == item.route
            val badgeCount = badges[item.route] ?: 0

            NavigationBarItem(
                selected = selected,
                onClick = { onItemSelected(item.route) },
                icon = {
                    if (badgeCount > 0) {
                        BadgedBox(badge = { Badge { Text("$badgeCount") } }) {
                            Icon(
                                if (selected) item.selectedIcon else item.icon,
                                contentDescription = item.label,
                            )
                        }
                    } else {
                        Icon(
                            if (selected) item.selectedIcon else item.icon,
                            contentDescription = item.label,
                        )
                    }
                },
                label = { Text(item.label) },
            )
        }
    }
}
