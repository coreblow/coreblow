package ai.coreblow.app.ui.compose

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircularShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ============================================================
// ErrorBanner — dismissible error/warning banner
// ============================================================

@Composable
fun ErrorBanner(
    message: String,
    onDismiss: () -> Unit,
    isWarning: Boolean = false,
    action: String? = null,
    onAction: (() -> Unit)? = null,
) {
    AnimatedVisibility(visible = message.isNotBlank(), enter = slideInVertically() + fadeIn(), exit = slideOutVertically() + fadeOut()) {
        Surface(
            color = if (isWarning) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.errorContainer,
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
        ) {
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isWarning) Icons.Default.Warning else Icons.Default.ErrorOutline,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = if (isWarning) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onErrorContainer,
                )
                Spacer(Modifier.width(10.dp))
                Text(message, fontSize = 13.sp, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (action != null && onAction != null) {
                    TextButton(onClick = onAction) { Text(action, fontSize = 12.sp) }
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Dismiss", modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

// ============================================================
// SearchBar — search field with clear button
// ============================================================

@Composable
fun SearchBar(
    query: String,
    onQueryChanged: (String) -> Unit,
    placeholder: String = "Search…",
    modifier: Modifier = Modifier,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier.fillMaxWidth().height(44.dp),
    ) {
        Row(modifier = Modifier.padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(8.dp))
            Box(modifier = Modifier.weight(1f)) {
                if (query.isEmpty()) {
                    Text(placeholder, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
                }
                BasicTextField(value = query, onValueChange = onQueryChanged, singleLine = true, textStyle = LocalTextStyle.current.copy(fontSize = 14.sp))
            }
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChanged("") }, modifier = Modifier.size(24.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

// ============================================================
// LoadingIndicator — centered spinner with optional label
// ============================================================

@Composable
fun LoadingIndicator(label: String? = null, modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxWidth().padding(vertical = 32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(modifier = Modifier.size(36.dp), strokeWidth = 3.dp)
            if (!label.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

// ============================================================
// CodeBlock — syntax-highlighted-ish code display
// ============================================================

@Composable
fun CodeBlock(code: String, language: String? = null, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            if (!language.isNullOrBlank()) {
                Text(language, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 6.dp))
            }
            Text(code, fontFamily = FontFamily.Monospace, fontSize = 12.sp, lineHeight = 18.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ============================================================
// TokenCounter — displays token usage
// ============================================================

@Composable
fun TokenCounter(used: Int, max: Int, modifier: Modifier = Modifier) {
    val ratio = if (max > 0) used.toFloat() / max else 0f
    val color = when {
        ratio > 0.9f -> MaterialTheme.colorScheme.error
        ratio > 0.7f -> Color(0xFFFFA726)
        else -> MaterialTheme.colorScheme.primary
    }
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Text("$used", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = color)
        Text(" / $max tokens", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
    }
}

// ============================================================
// ProviderBadge — chip showing provider name
// ============================================================

@Composable
fun ProviderBadge(name: String, isActive: Boolean = true, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = if (isActive) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
        modifier = modifier,
    ) {
        Text(name, fontSize = 10.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            color = if (isActive) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ============================================================
// ToolOutput — displays tool call results
// ============================================================

@Composable
fun ToolOutput(toolName: String, output: String, isSuccess: Boolean = true, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = if (isSuccess) MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f) else MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (isSuccess) Icons.Default.CheckCircle else Icons.Default.Error, contentDescription = null, modifier = Modifier.size(14.dp),
                    tint = if (isSuccess) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                Spacer(Modifier.width(6.dp))
                Text(toolName, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            if (output.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(output, fontFamily = FontFamily.Monospace, fontSize = 11.sp, maxLines = 10, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

// ============================================================
// ConversationItem — list item for session drawer
// ============================================================

@Composable
fun ConversationItem(
    title: String,
    preview: String,
    timestamp: String,
    isActive: Boolean = false,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        color = if (isActive) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f) else Color.Transparent,
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
            Row {
                Text(title, fontSize = 14.sp, fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(timestamp, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
            }
            if (preview.isNotBlank()) {
                Text(preview, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}
