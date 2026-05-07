package ai.coreblow.app.ui.compose

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.voice.TalkModeState
import ai.coreblow.app.voice.VoiceConversationEntry
import ai.coreblow.app.voice.WakeState
import ai.coreblow.app.viewmodel.VoiceViewModel

/**
 * Full voice tab with animated orb, input level meter, conversation
 * history, wake word controls, speaker toggle, and live transcript.
 */
@Composable
fun VoiceTabScreen(viewModel: VoiceViewModel) {
    val wakeState by viewModel.wakeState.collectAsState()
    val talkState by viewModel.talkState.collectAsState()
    val lastTranscript by viewModel.lastTranscript.collectAsState()
    val inputLevel by viewModel.inputLevel.collectAsState()
    val isListening by viewModel.isListening.collectAsState()
    val isSpeaking by viewModel.isSpeaking.collectAsState()
    val speakerEnabled by viewModel.speakerEnabled.collectAsState()
    val conversationHistory by viewModel.conversationHistory.collectAsState()
    val micCooldown by viewModel.micCooldown.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.surface,
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
                    ),
                ),
            ),
    ) {
        // Top bar
        VoiceTopBar(
            speakerEnabled = speakerEnabled,
            onSpeakerToggle = { viewModel.toggleSpeaker() },
            wakeState = wakeState,
            onWakeToggle = {
                if (wakeState == WakeState.LISTENING) viewModel.stopWake() else viewModel.startWake()
            },
        )

        // Main content
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(32.dp))

            // Animated Orb
            TalkOrbIndicator(
                state = talkState,
                inputLevel = inputLevel,
                isListening = isListening,
            )

            Spacer(Modifier.height(24.dp))

            // Status text
            Text(
                text = when (talkState) {
                    TalkModeState.INACTIVE -> when {
                        wakeState == WakeState.LISTENING -> "Listening for wake word…"
                        micCooldown -> "Cooldown…"
                        else -> "Tap to talk"
                    }
                    TalkModeState.RECORDING -> "Listening…"
                    TalkModeState.PROCESSING -> "Thinking…"
                    TalkModeState.SPEAKING -> "Speaking…"
                    TalkModeState.ERROR -> "Something went wrong"
                },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
            )

            // Live transcript
            AnimatedVisibility(
                visible = lastTranscript.isNotBlank(),
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                Text(
                    text = lastTranscript,
                    modifier = Modifier.padding(horizontal = 32.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Spacer(Modifier.height(16.dp))

            // Input level bar
            if (isListening || talkState == TalkModeState.RECORDING) {
                InputLevelBar(level = inputLevel)
                Spacer(Modifier.height(16.dp))
            }

            // Conversation history
            if (conversationHistory.isNotEmpty()) {
                ConversationHistory(
                    entries = conversationHistory,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .padding(horizontal = 16.dp),
                )
            } else {
                Spacer(Modifier.weight(1f))
            }
        }

        // Bottom controls
        VoiceControls(
            talkState = talkState,
            micCooldown = micCooldown,
            onStartRecording = { viewModel.startRecording() },
            onStopRecording = { viewModel.stopRecording() },
            onStopSpeaking = { viewModel.stopSpeaking() },
        )
    }
}

// MARK: - Top Bar

@Composable
private fun VoiceTopBar(
    speakerEnabled: Boolean,
    onSpeakerToggle: () -> Unit,
    wakeState: WakeState,
    onWakeToggle: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Wake word toggle
        FilterChip(
            selected = wakeState == WakeState.LISTENING,
            onClick = onWakeToggle,
            label = { Text(if (wakeState == WakeState.LISTENING) "Wake On" else "Wake Off", fontSize = 12.sp) },
            leadingIcon = {
                Icon(
                    if (wakeState == WakeState.LISTENING) Icons.Default.Hearing else Icons.Default.HearingDisabled,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
            },
        )

        // Speaker toggle
        IconButton(onClick = onSpeakerToggle) {
            Icon(
                if (speakerEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                contentDescription = if (speakerEnabled) "Speaker on" else "Speaker off",
                tint = if (speakerEnabled) MaterialTheme.colorScheme.primary
                       else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// MARK: - Orb

@Composable
private fun TalkOrbIndicator(
    state: TalkModeState,
    inputLevel: Float,
    isListening: Boolean,
) {
    val isActive = state == TalkModeState.RECORDING || state == TalkModeState.SPEAKING
    val infiniteTransition = rememberInfiniteTransition(label = "orb_pulse")

    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (isActive) 1.08f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = EaseInOutCubic),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse",
    )

    val ringAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = if (state == TalkModeState.PROCESSING) 0.8f else 0.3f,
        animationSpec = infiniteRepeatable(
            animation = tween(600),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "ring",
    )

    val baseColor = when (state) {
        TalkModeState.RECORDING -> MaterialTheme.colorScheme.error
        TalkModeState.PROCESSING -> MaterialTheme.colorScheme.tertiary
        TalkModeState.SPEAKING -> MaterialTheme.colorScheme.primary
        TalkModeState.ERROR -> MaterialTheme.colorScheme.error.copy(alpha = 0.5f)
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val levelScale = 1f + (inputLevel * 0.15f)

    Box(contentAlignment = Alignment.Center) {
        // Outer ring
        if (isActive || state == TalkModeState.PROCESSING) {
            Canvas(
                modifier = Modifier
                    .size(140.dp)
                    .alpha(ringAlpha),
            ) {
                drawCircle(
                    color = baseColor,
                    radius = size.minDimension / 2,
                    style = Stroke(width = 3.dp.toPx()),
                )
            }
        }

        // Main orb
        Canvas(
            modifier = Modifier
                .size(120.dp)
                .scale(pulseScale * levelScale),
        ) {
            drawCircle(color = baseColor, radius = size.minDimension / 2)
        }

        // Center icon
        Icon(
            imageVector = when (state) {
                TalkModeState.RECORDING -> Icons.Default.Mic
                TalkModeState.PROCESSING -> Icons.Default.Psychology
                TalkModeState.SPEAKING -> Icons.Default.RecordVoiceOver
                TalkModeState.ERROR -> Icons.Default.ErrorOutline
                else -> Icons.Default.MicNone
            },
            contentDescription = null,
            modifier = Modifier.size(36.dp),
            tint = Color.White,
        )
    }
}

// MARK: - Input Level

@Composable
private fun InputLevelBar(level: Float) {
    Box(
        modifier = Modifier
            .width(200.dp)
            .height(6.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction = level.coerceIn(0f, 1f))
                .clip(RoundedCornerShape(3.dp))
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primary,
                            MaterialTheme.colorScheme.tertiary,
                        ),
                    ),
                ),
        )
    }
}

// MARK: - Conversation

@Composable
private fun ConversationHistory(entries: List<VoiceConversationEntry>, modifier: Modifier = Modifier) {
    val listState = rememberLazyListState()

    LaunchedEffect(entries.size) {
        if (entries.isNotEmpty()) listState.animateScrollToItem(entries.lastIndex)
    }

    LazyColumn(
        state = listState,
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(entries) { entry ->
            val isUser = entry.role == "user"
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
            ) {
                Surface(
                    shape = RoundedCornerShape(
                        topStart = 16.dp, topEnd = 16.dp,
                        bottomStart = if (isUser) 16.dp else 4.dp,
                        bottomEnd = if (isUser) 4.dp else 16.dp,
                    ),
                    color = if (isUser) MaterialTheme.colorScheme.primaryContainer
                            else MaterialTheme.colorScheme.secondaryContainer,
                    modifier = Modifier.widthIn(max = 280.dp),
                ) {
                    Text(
                        text = entry.text,
                        modifier = Modifier.padding(12.dp),
                        fontSize = 14.sp,
                        color = if (isUser) MaterialTheme.colorScheme.onPrimaryContainer
                               else MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                }
            }
        }
    }
}

// MARK: - Controls

@Composable
private fun VoiceControls(
    talkState: TalkModeState,
    micCooldown: Boolean,
    onStartRecording: () -> Unit,
    onStopRecording: () -> Unit,
    onStopSpeaking: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        when (talkState) {
            TalkModeState.RECORDING -> {
                FilledTonalButton(
                    onClick = onStopRecording,
                    modifier = Modifier.height(52.dp).width(160.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                    ),
                ) {
                    Icon(Icons.Default.Stop, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Stop", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
            TalkModeState.SPEAKING -> {
                OutlinedButton(
                    onClick = onStopSpeaking,
                    modifier = Modifier.height(52.dp).width(160.dp),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Icon(Icons.Default.VolumeOff, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Silence", fontSize = 15.sp)
                }
            }
            TalkModeState.PROCESSING -> {
                Box(modifier = Modifier.height(52.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
                }
            }
            else -> {
                Button(
                    onClick = onStartRecording,
                    modifier = Modifier.height(52.dp).width(160.dp),
                    shape = RoundedCornerShape(16.dp),
                    enabled = !micCooldown,
                ) {
                    Icon(Icons.Default.Mic, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Talk", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
