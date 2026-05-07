package ai.coreblow.app.ui.compose

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.coreblow.app.gateway.GatewayEndpoint
import ai.coreblow.app.viewmodel.GatewayViewModel
import ai.coreblow.app.viewmodel.OnboardingStep
import ai.coreblow.app.viewmodel.OnboardingViewModel

/**
 * Full-screen onboarding wizard with animated step transitions.
 * Steps: Welcome → Permissions → Gateway Discovery → Token/Manual → Complete
 */
@Composable
fun OnboardingFlow(
    onboardingViewModel: OnboardingViewModel,
    gatewayViewModel: GatewayViewModel,
    onComplete: () -> Unit,
) {
    val currentStep by onboardingViewModel.currentStep.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.surface,
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                    ),
                ),
            ),
    ) {
        AnimatedContent(
            targetState = currentStep,
            transitionSpec = {
                (fadeIn(tween(300)) + slideInHorizontally { it / 3 }) togetherWith
                    (fadeOut(tween(200)) + slideOutHorizontally { -it / 3 })
            },
            label = "onboarding_step",
        ) { step ->
            when (step) {
                OnboardingStep.WELCOME -> WelcomeStep(
                    onNext = { onboardingViewModel.nextStep() },
                )
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

        // Step indicator
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OnboardingStep.entries.forEach { step ->
                Box(
                    modifier = Modifier
                        .size(if (step == currentStep) 10.dp else 8.dp)
                        .clip(CircleShape)
                        .background(
                            if (step == currentStep) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.outlineVariant,
                        ),
                )
            }
        }
    }
}

// MARK: - Welcome

@Composable
private fun WelcomeStep(onNext: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Logo area
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Default.Hub,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }

        Spacer(Modifier.height(32.dp))

        Text(
            "Welcome to CoreBlow",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(12.dp))

        Text(
            "Your phone becomes a smart node — dormant until your gateway needs it, " +
                "then it wakes, syncs, and goes back to sleep.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            lineHeight = 24.sp,
        )

        Spacer(Modifier.height(48.dp))

        // Feature highlights
        FeatureRow(Icons.Default.CloudSync, "Gateway Sync", "Connect to your private AI gateway")
        Spacer(Modifier.height(12.dp))
        FeatureRow(Icons.Default.Mic, "Voice Control", "Hands-free with wake word detection")
        Spacer(Modifier.height(12.dp))
        FeatureRow(Icons.Default.Security, "Secure by Design", "End-to-end encrypted, zero cloud dependency")

        Spacer(Modifier.height(48.dp))

        Button(
            onClick = onNext,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            Text("Get Started", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun FeatureRow(icon: ImageVector, title: String, subtitle: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer)
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(title, fontWeight = FontWeight.Medium, fontSize = 14.sp)
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// MARK: - Permissions

@Composable
private fun PermissionsStep(onNext: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    var micGranted by remember { mutableStateOf(false) }
    var cameraGranted by remember { mutableStateOf(false) }
    var locationGranted by remember { mutableStateOf(false) }
    var notifGranted by remember { mutableStateOf(false) }

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { results ->
        micGranted = results[Manifest.permission.RECORD_AUDIO] == true
        cameraGranted = results[Manifest.permission.CAMERA] == true
        locationGranted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Permissions", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "CoreBlow needs these to respond to gateway commands. " +
                "You can change them later in Settings.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(32.dp))

        PermissionCard(Icons.Default.Mic, "Microphone", "Voice commands & talk mode", micGranted)
        Spacer(Modifier.height(8.dp))
        PermissionCard(Icons.Default.CameraAlt, "Camera", "Photo capture on demand", cameraGranted)
        Spacer(Modifier.height(8.dp))
        PermissionCard(Icons.Default.LocationOn, "Location", "GPS when gateway requests it", locationGranted)
        Spacer(Modifier.height(8.dp))
        PermissionCard(Icons.Default.Notifications, "Notifications", "Status updates from gateway", notifGranted)

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = {
                val perms = mutableListOf(
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                )
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    perms.add(Manifest.permission.POST_NOTIFICATIONS)
                }
                permLauncher.launch(perms.toTypedArray())
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
        ) {
            Text("Grant All Permissions", fontSize = 16.sp)
        }

        Spacer(Modifier.height(12.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onBack) { Text("Back") }
            TextButton(onClick = onNext) { Text("Continue") }
        }
    }
}

@Composable
private fun PermissionCard(icon: ImageVector, title: String, desc: String, granted: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Medium, fontSize = 14.sp)
            Text(desc, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (granted) {
            Icon(Icons.Default.CheckCircle, contentDescription = "Granted", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        }
    }
}

// MARK: - Gateway Setup

@Composable
private fun GatewaySetupStep(
    gatewayViewModel: GatewayViewModel,
    onSkip: () -> Unit,
    onComplete: () -> Unit,
    onBack: () -> Unit,
) {
    val gateways by gatewayViewModel.gateways.collectAsState()
    val statusText by gatewayViewModel.statusText.collectAsState()
    var showManual by remember { mutableStateOf(false) }
    var manualHost by remember { mutableStateOf("") }
    var manualPort by remember { mutableStateOf("18789") }
    var gatewayToken by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(48.dp))

        Text("Connect to Gateway", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(statusText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

        Spacer(Modifier.height(24.dp))

        // Discovered gateways
        if (gateways.isNotEmpty()) {
            LazyColumn(
                modifier = Modifier.weight(1f, fill = false).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(gateways) { gw ->
                    GatewayCard(
                        endpoint = gw,
                        onClick = {
                            gatewayViewModel.connect(gw)
                            onComplete()
                        },
                    )
                }
            }
        } else {
            Box(
                modifier = Modifier.weight(1f, fill = false).fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.height(12.dp))
                    Text("Scanning network…", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Manual toggle
        TextButton(onClick = { showManual = !showManual }) {
            Text(if (showManual) "Hide Manual Setup" else "Enter Manually")
        }

        AnimatedVisibility(visible = showManual) {
            Column(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = manualHost,
                    onValueChange = { manualHost = it },
                    label = { Text("Host") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = manualPort,
                    onValueChange = { manualPort = it },
                    label = { Text("Port") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = gatewayToken,
                    onValueChange = { gatewayToken = it },
                    label = { Text("Token (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        if (gatewayToken.isNotBlank()) gatewayViewModel.setToken(gatewayToken.trim())
                        gatewayViewModel.connectManual(manualHost.trim(), manualPort.trim().toIntOrNull() ?: 18789)
                        onComplete()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Connect") }
            }
        }

        Spacer(Modifier.height(16.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onBack) { Text("Back") }
            OutlinedButton(onClick = onSkip) { Text("Skip") }
        }

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun GatewayCard(endpoint: GatewayEndpoint, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.6f),
        tonalElevation = 1.dp,
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.Router, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    endpoint.displayName ?: endpoint.host,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                )
                Text(
                    "${endpoint.host}:${endpoint.port}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// MARK: - Completion

@Composable
private fun CompletionStep(onComplete: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(80.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.primary)
        }
        Spacer(Modifier.height(24.dp))
        Text("You're All Set!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(12.dp))
        Text(
            "CoreBlow is ready. Your phone stays quiet until the gateway wakes it.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(48.dp))
        Button(
            onClick = onComplete,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
        ) { Text("Start Using CoreBlow", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) }
    }
}
