package ai.coreblow.app.ui.compose

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.viewmodel.GatewayViewModel
import ai.coreblow.app.viewmodel.SettingsViewModel

/**
 * Settings sheet with gateway configuration and voice wake preferences.
 */
@Composable
fun SettingsSheet(
    viewModel: SettingsViewModel,
    gatewayViewModel: GatewayViewModel,
) {
    val connectionState by gatewayViewModel.connectionState.collectAsState()
    val endpoint by gatewayViewModel.connectedEndpoint.collectAsState()
    val voiceWakeEnabled by viewModel.voiceWakeEnabled.collectAsState()
    val wakePhrase by viewModel.wakePhrase.collectAsState()
    val sensitivity by viewModel.wakeSensitivity.collectAsState()
    val haptic by viewModel.hapticFeedback.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall)

        // Gateway Section
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Gateway", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                Row { Text("Status: ", style = MaterialTheme.typography.bodyMedium); Text(connectionState.name) }
                if (endpoint != null) {
                    Row { Text("Endpoint: ", style = MaterialTheme.typography.bodyMedium); Text(endpoint!!.label) }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { gatewayViewModel.disconnect() }) { Text("Disconnect") }
                }
            }
        }

        // Voice Wake Section
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Voice Wake", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Enable Wake Word")
                    Switch(checked = voiceWakeEnabled, onCheckedChange = { viewModel.setVoiceWakeEnabled(it) })
                }
                OutlinedTextField(value = wakePhrase, onValueChange = { viewModel.setWakePhrase(it) }, label = { Text("Wake Phrase") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Spacer(Modifier.height(8.dp))
                Text("Sensitivity: ${"%.0f".format(sensitivity * 100)}%")
                Slider(value = sensitivity, onValueChange = { viewModel.setWakeSensitivity(it) }, valueRange = 0.1f..1.0f)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Haptic Feedback")
                    Switch(checked = haptic, onCheckedChange = { viewModel.setHapticFeedback(it) })
                }
            }
        }
    }
}
