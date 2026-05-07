package ai.coreblow.app.ui.compose

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens for the CoreBlow mobile UI.
 * Centralized spacing, typography, colors, and dimension constants
 * used across all Compose screens.
 */
object MobileUiTokens {

    // Spacing
    val spacingXs = 4.dp
    val spacingSm = 8.dp
    val spacingMd = 12.dp
    val spacingLg = 16.dp
    val spacingXl = 24.dp
    val spacingXxl = 32.dp
    val spacingHuge = 48.dp

    // Border radius
    val radiusSm = 6.dp
    val radiusMd = 10.dp
    val radiusLg = 16.dp
    val radiusXl = 24.dp
    val radiusFull = 999.dp

    // Component sizes
    val iconSizeSm = 16.dp
    val iconSizeMd = 20.dp
    val iconSizeLg = 24.dp
    val iconSizeXl = 32.dp
    val avatarSizeSm = 28.dp
    val avatarSizeMd = 40.dp
    val avatarSizeLg = 56.dp
    val buttonHeight = 48.dp
    val chipHeight = 32.dp
    val topBarHeight = 56.dp
    val navBarHeight = 64.dp
    val composerMinHeight = 52.dp
    val composerMaxHeight = 160.dp

    // Elevation
    val elevationNone = 0.dp
    val elevationSm = 1.dp
    val elevationMd = 4.dp
    val elevationLg = 8.dp

    // Opacity
    const val opacityDisabled = 0.38f
    const val opacitySubtle = 0.5f
    const val opacityLight = 0.7f
    const val opacityFull = 1.0f

    // Typography scale
    val textXs = 10.sp
    val textSm = 12.sp
    val textMd = 14.sp
    val textLg = 16.sp
    val textXl = 20.sp
    val textXxl = 24.sp
    val textHuge = 32.sp

    // Brand colors
    val brandPrimary = Color(0xFF6750A4)
    val brandSecondary = Color(0xFF625B71)
    val brandTertiary = Color(0xFF7D5260)
    val brandSurface = Color(0xFFFEF7FF)
    val brandSurfaceDark = Color(0xFF1C1B1F)

    // Status colors
    val statusSuccess = Color(0xFF4CAF50)
    val statusWarning = Color(0xFFFFA726)
    val statusError = Color(0xFFEF5350)
    val statusInfo = Color(0xFF42A5F5)

    // Chat bubble colors
    val chatUserBubble = Color(0xFFE8DEF8)
    val chatAssistantBubble = Color(0xFFE6E0E9)
    val chatToolBubble = Color(0xFFD0BCFF)
    val chatSystemBubble = Color(0xFFF3EDF7)

    // Animation durations
    const val animFast = 150
    const val animNormal = 300
    const val animSlow = 500
    const val animVerySlow = 800

    // Max dimensions
    val maxContentWidth = 600.dp
    val maxBubbleWidth = 300.dp
    val maxAttachmentPreview = 80.dp
}
