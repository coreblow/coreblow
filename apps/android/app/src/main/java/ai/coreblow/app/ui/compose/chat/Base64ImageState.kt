package ai.coreblow.app.ui.compose.chat

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Composable state holder for async Base64 → [ImageBitmap] decoding.
 */
data class Base64ImageState(
    val image: ImageBitmap?,
    val failed: Boolean,
)

/**
 * Remember and decode a Base64-encoded image string into a composable
 * [Base64ImageState].  Decoding runs off the main thread.
 */
@Composable
fun rememberBase64ImageState(base64: String): Base64ImageState {
    var image by remember(base64) { mutableStateOf<ImageBitmap?>(null) }
    var failed by remember(base64) { mutableStateOf(false) }

    LaunchedEffect(base64) {
        failed = false
        image = withContext(Dispatchers.Default) {
            try {
                decodeBase64Bitmap(base64)?.asImageBitmap()
            } catch (_: Throwable) {
                null
            }
        }
        if (image == null) failed = true
    }

    return Base64ImageState(image = image, failed = failed)
}
