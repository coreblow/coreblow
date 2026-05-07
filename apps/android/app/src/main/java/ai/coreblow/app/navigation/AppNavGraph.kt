package ai.coreblow.app.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink

// ============================================================
// Route definitions
// ============================================================

object Routes {
    const val CHAT = "chat"
    const val CHAT_DETAIL = "chat/{conversationId}"
    const val VOICE = "voice"
    const val HISTORY = "history"
    const val SETTINGS = "settings"
    const val ABOUT = "about"
    const val PROFILE = "profile"
    const val ONBOARDING = "onboarding"
    const val ONBOARDING_STEP = "onboarding/{step}"
    const val MODEL_SELECTOR = "model_selector"
    const val AGENT_BUILDER = "agent_builder"
    const val PLUGIN_STORE = "plugin_store"
    const val TOOL_BROWSER = "tool_browser"
    const val COST = "cost"
    const val BOOKMARKS = "bookmarks"
    const val PINNED = "pinned"
    const val THREAD = "thread/{threadId}"
    const val SEARCH = "search"
    const val DEBUG = "debug"

    fun chatDetail(conversationId: String) = "chat/$conversationId"
    fun onboardingStep(step: Int) = "onboarding/$step"
    fun thread(threadId: String) = "thread/$threadId"
}

// ============================================================
// Bottom nav items
// ============================================================

enum class BottomNavItem(
    val route: String,
    val icon: ImageVector,
    val label: String,
) {
    CHAT(Routes.CHAT, Icons.Default.Chat, "Chat"),
    VOICE(Routes.VOICE, Icons.Default.Mic, "Voice"),
    HISTORY(Routes.HISTORY, Icons.Default.History, "History"),
    SETTINGS(Routes.SETTINGS, Icons.Default.Settings, "Settings"),
}

// ============================================================
// AppNavGraph
// ============================================================

@Composable
fun AppNavGraph(
    navController: NavHostController = rememberNavController(),
    startDestination: String = Routes.CHAT,
    onNavigateToChat: (String?) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
        enterTransition = { fadeIn(tween(200)) + slideInHorizontally(tween(200)) { it / 4 } },
        exitTransition = { fadeOut(tween(150)) },
        popEnterTransition = { fadeIn(tween(200)) + slideInHorizontally(tween(200)) { -it / 4 } },
        popExitTransition = { fadeOut(tween(150)) + slideOutHorizontally(tween(150)) { it / 4 } },
    ) {
        // Main tabs
        composable(Routes.CHAT) {
            onNavigateToChat(null)
        }
        composable(
            Routes.CHAT_DETAIL,
            arguments = listOf(navArgument("conversationId") { type = NavType.StringType }),
            deepLinks = listOf(navDeepLink { uriPattern = "coreblow://chat/{conversationId}" }),
        ) { backStackEntry ->
            val conversationId = backStackEntry.arguments?.getString("conversationId")
            onNavigateToChat(conversationId)
        }
        composable(Routes.VOICE) { /* Voice tab content */ }
        composable(Routes.HISTORY) { /* History tab content */ }
        composable(Routes.SETTINGS) { /* Settings tab content */ }

        // Secondary screens
        composable(Routes.ABOUT) { /* About screen */ }
        composable(Routes.PROFILE) { /* Profile screen */ }
        composable(Routes.MODEL_SELECTOR) { /* Model selector */ }
        composable(Routes.AGENT_BUILDER) { /* Agent builder */ }
        composable(Routes.PLUGIN_STORE) { /* Plugin store */ }
        composable(Routes.TOOL_BROWSER) { /* Tool browser */ }
        composable(Routes.COST) { /* Cost screen */ }
        composable(Routes.BOOKMARKS) { /* Bookmarks */ }
        composable(Routes.PINNED) { /* Pinned */ }
        composable(Routes.SEARCH) { /* Search */ }
        composable(Routes.DEBUG) { /* Debug */ }

        // Parameterized screens
        composable(Routes.ONBOARDING) { /* Onboarding start */ }
        composable(
            Routes.ONBOARDING_STEP,
            arguments = listOf(navArgument("step") { type = NavType.IntType }),
        ) { /* Onboarding step */ }
        composable(
            Routes.THREAD,
            arguments = listOf(navArgument("threadId") { type = NavType.StringType }),
        ) { /* Thread */ }
    }
}

// ============================================================
// BottomNavBar with badge support
// ============================================================

@Composable
fun BottomNavBar(
    navController: NavHostController,
    badges: Map<String, Int> = emptyMap(),
    modifier: Modifier = Modifier,
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    NavigationBar(modifier = modifier) {
        BottomNavItem.entries.forEach { item ->
            val selected = currentRoute == item.route
            val badgeCount = badges[item.route] ?: 0

            NavigationBarItem(
                selected = selected,
                onClick = {
                    if (currentRoute != item.route) {
                        navController.navigate(item.route) {
                            popUpTo(Routes.CHAT) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = {
                    if (badgeCount > 0) {
                        BadgedBox(badge = {
                            Badge { Text(if (badgeCount > 99) "99+" else "$badgeCount", fontSize = 9.sp) }
                        }) {
                            Icon(item.icon, item.label)
                        }
                    } else {
                        Icon(item.icon, item.label)
                    }
                },
                label = { Text(item.label, fontSize = 11.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal) },
                alwaysShowLabel = true,
            )
        }
    }
}

// ============================================================
// Navigation helpers
// ============================================================

object NavHelper {
    fun navigateToChat(navController: NavHostController, conversationId: String? = null) {
        if (conversationId != null) {
            navController.navigate(Routes.chatDetail(conversationId)) { launchSingleTop = true }
        } else {
            navController.navigate(Routes.CHAT) { launchSingleTop = true }
        }
    }

    fun navigateToSettings(navController: NavHostController) {
        navController.navigate(Routes.SETTINGS) { launchSingleTop = true }
    }

    fun navigateToOnboarding(navController: NavHostController) {
        navController.navigate(Routes.ONBOARDING) {
            popUpTo(0) { inclusive = true }
        }
    }

    fun navigateToSearch(navController: NavHostController) {
        navController.navigate(Routes.SEARCH) { launchSingleTop = true }
    }

    fun navigateToThread(navController: NavHostController, threadId: String) {
        navController.navigate(Routes.thread(threadId)) { launchSingleTop = true }
    }

    fun navigateBack(navController: NavHostController) {
        navController.popBackStack()
    }

    fun isTopLevel(route: String?): Boolean {
        return route in setOf(Routes.CHAT, Routes.VOICE, Routes.HISTORY, Routes.SETTINGS)
    }
}
