package ai.coreblow.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Full settings sheet with device config, gateway connection,
 * permissions, voice wake, and debug sections.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(
    displayName: String,
    cameraEnabled: Boolean,
    locationMode: String,
    locationPreciseEnabled: Boolean,
    preventSleep: Boolean,
    manualEnabled: Boolean,
    manualHost: String,
    manualPort: Int,
    manualTls: Boolean,
    gatewayToken: String,
    canvasDebugStatusEnabled: Boolean,
    speakerEnabled: Boolean,
    onDisplayNameChanged: (String) -> Unit,
    onCameraEnabledChanged: (Boolean) -> Unit,
    onLocationModeChanged: (String) -> Unit,
    onLocationPreciseChanged: (Boolean) -> Unit,
    onPreventSleepChanged: (Boolean) -> Unit,
    onManualEnabledChanged: (Boolean) -> Unit,
    onManualHostChanged: (String) -> Unit,
    onManualPortChanged: (Int) -> Unit,
    onManualTlsChanged: (Boolean) -> Unit,
    onGatewayTokenChanged: (String) -> Unit,
    onCanvasDebugChanged: (Boolean) -> Unit,
    onSpeakerEnabledChanged: (Boolean) -> Unit,
    onDisconnect: () -> Unit,
    onDismiss: () -> Unit,
    isConnected: Boolean,
    serverName: String?,
    remoteAddress: String?,
    instanceId: String,
    appVersion: String,
) {
    val scrollState = rememberScrollState()

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 8.dp),
        ) {
            // Header
            Text("Settings", fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(16.dp))

            // MARK: - Device Section
            SettingsSectionHeader(title = "Device", icon = Icons.Default.PhoneAndroid)

            var editingName by remember { mutableStateOf(displayName) }
            OutlinedTextField(
                value = editingName,
                onValueChange = { editingName = it },
                label = { Text("Device Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            LaunchedEffect(editingName) {
                kotlinx.coroutines.delay(500)
                if (editingName != displayName) onDisplayNameChanged(editingName)
            }

            Spacer(modifier = Modifier.height(8.dp))
            SettingsToggle("Camera Access", cameraEnabled, onCameraEnabledChanged, Icons.Default.CameraAlt)
            SettingsToggle("Precise Location", locationPreciseEnabled, onLocationPreciseChanged, Icons.Default.MyLocation)
            SettingsToggle("Prevent Sleep", preventSleep, onPreventSleepChanged, Icons.Default.BedtimeOff)
            SettingsToggle("Speaker", speakerEnabled, onSpeakerEnabledChanged, Icons.Default.VolumeUp)

            Spacer(modifier = Modifier.height(16.dp))

            // MARK: - Gateway Section
            SettingsSectionHeader(title = "Gateway", icon = Icons.Default.Cloud)

            if (isConnected) {
                SettingsInfoRow("Server", serverName ?: "—")
                SettingsInfoRow("Address", remoteAddress ?: "—")

                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = onDisconnect,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Disconnect")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            SettingsToggle("Manual Connection", manualEnabled, onManualEnabledChanged, Icons.Default.SettingsEthernet)

            if (manualEnabled) {
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = manualHost,
                    onValueChange = onManualHostChanged,
                    label = { Text("Host") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = manualPort.toString(),
                    onValueChange = { it.toIntOrNull()?.let(onManualPortChanged) },
                    label = { Text("Port") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                SettingsToggle("TLS", manualTls, onManualTlsChanged, Icons.Default.Lock)
            }

            Spacer(modifier = Modifier.height(8.dp))
            var editingToken by remember { mutableStateOf(gatewayToken) }
            OutlinedTextField(
                value = editingToken,
                onValueChange = { editingToken = it; onGatewayTokenChanged(it) },
                label = { Text("Gateway Token") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(modifier = Modifier.height(16.dp))

            // MARK: - Debug Section
            SettingsSectionHeader(title = "Debug", icon = Icons.Default.BugReport)
            SettingsToggle("Canvas Debug Status", canvasDebugStatusEnabled, onCanvasDebugChanged, Icons.Default.Code)
            SettingsInfoRow("Instance ID", instanceId)
            SettingsInfoRow("Version", appVersion)

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SettingsSectionHeader(title: String, icon: ImageVector) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun SettingsToggle(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit, icon: ImageVector) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable { onCheckedChange(!checked) }
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.width(10.dp))
            Text(label, fontSize = 14.sp)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun SettingsInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}
