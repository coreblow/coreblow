package ai.coreblow.app.ui

import androidx.compose.runtime.Composable
import ai.coreblow.app.MainViewModel
import ai.coreblow.app.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
