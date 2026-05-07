package ai.coreblow.app.ui.compose

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ============================================================
// AnimatedButton — button with press/release scale animation
// ============================================================

@Composable
fun AnimatedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (pressed) 0.95f else 1f, tween(100), label = "btn_scale")

    Button(
        onClick = onClick,
        modifier = modifier.scale(scale),
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(text)
    }
}

// ============================================================
// AvatarCompose — circular avatar with initials fallback
// ============================================================

@Composable
fun AvatarCompose(name: String, size: Int = 40, modifier: Modifier = Modifier) {
    val initials = name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("")
    val color = remember(name) { Color(0xFF6750A4 + (name.hashCode() and 0x00FFFFFF)) }
    Box(modifier = modifier.size(size.dp).clip(CircleShape).background(color), contentAlignment = Alignment.Center) {
        Text(initials, fontSize = (size / 3).sp, fontWeight = FontWeight.Bold, color = Color.White)
    }
}

// ============================================================
// BadgeCompose — small count badge
// ============================================================

@Composable
fun BadgeCompose(count: Int, modifier: Modifier = Modifier) {
    if (count <= 0) return
    Box(modifier = modifier.size(18.dp).clip(CircleShape).background(MaterialTheme.colorScheme.error), contentAlignment = Alignment.Center) {
        Text(if (count > 99) "99+" else "$count", fontSize = 9.sp, color = Color.White, fontWeight = FontWeight.Bold)
    }
}

// ============================================================
// CircularProgressCompose — circular progress with label
// ============================================================

@Composable
fun CircularProgressCompose(progress: Float, label: String? = null, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.Center) {
            CircularProgressIndicator(progress = { progress }, modifier = Modifier.size(48.dp), strokeWidth = 4.dp)
            Text("${(progress * 100).toInt()}%", fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
        if (!label.isNullOrBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ============================================================
// GlassCard — glassmorphism card
// ============================================================

@Composable
fun GlassCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.7f),
        tonalElevation = 2.dp,
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

// ============================================================
// PullToRefresh — swipe-to-refresh wrapper
// ============================================================

@Composable
fun PullToRefresh(isRefreshing: Boolean, onRefresh: () -> Unit, content: @Composable () -> Unit) {
    Column {
        if (isRefreshing) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
        content()
    }
}

// ============================================================
// ShimmerEffect — loading placeholder
// ============================================================

@Composable
fun ShimmerEffect(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val offset by transition.animateFloat(
        initialValue = -300f,
        targetValue = 300f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing)),
        label = "shimmer_offset",
    )
    Box(
        modifier = modifier.background(
            brush = Brush.linearGradient(
                colors = listOf(Color.LightGray.copy(alpha = 0.3f), Color.LightGray.copy(alpha = 0.1f), Color.LightGray.copy(alpha = 0.3f)),
                start = Offset(offset, 0f),
                end = Offset(offset + 200f, 0f),
            ),
            shape = RoundedCornerShape(8.dp),
        ),
    )
}

// ============================================================
// StatusDot — colored status indicator
// ============================================================

@Composable
fun StatusDot(color: Color, size: Int = 8, modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(size.dp).clip(CircleShape).background(color))
}

// ============================================================
// SwipeAction — swipeable row with action
// ============================================================

@Composable
fun SwipeAction(
    onSwipeLeft: (() -> Unit)? = null,
    onSwipeRight: (() -> Unit)? = null,
    threshold: Float = 100f,
    content: @Composable () -> Unit,
) {
    var offsetX by remember { mutableStateOf(0f) }
    Box(
        modifier = Modifier
            .graphicsLayer { translationX = offsetX }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        if (offsetX < -threshold) onSwipeLeft?.invoke()
                        if (offsetX > threshold) onSwipeRight?.invoke()
                        offsetX = 0f
                    },
                    onHorizontalDrag = { _, dragAmount -> offsetX += dragAmount },
                )
            },
    ) { content() }
}

// ============================================================
// TagCompose — colored tag chip
// ============================================================

@Composable
fun TagCompose(text: String, color: Color = MaterialTheme.colorScheme.primaryContainer, modifier: Modifier = Modifier) {
    Surface(shape = RoundedCornerShape(4.dp), color = color, modifier = modifier) {
        Text(text, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontWeight = FontWeight.Medium)
    }
}

// ============================================================
// TypewriterText — animated typing effect
// ============================================================

@Composable
fun TypewriterText(text: String, charDelayMs: Int = 30, modifier: Modifier = Modifier) {
    var visibleCount by remember(text) { mutableIntStateOf(0) }
    LaunchedEffect(text) {
        visibleCount = 0
        for (i in text.indices) {
            kotlinx.coroutines.delay(charDelayMs.toLong())
            visibleCount = i + 1
        }
    }
    Text(text.take(visibleCount), modifier = modifier, fontSize = 14.sp)
}
