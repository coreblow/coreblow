package ai.coreblow.app.ui.compose

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * CoreBlow Material 3 theme wrapper.
 *
 * Uses Android 12+ dynamic colours and provides [LocalMobileColors]
 * for custom tokens used across the CoreBlow Compose UI.
 */
@Composable
fun CoreBlowTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val isDark = isSystemInDarkTheme()
    val colorScheme = if (isDark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    val mobileColors = if (isDark) darkMobileColors() else lightMobileColors()

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, window.decorView)
                .isAppearanceLightStatusBars = !isDark
        }
    }

    CompositionLocalProvider(LocalMobileColors provides mobileColors) {
        MaterialTheme(colorScheme = colorScheme, content = content)
    }
}

/** Overlay container colour — slightly transparent in light mode. */
@Composable
fun overlayContainerColor(): Color {
    val scheme = MaterialTheme.colorScheme
    val isDark = isSystemInDarkTheme()
    val base = if (isDark) scheme.surfaceContainerLow else scheme.surfaceContainerHigh
    return if (isDark) base else base.copy(alpha = 0.88f)
}

/** Standard overlay icon tint. */
@Composable
fun overlayIconColor(): Color = MaterialTheme.colorScheme.onSurfaceVariant
