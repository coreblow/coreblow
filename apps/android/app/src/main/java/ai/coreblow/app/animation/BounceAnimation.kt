package ai.coreblow.app.animation

import androidx.compose.animation.core.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer

// ============================================================
// BounceAnimation
// ============================================================

@Composable
fun Modifier.bounceAnimation(
    enabled: Boolean = true,
    targetScale: Float = 1.1f,
    durationMs: Int = 300,
): Modifier {
    if (!enabled) return this
    val infiniteTransition = rememberInfiniteTransition(label = "bounce")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = targetScale,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "bounce_scale",
    )
    return this.scale(scale)
}

// ============================================================
// FadeAnimation
// ============================================================

@Composable
fun Modifier.fadeAnimation(
    enabled: Boolean = true,
    minAlpha: Float = 0.3f,
    durationMs: Int = 800,
): Modifier {
    if (!enabled) return this
    val infiniteTransition = rememberInfiniteTransition(label = "fade")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = minAlpha,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "fade_alpha",
    )
    return this.alpha(alpha)
}

// ============================================================
// PulseAnimation
// ============================================================

@Composable
fun Modifier.pulseAnimation(
    enabled: Boolean = true,
    minScale: Float = 0.95f,
    maxScale: Float = 1.05f,
    durationMs: Int = 1000,
): Modifier {
    if (!enabled) return this
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = minScale,
        targetValue = maxScale,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse_scale",
    )
    return this.scale(scale)
}

// ============================================================
// ScaleAnimation
// ============================================================

@Composable
fun Modifier.scaleAnimation(
    enabled: Boolean = true,
    from: Float = 0.8f,
    to: Float = 1f,
    durationMs: Int = 400,
): Modifier {
    if (!enabled) return this
    val infiniteTransition = rememberInfiniteTransition(label = "scale")
    val scale by infiniteTransition.animateFloat(
        initialValue = from,
        targetValue = to,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "scale_val",
    )
    return this.scale(scale)
}

// ============================================================
// SlideAnimation
// ============================================================

@Composable
fun Modifier.slideAnimation(
    enabled: Boolean = true,
    offsetX: Float = 0f,
    offsetY: Float = 10f,
    durationMs: Int = 600,
): Modifier {
    if (!enabled) return this
    val infiniteTransition = rememberInfiniteTransition(label = "slide")
    val translationY by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = offsetY,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "slide_y",
    )
    val translationX by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = offsetX,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "slide_x",
    )
    return this.graphicsLayer { this.translationX = translationX; this.translationY = translationY }
}
