package ai.coreblow.app.ui.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

/**
 * Post-onboarding tab layout with a pager-based welcome tour
 * and main content tabs for Chat, Voice, and Settings.
 */

// ============================================================
// Main tabs composable
// ============================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostOnboardingTabs(
    onChatSelected: () -> Unit = {},
    onVoiceSelected: () -> Unit = {},
    onSettingsSelected: () -> Unit = {},
    showWelcomeTour: Boolean = false,
    onWelcomeTourDismissed: () -> Unit = {},
) {
    var showTour by remember { mutableStateOf(showWelcomeTour) }

    if (showTour) {
        WelcomeTourDialog(onDismiss = { showTour = false; onWelcomeTourDismissed() })
    }

    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf(
        TabItem("Chat", Icons.Default.Chat),
        TabItem("Voice", Icons.Default.Mic),
        TabItem("Settings", Icons.Default.Settings),
    )

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = selectedTab) {
            tabs.forEachIndexed { index, tab ->
                Tab(
                    selected = selectedTab == index,
                    onClick = {
                        selectedTab = index
                        when (index) {
                            0 -> onChatSelected()
                            1 -> onVoiceSelected()
                            2 -> onSettingsSelected()
                        }
                    },
                    text = { Text(tab.title, fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal) },
                    icon = { Icon(tab.icon, tab.title) },
                )
            }
        }

        // Tab content area (placeholder)
        Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
            when (selectedTab) {
                0 -> TabContentCard("Chat", "Start a conversation with your AI assistant", Icons.Default.Chat)
                1 -> TabContentCard("Voice", "Use voice to interact with CoreBlow", Icons.Default.Mic)
                2 -> TabContentCard("Settings", "Configure your gateway and preferences", Icons.Default.Settings)
            }
        }
    }
}

@Composable
private fun TabContentCard(title: String, description: String, icon: ImageVector) {
    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
    ) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(icon, title, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(16.dp))
            Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(description, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
    }
}

// ============================================================
// Welcome Tour Dialog (pager)
// ============================================================

@Composable
private fun WelcomeTourDialog(onDismiss: () -> Unit) {
    val pages = listOf(
        TourPage("Welcome to CoreBlow", "Your AI-powered mobile assistant that connects to local and cloud AI models.", Icons.Default.Rocket),
        TourPage("Chat with AI", "Send messages, attach files, and get intelligent responses from multiple AI providers.", Icons.Default.Chat),
        TourPage("Voice Interaction", "Use wake words and voice commands for hands-free AI interaction.", Icons.Default.Mic),
        TourPage("Device Control", "Let AI agents interact with your device — camera, contacts, calendar, and more.", Icons.Default.PhoneAndroid),
        TourPage("You're All Set!", "Start chatting now or configure your gateway in settings.", Icons.Default.CheckCircle),
    )

    val pagerState = rememberPagerState(pageCount = { pages.size })
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            if (pagerState.currentPage == pages.size - 1) {
                Button(onClick = onDismiss) { Text("Get Started") }
            } else {
                Button(onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) } }) { Text("Next") }
            }
        },
        dismissButton = {
            if (pagerState.currentPage > 0) {
                TextButton(onClick = { scope.launch { pagerState.animateScrollToPage(pagerState.currentPage - 1) } }) { Text("Back") }
            } else {
                TextButton(onClick = onDismiss) { Text("Skip") }
            }
        },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                HorizontalPager(state = pagerState, modifier = Modifier.height(200.dp)) { page ->
                    TourPageContent(pages[page])
                }
                Spacer(Modifier.height(12.dp))
                // Page indicators
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    pages.forEachIndexed { index, _ ->
                        Box(
                            modifier = Modifier
                                .size(if (index == pagerState.currentPage) 10.dp else 6.dp)
                                .clip(CircleShape)
                                .background(
                                    if (index == pagerState.currentPage) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.outlineVariant,
                                ),
                        )
                    }
                }
            }
        },
    )
}

@Composable
private fun TourPageContent(page: TourPage) {
    Column(
        modifier = Modifier.fillMaxSize().padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(page.icon, null, modifier = Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text(page.title, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(page.description, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}

private data class TabItem(val title: String, val icon: ImageVector)
private data class TourPage(val title: String, val description: String, val icon: ImageVector)
