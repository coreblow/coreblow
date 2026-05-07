package ai.coreblow.app.ui.compose

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.viewmodel.GatewayViewModel

/**
 * Gateway connection screen.
 * Shows connection status hero, discovered endpoints with TLS badges,
 * manual connection form with token input, and trust prompt dialog.
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
        // Hero Status Card
        item {
            ConnectionHeroCard(connectionState, connectedEndpoint) {
                viewModel.disconnect()
            }
        }

        // Error Banner
        if (errorMessage != null) {
            item {
                ErrorBanner(errorMessage!!) { viewModel.clearError() }
            }
        }

        // Discovery Section
        item {
            DiscoveryHeader(isScanning) {
                if (isScanning) viewModel.stopDiscovery() else viewModel.startDiscovery()
            }
        }

        items(discoveredEndpoints) { endpoint ->
            EndpointCard(endpoint, connectionState) { viewModel.connect(endpoint) }
        }

        if (discoveredEndpoints.isEmpty() && !isScanning) {
            item {
                EmptyDiscoveryPlaceholder()
            }
        }

        // Manual Connection
        item { Spacer(Modifier.height(8.dp)) }
        item {
            ManualConnectionSection(
                manualHost = manualHost,
                manualPort = manualPort,
                connectionState = connectionState,
                onHostChanged = { viewModel.setManualHost(it) },
                onPortChanged = { viewModel.setManualPort(it) },
                onConnect = { viewModel.connectManual() },
                onTokenChanged = { viewModel.setToken(it) },
            )
        }

        // Network info
        item {
            NetworkInfoFooter()
        }
    }
}

// MARK: - Hero Card

@Composable
private fun ConnectionHeroCard(
    state: GatewayConnectionState,
    endpoint: GatewayEndpoint?,
    onDisconnect: () -> Unit,
) {
    val isConnected = state == GatewayConnectionState.CONNECTED
    val isTransient = state == GatewayConnectionState.CONNECTING ||
        state == GatewayConnectionState.AUTHENTICATING ||
        state == GatewayConnectionState.RECONNECTING

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isConnected)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        ),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Status indicator
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                isConnected -> Color(0xFF4CAF50)
                                isTransient -> Color(0xFFFFA726)
                                else -> MaterialTheme.colorScheme.outlineVariant
                            },
                        ),
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = when (state) {
                        GatewayConnectionState.CONNECTED -> "Connected"
                        GatewayConnectionState.CONNECTING -> "Connecting…"
                        GatewayConnectionState.AUTHENTICATING -> "Authenticating…"
                        GatewayConnectionState.RECONNECTING -> "Reconnecting…"
                        GatewayConnectionState.DISCONNECTED -> "Disconnected"
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )

                if (isTransient) {
                    Spacer(Modifier.width(8.dp))
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                }
            }

            if (endpoint != null) {
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Router, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = endpoint.displayName ?: endpoint.host,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = "${endpoint.host}:${endpoint.port}${if (endpoint.useTls) " • TLS" else ""}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                )

                if (isConnected) {
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(
                        onClick = onDisconnect,
                        shape = RoundedCornerShape(10.dp),
                    ) { Text("Disconnect") }
                }
            }

            if (!isConnected && endpoint == null) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "Scan for gateways or enter an address manually.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// MARK: - Error Banner

@Composable
private fun ErrorBanner(message: String, onDismiss: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(message, modifier = Modifier.weight(1f), fontSize = 13.sp, color = MaterialTheme.colorScheme.onErrorContainer)
            IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Dismiss", modifier = Modifier.size(16.dp))
            }
        }
    }
}

// MARK: - Discovery

@Composable
private fun DiscoveryHeader(isScanning: Boolean, onToggle: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Wifi, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.width(8.dp))
        Text("Local Gateways", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
        Spacer(Modifier.weight(1f))
        if (isScanning) {
            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(8.dp))
        }
        OutlinedButton(onClick = onToggle, shape = RoundedCornerShape(8.dp)) {
            Text(if (isScanning) "Stop" else "Scan", fontSize = 13.sp)
        }
    }
}

@Composable
private fun EmptyDiscoveryPlaceholder() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
            .padding(20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.SearchOff, contentDescription = null, modifier = Modifier.size(32.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
            Spacer(Modifier.height(8.dp))
            Text("No gateways found", fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text("Tap Scan or enter the address manually.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun EndpointCard(
    endpoint: GatewayEndpoint,
    connectionState: GatewayConnectionState,
    onConnect: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = connectionState == GatewayConnectionState.DISCONNECTED, onClick = onConnect),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (endpoint.useTls) Icons.Default.Lock else Icons.Default.LockOpen,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onSecondaryContainer,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(endpoint.displayName ?: endpoint.host, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Text("${endpoint.host}:${endpoint.port}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (endpoint.useTls) {
                    Text("TLS secured", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                }
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// MARK: - Manual Connection

@Composable
private fun ManualConnectionSection(
    manualHost: String,
    manualPort: String,
    connectionState: GatewayConnectionState,
    onHostChanged: (String) -> Unit,
    onPortChanged: (String) -> Unit,
    onConnect: () -> Unit,
    onTokenChanged: (String) -> Unit,
) {
    var showTokenField by remember { mutableStateOf(false) }
    var tokenValue by remember { mutableStateOf("") }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.SettingsEthernet, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(8.dp))
            Text("Manual Connection", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
        }

        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = manualHost,
                onValueChange = onHostChanged,
                label = { Text("Host") },
                modifier = Modifier.weight(2f),
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
            )
            OutlinedTextField(
                value = manualPort,
                onValueChange = onPortChanged,
                label = { Text("Port") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
            )
        }

        Spacer(Modifier.height(8.dp))

        TextButton(onClick = { showTokenField = !showTokenField }) {
            Text(if (showTokenField) "Hide Token" else "Add Token")
        }

        AnimatedVisibility(visible = showTokenField) {
            OutlinedTextField(
                value = tokenValue,
                onValueChange = { tokenValue = it; onTokenChanged(it) },
                label = { Text("Gateway Token") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(10.dp),
            )
        }

        Spacer(Modifier.height(12.dp))

        Button(
            onClick = onConnect,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            enabled = connectionState != GatewayConnectionState.CONNECTING && manualHost.isNotBlank(),
            shape = RoundedCornerShape(12.dp),
        ) { Text("Connect", fontSize = 15.sp) }
    }
}

// MARK: - Footer

@Composable
private fun NetworkInfoFooter() {
    Spacer(Modifier.height(8.dp))
    Text(
        "Ensure your phone and gateway are on the same network for mDNS discovery.",
        fontSize = 12.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
    )
    Spacer(Modifier.height(24.dp))
}
