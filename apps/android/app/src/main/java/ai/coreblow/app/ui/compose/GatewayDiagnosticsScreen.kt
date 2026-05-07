package ai.coreblow.app.ui.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.formatter.ByteFormatter
import ai.coreblow.app.gateway.ProtocolState

/**
 * Gateway diagnostics screen showing connection health,
 * latency, message throughput, error rates, and protocol state.
 */
@Composable
fun GatewayDiagnosticsScreen(
    protocolState: ProtocolState = ProtocolState.IDLE,
    latencyMs: Int = 0,
    messagesReceived: Long = 0,
    messagesSent: Long = 0,
    errorsCount: Long = 0,
    gatewayHost: String = "",
    gatewayPort: Int = 18789,
    serverVersion: String = "",
    sessionId: String? = null,
    uptimeMs: Long = 0,
    onReconnect: () -> Unit = {},
    onDisconnect: () -> Unit = {},
    onPing: () -> Unit = {},
    onClearErrors: () -> Unit = {},
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Insights, null, Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(8.dp))
            Text("Gateway Diagnostics", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }

        // Connection status card
        DiagCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(
                            when (protocolState) {
                                ProtocolState.READY -> MobileUiTokens.Online
                                ProtocolState.AUTHENTICATING -> MobileUiTokens.Connecting
                                ProtocolState.DISCONNECTED, ProtocolState.AUTH_FAILED -> MobileUiTokens.Offline
                                else -> MobileUiTokens.Idle
                            },
                        ),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    when (protocolState) {
                        ProtocolState.IDLE -> "Idle"
                        ProtocolState.AUTHENTICATING -> "Authenticating…"
                        ProtocolState.READY -> "Connected"
                        ProtocolState.AUTH_FAILED -> "Auth Failed"
                        ProtocolState.CLOSING -> "Closing…"
                        ProtocolState.DISCONNECTED -> "Disconnected"
                    },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(Modifier.height(8.dp))
            DiagRow("Host", "$gatewayHost:$gatewayPort")
            DiagRow("Server", serverVersion.ifBlank { "Unknown" })
            DiagRow("Session", sessionId?.take(12)?.plus("…") ?: "—")
            DiagRow("Uptime", ByteFormatter.formatDuration(uptimeMs))
        }

        // Metrics card
        DiagCard {
            Text("Metrics", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(6.dp))
            DiagRow("Latency", if (latencyMs > 0) "${latencyMs}ms" else "—")
            DiagRow("Messages Sent", ByteFormatter.formatNumber(messagesSent))
            DiagRow("Messages Received", ByteFormatter.formatNumber(messagesReceived))
            DiagRow("Errors", "$errorsCount")
            DiagRow("Error Rate", if (messagesReceived > 0) ByteFormatter.formatPercent(errorsCount.toDouble() / messagesReceived * 100) else "—")
        }

        // Latency indicator
        if (latencyMs > 0) {
            DiagCard {
                Text("Latency", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { (latencyMs.toFloat() / 500f).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                    color = when {
                        latencyMs < 50 -> MobileUiTokens.BrandSuccess
                        latencyMs < 200 -> MobileUiTokens.BrandWarning
                        else -> MobileUiTokens.BrandError
                    },
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    when {
                        latencyMs < 50 -> "Excellent (${latencyMs}ms)"
                        latencyMs < 200 -> "Good (${latencyMs}ms)"
                        else -> "Slow (${latencyMs}ms)"
                    },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Actions
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (protocolState == ProtocolState.READY) {
                FilledTonalButton(onClick = onPing, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.NetworkPing, null, Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Ping", fontSize = 12.sp)
                }
                OutlinedButton(onClick = onDisconnect, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.LinkOff, null, Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Disconnect", fontSize = 12.sp)
                }
            } else {
                FilledTonalButton(onClick = onReconnect, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.Refresh, null, Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Reconnect", fontSize = 12.sp)
                }
            }
        }

        if (errorsCount > 0) {
            TextButton(onClick = onClearErrors) {
                Text("Clear Errors ($errorsCount)", fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun DiagCard(content: @Composable ColumnScope.() -> Unit) {
    Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) { content() }
    }
}

@Composable
private fun DiagRow(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Medium, fontFamily = FontFamily.Monospace)
    }
}
