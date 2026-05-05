package ai.coreblow.app.ui.compose

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Design tokens for the CoreBlow mobile UI.
 * Centralizes spacing, corner radii, colors, and elevation values.
 */
object MobileUiTokens {
    // Spacing
    val spacingXs = 4.dp
    val spacingSm = 8.dp
    val spacingMd = 16.dp
    val spacingLg = 24.dp
    val spacingXl = 32.dp

    // Corner radius
    val radiusSm = 8.dp
    val radiusMd = 12.dp
    val radiusLg = 16.dp
    val radiusXl = 24.dp
    val radiusFull = 999.dp

    // Elevation
    val elevationCard = 2.dp
    val elevationDialog = 8.dp
    val elevationSheet = 16.dp

    // Status colors
    val colorConnected = Color(0xFF4CAF50)
    val colorDisconnected = Color(0xFF9E9E9E)
    val colorConnecting = Color(0xFFFFC107)
    val colorError = Color(0xFFF44336)
    val colorRecording = Color(0xFFE53935)
    val colorProcessing = Color(0xFF7C4DFF)
    val colorSpeaking = Color(0xFF2196F3)

    // Orb sizes
    val orbSmall = 48.dp
    val orbMedium = 80.dp
    val orbLarge = 120.dp

    // Animation durations (ms)
    const val animFast = 150
    const val animNormal = 300
    const val animSlow = 500
}

/**
 * Status dot indicator composable.
 */
@Composable
fun StatusDot(isActive: Boolean, modifier: Modifier = Modifier) {
    val color = if (isActive) MobileUiTokens.colorConnected else MobileUiTokens.colorDisconnected
    Canvas(modifier = modifier) {
        drawCircle(color = color, radius = size.minDimension / 2)
    }
}
