package ai.coreblow.app.ui.compose.chat

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.ui.compose.MobileUiTokens

/**
 * Message composer bar with text input, attachment support,
 * send/abort controls, thinking indicator, and character count.
 */
@Composable
fun ChatComposer(
    onSend: (message: String, attachments: List<ComposerAttachment>) -> Unit,
    onAbort: () -> Unit,
    onPickAttachment: () -> Unit,
    healthOk: Boolean,
    pendingRunCount: Int,
    thinkingLevel: String,
    modifier: Modifier = Modifier,
    maxCharacters: Int = 10_000,
    showCharCount: Boolean = false,
    onVoiceInput: (() -> Unit)? = null,
) {
    var text by remember { mutableStateOf("") }
    val attachments = remember { mutableStateListOf<ComposerAttachment>() }
    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current
    val canSend = healthOk && (text.isNotBlank() || attachments.isNotEmpty()) && text.length <= maxCharacters
    val isRunning = pendingRunCount > 0
    val isOverLimit = text.length > maxCharacters

    Column(modifier = modifier.fillMaxWidth()) {
        // Thinking indicator
        AnimatedVisibility(visible = isRunning && thinkingLevel.isNotBlank()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 1.5.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    when (thinkingLevel) {
                        "thinking" -> "Thinking…"
                        "generating" -> "Generating response…"
                        "tool_call" -> "Using tools…"
                        else -> "Processing…"
                    },
                    fontSize = 11.sp,
                    color = MobileUiTokens.BrandAccent,
                )
                if (pendingRunCount > 1) {
                    Spacer(Modifier.width(4.dp))
                    Text("($pendingRunCount pending)", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // Attachment preview strip
        AnimatedVisibility(visible = attachments.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for ((index, att) in attachments.withIndex()) {
                    AttachmentChip(
                        name = att.fileName,
                        mimeType = att.mimeType,
                        onRemove = { attachments.removeAt(index) },
                    )
                }
            }
        }

        // Composer row
        Surface(tonalElevation = 2.dp) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                // Attachment button
                IconButton(onClick = onPickAttachment, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Default.Add, contentDescription = "Attach", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }

                // Text input
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(20.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                ) {
                    if (text.isEmpty()) {
                        Text(
                            text = when {
                                !healthOk -> "Connecting…"
                                isRunning -> "Waiting for response…"
                                else -> "Message"
                            },
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            fontSize = 14.sp,
                        )
                    }
                    BasicTextField(
                        value = text,
                        onValueChange = { text = it },
                        modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
                        textStyle = TextStyle(
                            fontSize = 14.sp,
                            color = if (isOverLimit) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                        ),
                        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = {
                            if (canSend) {
                                onSend(text.trim(), attachments.toList())
                                text = ""
                                attachments.clear()
                                keyboardController?.hide()
                            }
                        }),
                        maxLines = 6,
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                // Voice input button
                if (onVoiceInput != null && text.isEmpty() && !isRunning) {
                    IconButton(
                        onClick = onVoiceInput,
                        modifier = Modifier.size(40.dp),
                    ) {
                        Icon(Icons.Default.Mic, contentDescription = "Voice", tint = MaterialTheme.colorScheme.primary)
                    }
                }

                // Send / Abort button
                if (isRunning) {
                    IconButton(
                        onClick = onAbort,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.error),
                    ) {
                        Icon(Icons.Default.Stop, contentDescription = "Abort", tint = MaterialTheme.colorScheme.onError)
                    }
                } else {
                    IconButton(
                        onClick = {
                            if (canSend) {
                                onSend(text.trim(), attachments.toList())
                                text = ""
                                attachments.clear()
                                keyboardController?.hide()
                            }
                        },
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(
                                if (canSend) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.surfaceVariant,
                            ),
                        enabled = canSend,
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send",
                            tint = if (canSend) MaterialTheme.colorScheme.onPrimary
                            else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                        )
                    }
                }
            }
        }

        // Character count & status
        AnimatedVisibility(visible = showCharCount && text.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                Text(
                    "${text.length}/$maxCharacters",
                    fontSize = 10.sp,
                    color = if (isOverLimit) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun AttachmentChip(name: String, mimeType: String, onRemove: () -> Unit) {
    val icon = when {
        mimeType.startsWith("image/") -> Icons.Default.Image
        mimeType.startsWith("audio/") -> Icons.Default.AudioFile
        mimeType.startsWith("video/") -> Icons.Default.VideoFile
        mimeType == "application/pdf" -> Icons.Default.PictureAsPdf
        else -> Icons.Default.AttachFile
    }

    Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
        Row(
            modifier = Modifier.padding(start = 8.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer)
            Spacer(Modifier.width(4.dp))
            Text(
                text = name.take(20),
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            IconButton(onClick = onRemove, modifier = Modifier.size(20.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(14.dp))
            }
        }
    }
}

data class ComposerAttachment(
    val type: String,
    val mimeType: String,
    val fileName: String,
    val base64: String,
    val sizeBytes: Long = 0,
    val uri: String? = null,
)

// MARK: - OC-parity composables

@Composable
fun AttachmentsStrip(
    attachments: List<ComposerAttachment>,
    onRemove: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (attachments.isEmpty()) return
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        attachments.forEachIndexed { index, att ->
            AttachmentChip(
                name = att.fileName,
                mimeType = att.mimeType,
                onRemove = { onRemove(index) },
            )
        }
    }
}

@Composable
fun SecondaryActionButton(
    icon: @Composable () -> Unit,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    IconButton(
        onClick = onClick,
        modifier = modifier.size(36.dp),
        enabled = enabled,
    ) {
        icon()
    }
}

@Composable
fun ThinkingMenuItem(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, fontSize = 13.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal)
                if (isSelected) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                }
            }
        },
        onClick = onClick,
    )
}

@Composable
private fun chatTextFieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
    focusedIndicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
    unfocusedIndicatorColor = MaterialTheme.colorScheme.outlineVariant,
    cursorColor = MaterialTheme.colorScheme.primary,
    focusedTextColor = MaterialTheme.colorScheme.onSurface,
    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
)

private fun thinkingLabel(level: String): String = when (level) {
    "thinking" -> "Thinking…"
    "generating" -> "Generating response…"
    "tool_call" -> "Using tools…"
    "searching" -> "Searching…"
    "code_interpreter" -> "Running code…"
    else -> "Processing…"
}
