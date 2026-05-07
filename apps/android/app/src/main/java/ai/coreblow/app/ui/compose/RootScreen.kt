package ai.coreblow.app.ui.compose

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import ai.coreblow.app.MainViewModel

/**
 * Root screen — routes between [OnboardingFlow] and [PostOnboardingTabs]
 * based on onboarding completion state.
 */
@Composable
fun RootScreen(viewModel: MainViewModel) {
    val onboardingCompleted by viewModel.onboardingCompleted.collectAsState()

    if (!onboardingCompleted) {
        OnboardingFlow(viewModel = viewModel, modifier = Modifier.fillMaxSize())
        return
    }

    PostOnboardingTabs(viewModel = viewModel, modifier = Modifier.fillMaxSize())
}
