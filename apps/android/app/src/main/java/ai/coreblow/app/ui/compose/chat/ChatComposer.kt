package ai.coreblow.app.ui.compose.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Stop
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Message composer bar with text input, attachment support,
 * send/abort controls, and pending run indicator.
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
) {
    var text by remember { mutableStateOf("") }
    val attachments = remember { mutableStateListOf<ComposerAttachment>() }
    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current
    val canSend = healthOk && (text.isNotBlank() || attachments.isNotEmpty())
    val isRunning = pendingRunCount > 0

    Column(modifier = modifier.fillMaxWidth()) {
        // Attachment preview strip
        AnimatedVisibility(visible = attachments.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for ((index, att) in attachments.withIndex()) {
                    AttachmentChip(name = att.fileName, onRemove = { attachments.removeAt(index) })
                }
            }
        }

        // Composer row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            IconButton(onClick = onPickAttachment, modifier = Modifier.size(40.dp)) {
                Icon(Icons.Default.Add, contentDescription = "Attach", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            ) {
                if (text.isEmpty()) {
                    Text(
                        text = if (!healthOk) "Connecting…" else "Message",
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                        fontSize = 14.sp,
                    )
                }
                BasicTextField(
                    value = text,
                    onValueChange = { text = it },
                    modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
                    textStyle = TextStyle(fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        if (canSend) { onSend(text.trim(), attachments.toList()); text = ""; attachments.clear(); keyboardController?.hide() }
                    }),
                    maxLines = 6,
                )
            }

            Spacer(modifier = Modifier.width(4.dp))

            if (isRunning) {
                IconButton(
                    onClick = onAbort,
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(MaterialTheme.colorScheme.error),
                ) { Icon(Icons.Default.Stop, contentDescription = "Abort", tint = MaterialTheme.colorScheme.onError) }
            } else {
                IconButton(
                    onClick = { if (canSend) { onSend(text.trim(), attachments.toList()); text = ""; attachments.clear(); keyboardController?.hide() } },
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(if (canSend) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant),
                    enabled = canSend,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Send, contentDescription = "Send",
                        tint = if (canSend) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                    )
                }
            }
        }
    }
}

@Composable
private fun AttachmentChip(name: String, onRemove: () -> Unit) {
    Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
        Row(modifier = Modifier.padding(start = 10.dp, end = 4.dp, top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(text = name.take(20), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSecondaryContainer)
            IconButton(onClick = onRemove, modifier = Modifier.size(20.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Remove", modifier = Modifier.size(14.dp))
            }
        }
    }
}

data class ComposerAttachment(val type: String, val mimeType: String, val fileName: String, val base64: String)
