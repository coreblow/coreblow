package ai.coreblow.app.ui.compose

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Mobile UI design tokens for CoreBlow Android.
 * Centralized color, typography, spacing, and animation constants
 * that ensure visual consistency across all Compose screens.
 */
object MobileUiTokens {

    // ── Brand Colors ────────────────────────────────────────
    val BrandPrimary = Color(0xFF6366F1)       // Indigo-500
    val BrandPrimaryDark = Color(0xFF818CF8)   // Indigo-400 (for dark mode)
    val BrandSecondary = Color(0xFF8B5CF6)     // Violet-500
    val BrandAccent = Color(0xFF06B6D4)        // Cyan-500
    val BrandSuccess = Color(0xFF10B981)        // Emerald-500
    val BrandWarning = Color(0xFFF59E0B)        // Amber-500
    val BrandError = Color(0xFFEF4444)          // Red-500
    val BrandInfo = Color(0xFF3B82F6)           // Blue-500

    // ── Surface Colors ──────────────────────────────────────
    val SurfaceLight = Color(0xFFFAFAFC)
    val SurfaceDark = Color(0xFF0F0F23)
    val SurfaceElevatedLight = Color(0xFFFFFFFF)
    val SurfaceElevatedDark = Color(0xFF1A1A2E)
    val SurfaceContainerLight = Color(0xFFF3F4F6)
    val SurfaceContainerDark = Color(0xFF16213E)

    // ── Text Colors ─────────────────────────────────────────
    val TextPrimaryLight = Color(0xFF1F2937)
    val TextPrimaryDark = Color(0xFFF9FAFB)
    val TextSecondaryLight = Color(0xFF6B7280)
    val TextSecondaryDark = Color(0xFF9CA3AF)
    val TextMutedLight = Color(0xFF9CA3AF)
    val TextMutedDark = Color(0xFF6B7280)

    // ── Chat Bubble Colors ──────────────────────────────────
    val UserBubbleLight = Color(0xFF6366F1)
    val UserBubbleDark = Color(0xFF4338CA)
    val UserBubbleText = Color(0xFFFFFFFF)
    val AssistantBubbleLight = Color(0xFFF3F4F6)
    val AssistantBubbleDark = Color(0xFF1E1E30)
    val AssistantBubbleTextLight = Color(0xFF1F2937)
    val AssistantBubbleTextDark = Color(0xFFE5E7EB)

    // ── Status Colors ───────────────────────────────────────
    val Online = Color(0xFF10B981)
    val Offline = Color(0xFFEF4444)
    val Connecting = Color(0xFFF59E0B)
    val Idle = Color(0xFF6B7280)

    // ── Spacing ─────────────────────────────────────────────
    val SpacingXxs = 2.dp
    val SpacingXs = 4.dp
    val SpacingSm = 8.dp
    val SpacingMd = 12.dp
    val SpacingLg = 16.dp
    val SpacingXl = 24.dp
    val SpacingXxl = 32.dp
    val SpacingHuge = 48.dp

    // ── Corner Radii ────────────────────────────────────────
    val RadiusSm = 6.dp
    val RadiusMd = 10.dp
    val RadiusLg = 16.dp
    val RadiusXl = 24.dp
    val RadiusFull = 999.dp
    val BubbleRadiusUser = 18.dp
    val BubbleRadiusAssistant = 18.dp
    val BubbleRadiusTail = 4.dp

    // ── Sizing ──────────────────────────────────────────────
    val IconSizeSm = 16.dp
    val IconSizeMd = 24.dp
    val IconSizeLg = 32.dp
    val IconSizeXl = 48.dp
    val AvatarSizeSm = 28.dp
    val AvatarSizeMd = 36.dp
    val AvatarSizeLg = 48.dp
    val BottomBarHeight = 64.dp
    val ComposerMinHeight = 56.dp
    val ComposerMaxHeight = 200.dp
    val FabSize = 56.dp

    // ── Animation ───────────────────────────────────────────
    const val AnimDurationFast = 150
    const val AnimDurationNormal = 250
    const val AnimDurationSlow = 400
    const val AnimDurationVSlow = 600
    const val SpringStiffness = 400f
    const val SpringDamping = 0.7f

    // ── Typography Scale ────────────────────────────────────
    val HeadlineLarge = 28.sp
    val HeadlineMedium = 22.sp
    val HeadlineSmall = 18.sp
    val TitleLarge = 20.sp
    val TitleMedium = 16.sp
    val TitleSmall = 14.sp
    val BodyLarge = 16.sp
    val BodyMedium = 14.sp
    val BodySmall = 12.sp
    val LabelLarge = 14.sp
    val LabelMedium = 12.sp
    val LabelSmall = 10.sp
    val Caption = 11.sp

    // ── Elevation ───────────────────────────────────────────
    val ElevationNone = 0.dp
    val ElevationSm = 1.dp
    val ElevationMd = 4.dp
    val ElevationLg = 8.dp
    val ElevationXl = 16.dp
}

/**
 * Color schemes using the design tokens.
 */
val CoreBlowLightColorScheme = lightColorScheme(
    primary = MobileUiTokens.BrandPrimary,
    secondary = MobileUiTokens.BrandSecondary,
    tertiary = MobileUiTokens.BrandAccent,
    background = MobileUiTokens.SurfaceLight,
    surface = MobileUiTokens.SurfaceElevatedLight,
    surfaceVariant = MobileUiTokens.SurfaceContainerLight,
    error = MobileUiTokens.BrandError,
    onPrimary = Color.White,
    onBackground = MobileUiTokens.TextPrimaryLight,
    onSurface = MobileUiTokens.TextPrimaryLight,
    onSurfaceVariant = MobileUiTokens.TextSecondaryLight,
)

val CoreBlowDarkColorScheme = darkColorScheme(
    primary = MobileUiTokens.BrandPrimaryDark,
    secondary = MobileUiTokens.BrandSecondary,
    tertiary = MobileUiTokens.BrandAccent,
    background = MobileUiTokens.SurfaceDark,
    surface = MobileUiTokens.SurfaceElevatedDark,
    surfaceVariant = MobileUiTokens.SurfaceContainerDark,
    error = MobileUiTokens.BrandError,
    onPrimary = Color.White,
    onBackground = MobileUiTokens.TextPrimaryDark,
    onSurface = MobileUiTokens.TextPrimaryDark,
    onSurfaceVariant = MobileUiTokens.TextSecondaryDark,
)

/**
 * CoreBlow Material 3 theme.
 */
@Composable
fun CoreBlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) CoreBlowDarkColorScheme else CoreBlowLightColorScheme,
        content = content,
    )
}
