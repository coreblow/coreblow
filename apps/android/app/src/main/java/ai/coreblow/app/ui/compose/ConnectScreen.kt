package ai.coreblow.app.ui.compose

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.viewmodel.GatewayViewModel

/**
 * Gateway connection screen.
 *
 * Shows discovered endpoints, manual connection form, and current connection status.
 */
@Composable
fun ConnectScreen(viewModel: GatewayViewModel) {
    val connectionState by viewModel.connectionState.collectAsState()
    val connectedEndpoint by viewModel.connectedEndpoint.collectAsState()
    val discoveredEndpoints by viewModel.discoveredEndpoints.collectAsState()
    val isScanning by viewModel.isScanning.collectAsState()
    val manualHost by viewModel.manualHost.collectAsState()
    val manualPort by viewModel.manualPort.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Connection Status
        item {
            ConnectionStatusCard(connectionState, connectedEndpoint) {
                viewModel.disconnect()
            }
        }

        // Error Message
        if (errorMessage != null) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Text(
                        text = errorMessage ?: "",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
            }
        }

        // Discovered Endpoints
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Discovered Gateways", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.weight(1f))
                if (isScanning) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                }
                OutlinedButton(onClick = {
                    if (isScanning) viewModel.stopDiscovery() else viewModel.startDiscovery()
                }) {
                    Text(if (isScanning) "Stop" else "Scan")
                }
            }
        }

        items(discoveredEndpoints) { endpoint ->
            EndpointCard(endpoint, connectionState) { viewModel.connect(endpoint) }
        }

        if (discoveredEndpoints.isEmpty() && !isScanning) {
            item {
                Text(
                    "No gateways found. Tap Scan or enter manually.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Manual Connection
        item {
            Text("Manual Connection", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = manualHost,
                    onValueChange = { viewModel.setManualHost(it) },
                    label = { Text("Host") },
                    modifier = Modifier.weight(2f),
                    singleLine = true,
                )
                OutlinedTextField(
                    value = manualPort,
                    onValueChange = { viewModel.setManualPort(it) },
                    label = { Text("Port") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                )
            }
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { viewModel.connectManual() },
                modifier = Modifier.fillMaxWidth(),
                enabled = connectionState != GatewayConnectionState.CONNECTING,
            ) {
                Text("Connect")
            }
        }
    }
}

@Composable
private fun ConnectionStatusCard(
    state: GatewayConnectionState,
    endpoint: GatewayEndpoint?,
    onDisconnect: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusDot(
                    isActive = state == GatewayConnectionState.CONNECTED,
                    modifier = Modifier.size(12.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = when (state) {
                        GatewayConnectionState.CONNECTED -> "Connected"
                        GatewayConnectionState.CONNECTING -> "Connecting..."
                        GatewayConnectionState.AUTHENTICATING -> "Authenticating..."
                        GatewayConnectionState.RECONNECTING -> "Reconnecting..."
                        GatewayConnectionState.DISCONNECTED -> "Disconnected"
                    },
                    style = MaterialTheme.typography.titleSmall,
                )
            }
            if (endpoint != null) {
                Text(
                    text = endpoint.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onDisconnect) { Text("Disconnect") }
            }
        }
    }
}

@Composable
private fun EndpointCard(
    endpoint: GatewayEndpoint,
    connectionState: GatewayConnectionState,
    onConnect: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(endpoint.label, style = MaterialTheme.typography.bodyLarge)
                Text(
                    "${endpoint.host}:${endpoint.port}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Button(
                onClick = onConnect,
                enabled = connectionState == GatewayConnectionState.DISCONNECTED,
            ) {
                Text("Connect")
            }
        }
    }
}
