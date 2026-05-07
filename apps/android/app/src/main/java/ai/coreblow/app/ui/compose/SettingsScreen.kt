package ai.coreblow.app.ui.compose

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ============================================================
// SettingsScreen — full settings page
// ============================================================

@Composable
fun SettingsScreen(
    gatewayHost: String,
    isConnected: Boolean,
    deviceModel: String,
    appVersion: String,
    debugMode: Boolean,
    onToggleDebug: (Boolean) -> Unit,
    onResetOnboarding: () -> Unit,
    onClearCache: () -> Unit,
    onAbout: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

        // Gateway section
        SettingsCard("Gateway") {
            SettingsRow("Status", if (isConnected) "Connected" else "Disconnected")
            SettingsRow("Host", gatewayHost.ifBlank { "Not configured" })
        }

        // Device section
        SettingsCard("Device") {
            SettingsRow("Model", deviceModel)
            SettingsRow("App Version", appVersion)
        }

        // Debug section
        SettingsCard("Developer") {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Debug Mode", fontSize = 14.sp)
                Switch(checked = debugMode, onCheckedChange = onToggleDebug)
            }
        }

        // Actions
        OutlinedButton(onClick = onClearCache, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.DeleteOutline, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Clear Cache")
        }
        OutlinedButton(onClick = onResetOnboarding, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
            Text("Reset Onboarding")
        }
        TextButton(onClick = onAbout, modifier = Modifier.fillMaxWidth()) {
            Text("About CoreBlow")
        }
    }
}

// ============================================================
// AboutScreen
// ============================================================

@Composable
fun AboutScreen(appVersion: String = "1.0.0", onBack: () -> Unit = {}) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))
        Icon(Icons.Default.SmartToy, contentDescription = null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text("CoreBlow", fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text("v$appVersion", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))
        Text("AI-powered device companion with gateway connectivity, voice interaction, and hardware integration.", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 24.dp))
        Spacer(Modifier.weight(1f))
        Text("© 2026 CoreBlow", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
    }
}

// ============================================================
// ProfileScreen
// ============================================================

@Composable
fun ProfileScreen(
    displayName: String = "User",
    email: String? = null,
    deviceId: String = "",
    onEditName: (String) -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Profile", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(20.dp))

        Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)) {
            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(56.dp).padding(4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(displayName, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    email?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    Text("Device: ${deviceId.take(8)}…", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
                }
            }
        }
    }
}

// ============================================================
// ModelSelector
// ============================================================

@Composable
fun ModelSelector(
    models: List<String> = emptyList(),
    selectedModel: String? = null,
    onModelSelected: (String) -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
        Text("Model", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(8.dp))
        if (models.isEmpty()) {
            Text("No models available", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            models.forEach { model ->
                Surface(
                    onClick = { onModelSelected(model) },
                    shape = RoundedCornerShape(8.dp),
                    color = if (model == selectedModel) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                ) {
                    Text(model, fontSize = 13.sp, modifier = Modifier.padding(12.dp))
                }
            }
        }
    }
}

// ============================================================
// OnboardingScreen (legacy wrapper)
// ============================================================

@Composable
fun OnboardingScreen(onComplete: () -> Unit = {}) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Default.Rocket, contentDescription = null, modifier = Modifier.size(72.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(24.dp))
        Text("Welcome to CoreBlow", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text("Your AI-powered device companion", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(32.dp))
        Button(onClick = onComplete, shape = RoundedCornerShape(12.dp)) { Text("Get Started") }
    }
}

// ============================================================
// MessageItem — single message display (standalone)
// ============================================================

@Composable
fun MessageItem(role: String, content: String, timestamp: String = "") {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = if (role == "user") Arrangement.End else Arrangement.Start) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (role == "user") MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f),
            modifier = Modifier.widthIn(max = 280.dp),
        ) {
            Column(modifier = Modifier.padding(10.dp)) {
                Text(content, fontSize = 13.sp)
                if (timestamp.isNotEmpty()) {
                    Text(timestamp, fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}

// ============================================================
// Helpers
// ============================================================

@Composable
private fun SettingsCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun SettingsRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}
