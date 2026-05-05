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
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.viewmodel.GatewayViewModel

/**
 * Gateway diagnostics screen showing connection health and node capabilities.
 */
@Composable
fun GatewayDiagnosticsScreen(viewModel: GatewayViewModel) {
    val connectionState by viewModel.connectionState.collectAsState()
    val endpoint by viewModel.connectedEndpoint.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Gateway Diagnostics", style = MaterialTheme.typography.headlineSmall)

        DiagnosticRow("Status", connectionState.name)
        DiagnosticRow("Endpoint", endpoint?.label ?: "None")
        DiagnosticRow("Stable ID", endpoint?.stableId ?: "—")
        DiagnosticRow("TLS", if (endpoint?.useTls == true) "Enabled" else "Disabled")
        DiagnosticRow("Source", endpoint?.source?.name ?: "—")
        DiagnosticRow("WebSocket URL", endpoint?.wsUrl ?: "—")
    }
}

@Composable
private fun DiagnosticRow(label: String, value: String) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(12.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.width(120.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(text = value, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
