package ai.coreblow.app.ui.compose

import androidx.compose.animation.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.viewmodel.SettingsViewModel

/**
 * Settings bottom sheet with gateway config, capability toggles,
 * voice/TTS settings, debug options, and clear data action.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(
    viewModel: SettingsViewModel,
    onDismiss: () -> Unit,
) {
    val gatewayHost by viewModel.gatewayHost.collectAsState()
    val gatewayPort by viewModel.gatewayPort.collectAsState()
    val useTls by viewModel.useTls.collectAsState()
    val debugMode by viewModel.debugMode.collectAsState()
    val cameraEnabled by viewModel.cameraEnabled.collectAsState()
    val locationEnabled by viewModel.locationEnabled.collectAsState()
    val smsEnabled by viewModel.smsEnabled.collectAsState()
    val contactsEnabled by viewModel.contactsEnabled.collectAsState()
    val calendarEnabled by viewModel.calendarEnabled.collectAsState()
    val micEnabled by viewModel.micEnabled.collectAsState()
    val motionEnabled by viewModel.motionEnabled.collectAsState()
    val deviceModel by viewModel.deviceModel.collectAsState()
    val appVersion by viewModel.appVersion.collectAsState()
    val deviceId by viewModel.deviceId.collectAsState()

    var showClearConfirm by remember { mutableStateOf(false) }
    var expandedSection by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Settings, null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text("Settings", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text("v$appVersion", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            // Gateway section
            SettingsSectionCard(
                title = "Gateway Connection",
                icon = Icons.Default.Dns,
                expanded = expandedSection == "gateway",
                onToggle = { expandedSection = if (expandedSection == "gateway") null else "gateway" },
            ) {
                OutlinedTextField(
                    value = gatewayHost,
                    onValueChange = { viewModel.setGatewayHost(it) },
                    label = { Text("Host") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(Icons.Default.Computer, null, Modifier.size(18.dp)) },
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = gatewayPort,
                        onValueChange = { viewModel.setGatewayPort(it) },
                        label = { Text("Port") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("TLS", fontSize = 11.sp)
                        Switch(checked = useTls, onCheckedChange = { viewModel.setUseTls(it) })
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalButton(onClick = { /* test connection */ }, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.NetworkCheck, null, Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Test", fontSize = 12.sp)
                    }
                    OutlinedButton(onClick = { /* discover */ }, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.Search, null, Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Discover", fontSize = 12.sp)
                    }
                }
            }

            // Capabilities section
            SettingsSectionCard(
                title = "Device Capabilities",
                icon = Icons.Default.PhoneAndroid,
                expanded = expandedSection == "capabilities",
                onToggle = { expandedSection = if (expandedSection == "capabilities") null else "capabilities" },
            ) {
                CapToggle("Camera", Icons.Default.CameraAlt, cameraEnabled) { viewModel.setCapability("camera", it) }
                CapToggle("Location", Icons.Default.LocationOn, locationEnabled) { viewModel.setCapability("location", it) }
                CapToggle("SMS", Icons.Default.Sms, smsEnabled) { viewModel.setCapability("sms", it) }
                CapToggle("Contacts", Icons.Default.Contacts, contactsEnabled) { viewModel.setCapability("contacts", it) }
                CapToggle("Calendar", Icons.Default.CalendarMonth, calendarEnabled) { viewModel.setCapability("calendar", it) }
                CapToggle("Microphone", Icons.Default.Mic, micEnabled) { viewModel.setCapability("microphone", it) }
                CapToggle("Motion", Icons.Default.DirectionsRun, motionEnabled) { viewModel.setCapability("motion", it) }
            }

            // Voice & TTS section
            SettingsSectionCard(
                title = "Voice & TTS",
                icon = Icons.Default.RecordVoiceOver,
                expanded = expandedSection == "voice",
                onToggle = { expandedSection = if (expandedSection == "voice") null else "voice" },
            ) {
                SettingsInfoRow("Wake Word", "\"Hey CoreBlow\"")
                SettingsInfoRow("TTS Voice", "Alloy")
                SettingsInfoRow("TTS Speed", "1.0x")
                SettingsInfoRow("Language", "Auto")
            }

            // Debug section
            SettingsSectionCard(
                title = "Developer",
                icon = Icons.Default.Code,
                expanded = expandedSection == "debug",
                onToggle = { expandedSection = if (expandedSection == "debug") null else "debug" },
            ) {
                CapToggle("Debug Mode", Icons.Default.BugReport, debugMode) { viewModel.setDebugMode(it) }
                SettingsInfoRow("Device", deviceModel)
                SettingsInfoRow("Version", appVersion)
                SettingsInfoRow("Device ID", deviceId.take(12) + "…")
                SettingsInfoRow("Protocol", "1.0.0")
            }

            // Danger zone
            if (showClearConfirm) {
                AlertDialog(
                    onDismissRequest = { showClearConfirm = false },
                    title = { Text("Clear All Data?") },
                    text = { Text("This will remove all conversations, settings, and cached data. This cannot be undone.") },
                    confirmButton = {
                        Button(
                            onClick = { viewModel.clearAllData(); showClearConfirm = false; onDismiss() },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        ) { Text("Clear Everything") }
                    },
                    dismissButton = { TextButton(onClick = { showClearConfirm = false }) { Text("Cancel") } },
                )
            }

            OutlinedButton(
                onClick = { showClearConfirm = true },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
                Icon(Icons.Default.DeleteForever, null, Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Clear All Data")
            }
        }
    }
}

// ============================================================
// Reusable components
// ============================================================

@Composable
private fun SettingsSectionCard(
    title: String,
    icon: ImageVector,
    expanded: Boolean = true,
    onToggle: () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(6.dp))
                    Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = onToggle, modifier = Modifier.size(24.dp)) {
                    Icon(
                        if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        "Toggle",
                        Modifier.size(18.dp),
                    )
                }
            }
            AnimatedVisibility(visible = expanded) {
                Column(Modifier.padding(top = 8.dp)) { content() }
            }
        }
    }
}

@Composable
private fun CapToggle(label: String, icon: ImageVector, checked: Boolean, onChanged: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(6.dp))
            Text(label, fontSize = 13.sp)
        }
        Switch(checked = checked, onCheckedChange = onChanged, modifier = Modifier.height(28.dp))
    }
}

@Composable
private fun SettingsInfoRow(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
