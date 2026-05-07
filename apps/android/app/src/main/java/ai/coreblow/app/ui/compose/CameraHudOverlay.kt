package ai.coreblow.app.ui.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.delay

/**
 * Camera flash overlay — displays a brief white flash when a photo is captured.
 *
 * @param token incremented each time a capture occurs; the overlay
 *              animates whenever [token] changes to a non-zero value.
 */
@Composable
fun CameraFlashOverlay(
    token: Long,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize()) {
        CameraFlash(token = token)
    }
}

@Composable
private fun CameraFlash(token: Long) {
    var flashAlpha by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(token) {
        if (token == 0L) return@LaunchedEffect
        flashAlpha = 0.85f
        delay(110)
        flashAlpha = 0f
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .alpha(flashAlpha)
            .background(Color.White),
    )
}
