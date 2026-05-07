package ai.coreblow.app.ui.compose

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Voice-mode orb overlay — animated pulsating circle with radial gradient,
 * expanding ring animations, and status/phase label.
 *
 * @param seamColor the brand accent colour driving the orb gradient
 * @param statusText real-time mic status from the runtime
 * @param isListening true while VAD detects speech
 * @param isSpeaking true while TTS is playing
 */
@Composable
fun TalkOrbOverlay(
    seamColor: Color,
    statusText: String,
    isListening: Boolean,
    isSpeaking: Boolean,
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "talk-orb")
    val t by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "pulse",
    )

    val trimmed = statusText.trim()
    val showStatus = trimmed.isNotEmpty() && trimmed != "Off"
    val phase = when {
        isSpeaking -> "Speaking"
        isListening -> "Listening"
        else -> "Thinking"
    }

    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Canvas(modifier = Modifier.size(360.dp)) {
                val c = this.center
                val baseRadius = size.minDimension * 0.30f

                // Expanding pulse rings
                val ring1 = 1.05f + (t * 0.25f)
                val ring2 = 1.20f + (t * 0.55f)
                val ringAlpha1 = (1f - t) * 0.34f
                val ringAlpha2 = (1f - t) * 0.22f

                drawCircle(
                    color = seamColor.copy(alpha = ringAlpha1),
                    radius = baseRadius * ring1,
                    center = c,
                    style = Stroke(width = 3.dp.toPx()),
                )
                drawCircle(
                    color = seamColor.copy(alpha = ringAlpha2),
                    radius = baseRadius * ring2,
                    center = c,
                    style = Stroke(width = 3.dp.toPx()),
                )

                // Core orb — radial gradient fill
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            seamColor.copy(alpha = 0.92f),
                            seamColor.copy(alpha = 0.40f),
                            Color.Black.copy(alpha = 0.56f),
                        ),
                        center = c,
                        radius = baseRadius * 1.35f,
                    ),
                    radius = baseRadius,
                    center = c,
                )

                // Outline stroke
                drawCircle(
                    color = seamColor.copy(alpha = 0.34f),
                    radius = baseRadius,
                    center = c,
                    style = Stroke(width = 1.dp.toPx()),
                )
            }
        }

        // Status label
        if (showStatus) {
            Surface(
                color = Color.Black.copy(alpha = 0.40f),
                shape = CircleShape,
            ) {
                Text(
                    text = trimmed,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    color = Color.White.copy(alpha = 0.92f),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        } else {
            Text(
                text = phase,
                color = Color.White.copy(alpha = 0.80f),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
