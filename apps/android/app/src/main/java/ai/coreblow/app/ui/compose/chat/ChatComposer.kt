package ai.coreblow.app.ui.compose.chat

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.coreblow.app.gateway.GatewayConnectionState
import ai.coreblow.app.ui.compose.MobileUiTokens
import ai.coreblow.app.ui.compose.StatusDot
import ai.coreblow.app.viewmodel.ChatViewModel
import ai.coreblow.app.viewmodel.GatewayViewModel

/**
 * Chat message composer with gateway mode indicator.
 */
@Composable
fun ChatComposer(
    chatViewModel: ChatViewModel,
    gatewayViewModel: GatewayViewModel,
) {
    val messageInput by chatViewModel.messageInput.collectAsState()
    val isLoading by chatViewModel.isLoading.collectAsState()
    val isGatewayMode by chatViewModel.isGatewayMode.collectAsState()
    val connectionState by gatewayViewModel.connectionState.collectAsState()

    Column(modifier = Modifier.fillMaxWidth().padding(MobileUiTokens.spacingSm)) {
        // Gateway mode indicator
        if (isGatewayMode) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 4.dp),
            ) {
                StatusDot(isActive = connectionState == GatewayConnectionState.CONNECTED, modifier = Modifier.size(8.dp))
                Spacer(Modifier.width(4.dp))
                Text("Gateway Mode", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            }
        }

        Row(verticalAlignment = Alignment.Bottom) {
            OutlinedTextField(
                value = messageInput,
                onValueChange = { chatViewModel.setMessageInput(it) },
                placeholder = { Text("Type a message...") },
                modifier = Modifier.weight(1f),
                maxLines = 4,
                enabled = !isLoading,
            )
            Spacer(Modifier.width(8.dp))
            Button(
                onClick = { chatViewModel.sendMessage(messageInput) },
                enabled = messageInput.isNotBlank() && !isLoading,
            ) {
                if (isLoading) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("Send")
            }
        }
    }
}
