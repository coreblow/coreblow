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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.coreblow.app.voice.TalkModeState
import ai.coreblow.app.voice.WakeState
import ai.coreblow.app.viewmodel.VoiceViewModel

/**
 * Voice tab screen for wake word and talk mode interaction.
 */
@Composable
fun VoiceTabScreen(viewModel: VoiceViewModel) {
    val wakeState by viewModel.wakeState.collectAsState()
    val talkState by viewModel.talkState.collectAsState()
    val lastTranscript by viewModel.lastTranscript.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Orb indicator
        TalkOrbIndicator(talkState)

        Spacer(Modifier.height(32.dp))

        // State label
        Text(
            text = when (talkState) {
                TalkModeState.INACTIVE -> if (wakeState == WakeState.LISTENING) "Listening for wake word..." else "Voice Inactive"
                TalkModeState.RECORDING -> "Recording..."
                TalkModeState.PROCESSING -> "Processing..."
                TalkModeState.SPEAKING -> "Speaking..."
                TalkModeState.ERROR -> "Error occurred"
            },
            style = MaterialTheme.typography.titleMedium,
        )

        Spacer(Modifier.height(8.dp))

        if (lastTranscript.isNotBlank()) {
            Text(
                text = lastTranscript,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(32.dp))

        // Controls
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            when {
                talkState == TalkModeState.RECORDING -> {
                    Button(onClick = { viewModel.stopRecording() }) { Text("Stop") }
                }
                talkState == TalkModeState.INACTIVE -> {
                    Button(onClick = { viewModel.startRecording() }) { Text("Talk") }
                    OutlinedButton(onClick = {
                        if (wakeState == WakeState.LISTENING) viewModel.stopWake() else viewModel.startWake()
                    }) {
                        Text(if (wakeState == WakeState.LISTENING) "Wake Off" else "Wake On")
                    }
                }
                else -> {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp))
                }
            }
        }
    }
}

@Composable
private fun TalkOrbIndicator(state: TalkModeState) {
    val color = when (state) {
        TalkModeState.RECORDING -> MaterialTheme.colorScheme.error
        TalkModeState.PROCESSING -> MaterialTheme.colorScheme.tertiary
        TalkModeState.SPEAKING -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    androidx.compose.foundation.Canvas(modifier = Modifier.size(120.dp)) {
        drawCircle(color = color, radius = size.minDimension / 2)
    }
}
