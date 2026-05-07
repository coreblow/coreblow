package ai.coreblow.app.ui.compose.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.chat.ChatMessage
import ai.coreblow.app.chat.ChatMessageContent
import ai.coreblow.app.chat.ChatPendingToolCall
import ai.coreblow.app.tools.ToolDisplayRegistry
import ai.coreblow.app.ui.compose.LocalMobileColors
import java.util.Locale

/**
 * Chat message bubble composables — user, assistant, system roles,
 * streaming assistant, typing indicator, pending tool calls, and
 * code blocks.
 */

// ── Bubble style ────────────────────────────────────────

private data class ChatBubbleStyle(
    val alignEnd: Boolean,
    val containerColor: Color,
    val borderColor: Color,
    val roleColor: Color,
)

// ── Public composables ──────────────────────────────────

@Composable
fun ChatMessageBubble(message: ChatMessage) {
    val role = message.role.trim().lowercase(Locale.US)
    val style = bubbleStyle(role)

    val displayable = message.content.filter { part ->
        when (part.type) {
            "text" -> !part.text.isNullOrBlank()
            else -> part.base64 != null
        }
    }
    if (displayable.isEmpty()) return

    ChatBubbleContainer(style = style, roleLabel = roleLabel(role)) {
        ChatMessageBody(content = displayable)
    }
}

@Composable
fun ChatTypingIndicatorBubble() {
    val colors = LocalMobileColors.current
    ChatBubbleContainer(style = bubbleStyle("assistant"), roleLabel = roleLabel("assistant")) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DotPulse(color = colors.textSecondary)
            Text("Thinking...", style = MaterialTheme.typography.bodySmall, color = colors.textSecondary)
        }
    }
}

@Composable
fun ChatPendingToolsBubble(toolCalls: List<ChatPendingToolCall>) {
    val context = LocalContext.current
    val colors = LocalMobileColors.current
    val displays = remember(toolCalls, context) {
        toolCalls.map { ToolDisplayRegistry.resolve(context, it.name, it.args) }
    }

    ChatBubbleContainer(style = bubbleStyle("assistant"), roleLabel = "Tools") {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "Running tools...",
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                color = colors.textSecondary,
            )
            for (display in displays.take(6)) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "${display.emoji} ${display.label}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary,
                        fontFamily = FontFamily.Monospace,
                    )
                    display.detailLine?.let { detail ->
                        Text(
                            detail,
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textSecondary,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                }
            }
            if (toolCalls.size > 6) {
                Text("... +${toolCalls.size - 6} more", style = MaterialTheme.typography.labelSmall, color = colors.textSecondary)
            }
        }
    }
}

@Composable
fun ChatStreamingAssistantBubble(text: String) {
    val colors = LocalMobileColors.current
    ChatBubbleContainer(
        style = bubbleStyle("assistant").copy(borderColor = colors.accent),
        roleLabel = "CoreBlow · Live",
    ) {
        ChatMarkdown(text = text, textColor = colors.text)
    }
}

@Composable
fun ChatCodeBlock(code: String, language: String?) {
    val colors = LocalMobileColors.current
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = BorderStroke(1.dp, colors.border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (!language.isNullOrBlank()) {
                Text(
                    language.uppercase(Locale.US),
                    style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 0.4.sp),
                    color = colors.textSecondary,
                )
            }
            Text(
                code.trimEnd(),
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.bodySmall,
                color = colors.text,
            )
        }
    }
}

// ── Private composables ─────────────────────────────────

@Composable
private fun ChatBubbleContainer(
    style: ChatBubbleStyle,
    roleLabel: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = if (style.alignEnd) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, style.borderColor),
            color = style.containerColor,
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            modifier = Modifier.fillMaxWidth(0.90f),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 11.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    text = roleLabel,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.6.sp,
                    ),
                    color = style.roleColor,
                )
                content()
            }
        }
    }
}

@Composable
private fun ChatMessageBody(content: List<ChatMessageContent>) {
    val colors = LocalMobileColors.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (part in content) {
            when (part.type) {
                "text" -> {
                    val text = part.text ?: continue
                    ChatMarkdown(text = text, textColor = colors.text)
                }
                else -> {
                    val b64 = part.base64 ?: continue
                    ChatBase64Image(base64 = b64, mimeType = part.mimeType)
                }
            }
        }
    }
}

@Composable
private fun ChatBase64Image(base64: String, mimeType: String?) {
    val colors = LocalMobileColors.current
    val imageState = rememberBase64ImageState(base64)
    val image = imageState.image

    if (image != null) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            border = BorderStroke(1.dp, colors.border),
            color = colors.cardSurface,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Image(
                bitmap = image,
                contentDescription = mimeType ?: "attachment",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    } else if (imageState.failed) {
        Text("Unsupported attachment", style = MaterialTheme.typography.labelSmall, color = colors.textSecondary)
    }
}

@Composable
private fun DotPulse(color: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        PulseDot(alpha = 0.38f, color = color)
        PulseDot(alpha = 0.62f, color = color)
        PulseDot(alpha = 0.90f, color = color)
    }
}

@Composable
private fun PulseDot(alpha: Float, color: Color) {
    Surface(
        modifier = Modifier.size(6.dp).alpha(alpha),
        shape = CircleShape,
        color = color,
    ) {}
}

// ── Style helpers ───────────────────────────────────────

@Composable
private fun bubbleStyle(role: String): ChatBubbleStyle {
    val colors = LocalMobileColors.current
    return when (role) {
        "user" -> ChatBubbleStyle(
            alignEnd = true,
            containerColor = colors.accent.copy(alpha = 0.08f),
            borderColor = colors.accent,
            roleColor = colors.accent,
        )
        "system" -> ChatBubbleStyle(
            alignEnd = false,
            containerColor = colors.warning.copy(alpha = 0.08f),
            borderColor = colors.warning.copy(alpha = 0.45f),
            roleColor = colors.warning,
        )
        else -> ChatBubbleStyle(
            alignEnd = false,
            containerColor = colors.cardSurface,
            borderColor = colors.border,
            roleColor = colors.textSecondary,
        )
    }
}

private fun roleLabel(role: String): String = when (role) {
    "user" -> "You"
    "system" -> "System"
    else -> "CoreBlow"
}
