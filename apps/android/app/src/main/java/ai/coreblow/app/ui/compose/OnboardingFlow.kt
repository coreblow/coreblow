package ai.coreblow.app.ui.compose

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import ai.coreblow.app.viewmodel.GatewayViewModel
import ai.coreblow.app.viewmodel.OnboardingStep
import ai.coreblow.app.viewmodel.OnboardingViewModel

/**
 * Full-screen onboarding flow with step-based wizard.
 * Includes welcome, permissions, gateway setup, and completion steps.
 */
@Composable
fun OnboardingFlow(
    onboardingViewModel: OnboardingViewModel,
    gatewayViewModel: GatewayViewModel,
    onComplete: () -> Unit,
) {
    val currentStep by onboardingViewModel.currentStep.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(MobileUiTokens.spacingLg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        when (currentStep) {
            OnboardingStep.WELCOME -> WelcomeStep { onboardingViewModel.nextStep() }
            OnboardingStep.PERMISSIONS -> PermissionsStep(
                onNext = { onboardingViewModel.nextStep() },
                onBack = { onboardingViewModel.previousStep() },
            )
            OnboardingStep.GATEWAY_SETUP -> GatewaySetupStep(
                gatewayViewModel = gatewayViewModel,
                onSkip = { onboardingViewModel.skipGatewaySetup() },
                onComplete = { onboardingViewModel.completeGatewaySetup() },
                onBack = { onboardingViewModel.previousStep() },
            )
            OnboardingStep.COMPLETE -> CompletionStep(onComplete = onComplete)
        }
    }
}

@Composable
private fun WelcomeStep(onNext: () -> Unit) {
    Text("Welcome to CoreBlow", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
    Spacer(Modifier.height(MobileUiTokens.spacingMd))
    Text("Your AI-powered mobile node", style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
    Spacer(Modifier.height(MobileUiTokens.spacingXl))
    Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) { Text("Get Started") }
}

@Composable
private fun PermissionsStep(onNext: () -> Unit, onBack: () -> Unit) {
    Text("Permissions", style = MaterialTheme.typography.headlineSmall)
    Spacer(Modifier.height(MobileUiTokens.spacingMd))
    Text("CoreBlow needs access to device features to respond to gateway commands.", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
    Spacer(Modifier.height(MobileUiTokens.spacingXl))
    Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) { Text("Grant Permissions") }
    Spacer(Modifier.height(MobileUiTokens.spacingSm))
    TextButton(onClick = onBack) { Text("Back") }
}

@Composable
private fun GatewaySetupStep(gatewayViewModel: GatewayViewModel, onSkip: () -> Unit, onComplete: () -> Unit, onBack: () -> Unit) {
    Text("Connect to Gateway", style = MaterialTheme.typography.headlineSmall)
    Spacer(Modifier.height(MobileUiTokens.spacingMd))
    Text("Scan for gateways on your network or enter the address manually.", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
    Spacer(Modifier.height(MobileUiTokens.spacingLg))
    Button(onClick = { gatewayViewModel.startDiscovery() }, modifier = Modifier.fillMaxWidth()) { Text("Scan Network") }
    Spacer(Modifier.height(MobileUiTokens.spacingSm))
    OutlinedButton(onClick = onSkip, modifier = Modifier.fillMaxWidth()) { Text("Skip for Now") }
    Spacer(Modifier.height(MobileUiTokens.spacingSm))
    TextButton(onClick = onBack) { Text("Back") }
}

@Composable
private fun CompletionStep(onComplete: () -> Unit) {
    Text("You're All Set!", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
    Spacer(Modifier.height(MobileUiTokens.spacingMd))
    Text("CoreBlow is ready to connect to your gateway.", style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
    Spacer(Modifier.height(MobileUiTokens.spacingXl))
    Button(onClick = onComplete, modifier = Modifier.fillMaxWidth()) { Text("Start Using CoreBlow") }
}
