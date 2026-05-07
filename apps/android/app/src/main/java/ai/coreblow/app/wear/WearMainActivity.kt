package ai.coreblow.app.wear

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ============================================================
// WearMainActivity
// ============================================================

class WearMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("WearMain", "Wear activity created")
        setContent {
            WearTheme {
                var currentScreen by remember { mutableStateOf("chat") }
                when (currentScreen) {
                    "chat" -> WearChatScreen(onNavigate = { currentScreen = it })
                    "notification" -> WearNotificationScreen(onBack = { currentScreen = "chat" })
                    "settings" -> WearSettingsScreen(onBack = { currentScreen = "chat" })
                }
            }
        }
    }
}

// ============================================================
// WearTheme
// ============================================================

@Composable
fun WearTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFFBB86FC),
            secondary = Color(0xFF03DAC5),
            background = Color(0xFF121212),
            surface = Color(0xFF1E1E1E),
            onBackground = Color.White,
            onSurface = Color.White,
        ),
        content = content,
    )
}

// ============================================================
// WearChatScreen
// ============================================================

@Composable
fun WearChatScreen(onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("CoreBlow", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(8.dp))

        // Last message preview
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
            Text("No messages yet", fontSize = 11.sp, modifier = Modifier.padding(10.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Spacer(Modifier.weight(1f))

        // Quick actions
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = { /* Voice input */ }, modifier = Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary)) {
                Icon(Icons.Default.Mic, contentDescription = "Voice", modifier = Modifier.size(18.dp), tint = Color.White)
            }
            IconButton(onClick = { onNavigate("notification") }, modifier = Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondary)) {
                Icon(Icons.Default.Notifications, contentDescription = "Notifications", modifier = Modifier.size(18.dp), tint = Color.White)
            }
            IconButton(onClick = { onNavigate("settings") }, modifier = Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surface)) {
                Icon(Icons.Default.Settings, contentDescription = "Settings", modifier = Modifier.size(18.dp), tint = Color.White)
            }
        }
    }
}

// ============================================================
// WearNotificationScreen
// ============================================================

@Composable
fun WearNotificationScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", modifier = Modifier.size(16.dp))
            }
            Text("Notifications", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(8.dp))
        Text("No notifications", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(8.dp))
    }
}

// ============================================================
// WearSettingsScreen
// ============================================================

@Composable
fun WearSettingsScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", modifier = Modifier.size(16.dp))
            }
            Text("Settings", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(8.dp))

        WearSettingRow("Gateway", "Not connected")
        WearSettingRow("Voice", "Enabled")
        WearSettingRow("Version", "1.0.0")
    }
}

@Composable
private fun WearSettingRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}
