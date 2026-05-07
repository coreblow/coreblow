package ai.coreblow.app.ui.compose

import androidx.compose.runtime.Composable
import ai.coreblow.app.MainViewModel
import ai.coreblow.app.ui.compose.chat.ChatSheetContent

/**
 * Chat bottom-sheet wrapper — delegates entirely to [ChatSheetContent].
 */
@Composable
fun ChatSheet(viewModel: MainViewModel) {
    ChatSheetContent(viewModel = viewModel)
}
