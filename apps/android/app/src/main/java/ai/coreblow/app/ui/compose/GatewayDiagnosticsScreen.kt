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
import ai.coreblow.app.gateway.GatewayConnectionState

/**
 * Gateway diagnostics screen showing connection health, latency,
 * event statistics, endpoint info, and protocol details.
 */
@Composable
fun GatewayDiagnosticsScreen(
    connectionState: GatewayConnectionState,
    endpointHost: String?,
    endpointPort: Int?,
    useTls: Boolean,
    protocolVersion: String,
    lastPingMs: Long?,
    eventCount: Long,
    missedEvents: Int,
    reconnectCount: Int,
    uptimeMs: Long,
    authMethod: String?,
    serverName: String?,
    onReconnect: () -> Unit,
    onDisconnect: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Gateway Diagnostics", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

        // Connection Card
        DiagCard("Connection") {
            DiagRow("Status", when (connectionState) {
                GatewayConnectionState.CONNECTED -> "✅ Connected"
                GatewayConnectionState.CONNECTING -> "🔄 Connecting…"
                GatewayConnectionState.AUTHENTICATING -> "🔐 Authenticating…"
                GatewayConnectionState.RECONNECTING -> "♻️ Reconnecting…"
                GatewayConnectionState.DISCONNECTED -> "❌ Disconnected"
            })
            DiagRow("Server", serverName ?: "Unknown")
            DiagRow("Endpoint", if (endpointHost != null) "$endpointHost:$endpointPort" else "—")
            DiagRow("TLS", if (useTls) "Enabled" else "Disabled")
            DiagRow("Auth", authMethod ?: "None")
            DiagRow("Protocol", "v$protocolVersion")
        }

        // Health Card
        DiagCard("Health") {
            DiagRow("Last Ping", if (lastPingMs != null) "${lastPingMs}ms" else "—")
            DiagRow("Uptime", formatUptime(uptimeMs))
            DiagRow("Events Received", eventCount.toString())
            DiagRow("Missed Events", missedEvents.toString())
            DiagRow("Reconnect Count", reconnectCount.toString())
        }

        // Actions
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = onReconnect,
                enabled = connectionState != GatewayConnectionState.CONNECTING,
                shape = RoundedCornerShape(10.dp),
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Reconnect")
            }
            OutlinedButton(
                onClick = onDisconnect,
                enabled = connectionState != GatewayConnectionState.DISCONNECTED,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
                Icon(Icons.Default.LinkOff, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Disconnect")
            }
        }
    }
}

@Composable
private fun DiagCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun DiagRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

private fun formatUptime(ms: Long): String {
    if (ms <= 0) return "—"
    val seconds = ms / 1000
    val minutes = seconds / 60
    val hours = minutes / 60
    return when {
        hours > 0 -> "${hours}h ${minutes % 60}m"
        minutes > 0 -> "${minutes}m ${seconds % 60}s"
        else -> "${seconds}s"
    }
}
