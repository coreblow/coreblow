package ai.coreblow.app.viewmodel

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow

class SearchViewModel : ViewModel() {
    val isLoading = MutableStateFlow(false)
}
