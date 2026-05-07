package ai.coreblow.app.ui.compose

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.viewmodel.SettingsViewModel

/**
 * Settings bottom sheet with gateway config, capability toggles,
 * debug options, and clear data action.
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

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Settings", fontSize = 20.sp, fontWeight = FontWeight.Bold)

            // Gateway section
            SheetSectionCard("Gateway Connection") {
                OutlinedTextField(value = gatewayHost, onValueChange = { viewModel.setGatewayHost(it) }, label = { Text("Host") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = gatewayPort, onValueChange = { viewModel.setGatewayPort(it) }, label = { Text("Port") }, singleLine = true, modifier = Modifier.weight(1f))
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("TLS", fontSize = 11.sp)
                        Switch(checked = useTls, onCheckedChange = { viewModel.setUseTls(it) })
                    }
                }
            }

            // Capabilities section
            SheetSectionCard("Device Capabilities") {
                CapToggle("Camera", cameraEnabled) { viewModel.setCapability("camera", it) }
                CapToggle("Location", locationEnabled) { viewModel.setCapability("location", it) }
                CapToggle("SMS", smsEnabled) { viewModel.setCapability("sms", it) }
                CapToggle("Contacts", contactsEnabled) { viewModel.setCapability("contacts", it) }
                CapToggle("Calendar", calendarEnabled) { viewModel.setCapability("calendar", it) }
                CapToggle("Microphone", micEnabled) { viewModel.setCapability("microphone", it) }
                CapToggle("Motion", motionEnabled) { viewModel.setCapability("motion", it) }
            }

            // Debug section
            SheetSectionCard("Developer") {
                CapToggle("Debug Mode", debugMode) { viewModel.setDebugMode(it) }
                SheetInfoRow("Device", deviceModel)
                SheetInfoRow("Version", appVersion)
                SheetInfoRow("Device ID", deviceId.take(12) + "…")
            }

            // Danger zone
            OutlinedButton(
                onClick = { viewModel.clearAllData(); onDismiss() },
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

@Composable
private fun SheetSectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(14.dp)) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun CapToggle(label: String, checked: Boolean, onChanged: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = 13.sp)
        Switch(checked = checked, onCheckedChange = onChanged, modifier = Modifier.height(28.dp))
    }
}

@Composable
private fun SheetInfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}
