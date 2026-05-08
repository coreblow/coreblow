package ai.coreblow.app.ui.compose

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
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

@Composable
fun CoreBlowTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val mobileColors = if (darkTheme) darkMobileColors() else lightMobileColors()
    CompositionLocalProvider(LocalMobileColors provides mobileColors) {
        MaterialTheme(
            colorScheme = if (darkTheme) CoreBlowDarkColorScheme else CoreBlowLightColorScheme,
            content = content,
        )
    }
}

// ── MobileColors (OC-parity semantic tokens) ─────────────────

internal data class MobileColors(
    val surface: Color,
    val surfaceStrong: Color,
    val cardSurface: Color,
    val border: Color,
    val borderStrong: Color,
    val text: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    val accent: Color,
    val accentSoft: Color,
    val accentBorderStrong: Color,
    val success: Color,
    val successSoft: Color,
    val warning: Color,
    val warningSoft: Color,
    val danger: Color,
    val dangerSoft: Color,
    val codeBg: Color,
    val codeText: Color,
    val codeBorder: Color,
    val codeAccent: Color,
    val chipBorderConnected: Color,
    val chipBorderConnecting: Color,
    val chipBorderWarning: Color,
    val chipBorderError: Color,
)

internal fun lightMobileColors() = MobileColors(
    surface = Color(0xFFF6F7FA), surfaceStrong = Color(0xFFECEEF3), cardSurface = Color(0xFFFFFFFF),
    border = Color(0xFFE5E7EC), borderStrong = Color(0xFFD6DAE2),
    text = Color(0xFF17181C), textSecondary = Color(0xFF5D6472), textTertiary = Color(0xFF99A0AE),
    accent = Color(0xFF6366F1), accentSoft = Color(0xFFECF3FF), accentBorderStrong = Color(0xFF4338CA),
    success = Color(0xFF2F8C5A), successSoft = Color(0xFFEEF9F3), warning = Color(0xFFC8841A), warningSoft = Color(0xFFFFF8EC),
    danger = Color(0xFFD04B4B), dangerSoft = Color(0xFFFFF2F2),
    codeBg = Color(0xFF15171B), codeText = Color(0xFFE8EAEE), codeBorder = Color(0xFF2B2E35), codeAccent = Color(0xFF3FC97A),
    chipBorderConnected = Color(0xFFCFEBD8), chipBorderConnecting = Color(0xFFD5E2FA),
    chipBorderWarning = Color(0xFFEED8B8), chipBorderError = Color(0xFFF3C8C8),
)

internal fun darkMobileColors() = MobileColors(
    surface = Color(0xFF1A1C20), surfaceStrong = Color(0xFF24262B), cardSurface = Color(0xFF1E2024),
    border = Color(0xFF2E3038), borderStrong = Color(0xFF3A3D46),
    text = Color(0xFFE4E5EA), textSecondary = Color(0xFFA0A6B4), textTertiary = Color(0xFF6B7280),
    accent = Color(0xFF818CF8), accentSoft = Color(0xFF1A2A44), accentBorderStrong = Color(0xFF6366F1),
    success = Color(0xFF5FBB85), successSoft = Color(0xFF152E22), warning = Color(0xFFE8A844), warningSoft = Color(0xFF2E2212),
    danger = Color(0xFFE87070), dangerSoft = Color(0xFF2E1616),
    codeBg = Color(0xFF111317), codeText = Color(0xFFE8EAEE), codeBorder = Color(0xFF2B2E35), codeAccent = Color(0xFF3FC97A),
    chipBorderConnected = Color(0xFF1E4A30), chipBorderConnecting = Color(0xFF1E3358),
    chipBorderWarning = Color(0xFF3E3018), chipBorderError = Color(0xFF3E1E1E),
)

internal val LocalMobileColors = staticCompositionLocalOf { lightMobileColors() }

// Top-level composable color accessors
internal val mobileSurface: Color @Composable get() = LocalMobileColors.current.surface
internal val mobileSurfaceStrong: Color @Composable get() = LocalMobileColors.current.surfaceStrong
internal val mobileCardSurface: Color @Composable get() = LocalMobileColors.current.cardSurface
internal val mobileBorder: Color @Composable get() = LocalMobileColors.current.border
internal val mobileBorderStrong: Color @Composable get() = LocalMobileColors.current.borderStrong
internal val mobileText: Color @Composable get() = LocalMobileColors.current.text
internal val mobileTextSecondary: Color @Composable get() = LocalMobileColors.current.textSecondary
internal val mobileTextTertiary: Color @Composable get() = LocalMobileColors.current.textTertiary
internal val mobileAccent: Color @Composable get() = LocalMobileColors.current.accent
internal val mobileAccentSoft: Color @Composable get() = LocalMobileColors.current.accentSoft
internal val mobileAccentBorderStrong: Color @Composable get() = LocalMobileColors.current.accentBorderStrong
internal val mobileSuccess: Color @Composable get() = LocalMobileColors.current.success
internal val mobileSuccessSoft: Color @Composable get() = LocalMobileColors.current.successSoft
internal val mobileWarning: Color @Composable get() = LocalMobileColors.current.warning
internal val mobileWarningSoft: Color @Composable get() = LocalMobileColors.current.warningSoft
internal val mobileDanger: Color @Composable get() = LocalMobileColors.current.danger
internal val mobileDangerSoft: Color @Composable get() = LocalMobileColors.current.dangerSoft
internal val mobileCodeBg: Color @Composable get() = LocalMobileColors.current.codeBg
internal val mobileCodeText: Color @Composable get() = LocalMobileColors.current.codeText
internal val mobileCodeBorder: Color @Composable get() = LocalMobileColors.current.codeBorder
internal val mobileCodeAccent: Color @Composable get() = LocalMobileColors.current.codeAccent

internal val mobileBackgroundGradient: Brush
    @Composable get() {
        val colors = LocalMobileColors.current
        return Brush.verticalGradient(listOf(colors.surface, colors.surfaceStrong, colors.surfaceStrong))
    }

// ── Typography tokens (OC-parity) ───────────────────────────

internal val mobileDisplay = TextStyle(fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 40.sp, letterSpacing = (-0.8).sp)
internal val mobileTitle1 = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 30.sp, letterSpacing = (-0.5).sp)
internal val mobileTitle2 = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 26.sp, letterSpacing = (-0.3).sp)
internal val mobileHeadline = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp, letterSpacing = (-0.1).sp)
internal val mobileBody = TextStyle(fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 22.sp)
internal val mobileCallout = TextStyle(fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp)
internal val mobileCaption1 = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.2.sp)
internal val mobileCaption2 = TextStyle(fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.4.sp)
