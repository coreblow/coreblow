package ai.coreblow.app.ui.compose

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
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
            style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center,
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

// MARK: - Step Rail

@Composable
private fun StepRail(currentStep: OnboardingStep) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OnboardingStep.entries.forEachIndexed { index, step ->
            val isCurrent = step == currentStep
            val isPast = step.ordinal < currentStep.ordinal
            Box(
                modifier = Modifier
                    .weight(1f).height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(
                        when {
                            isCurrent -> MaterialTheme.colorScheme.primary
                            isPast -> MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
                            else -> MaterialTheme.colorScheme.outlineVariant
                        },
                    ),
            )
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        OnboardingStep.entries.forEach { step ->
            Text(
                step.name.replace("_", " "),
                fontSize = 10.sp,
                fontWeight = if (step == currentStep) FontWeight.Bold else FontWeight.Normal,
                color = if (step == currentStep) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            )
        }
    }
}

// MARK: - Step Shell

@Composable
private fun StepShell(
    title: String,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        subtitle?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        content()
    }
}

@Composable
private fun InlineDivider() {
    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
}

// MARK: - Permission Components

@Composable
private fun PermissionSectionHeader(title: String) {
    Text(
        title, style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
    )
}

@Composable
private fun PermissionToggleRow(
    label: String,
    caption: String,
    enabled: Boolean,
    granted: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    available: Boolean = true,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                if (granted) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Default.CheckCircle, contentDescription = "Granted",
                        tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
                }
            }
            Text(caption, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(
            checked = enabled,
            onCheckedChange = { if (available) onCheckedChange(it) },
            enabled = available,
        )
    }
}

// MARK: - Final Step

@Composable
private fun FinalStep(
    statusText: String,
    isConnected: Boolean,
    enabledPermissions: String,
    gatewayMethodLabel: String,
    onConnect: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))
        Text("Review & Connect", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Confirm your setup before connecting.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))

        SummaryCard(label = "Connection Method", value = gatewayMethodLabel)
        Spacer(Modifier.height(8.dp))
        SummaryCard(label = "Permissions", value = enabledPermissions)
        Spacer(Modifier.height(8.dp))
        SummaryCard(label = "Status", value = statusText,
            valueColor = if (isConnected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)

        Spacer(Modifier.height(32.dp))

        if (isConnected) {
            FeatureCard(
                icon = Icons.Default.CheckCircle,
                title = "Gateway Connected",
                subtitle = "You're connected. Tap below to finish setup.",
                tint = MaterialTheme.colorScheme.primary,
            )
        }

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = onConnect,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(16.dp),
        ) { Text(if (isConnected) "Finish Setup" else "Connect Now", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) }

        Spacer(Modifier.height(12.dp))
        TextButton(onClick = onBack) { Text("Back") }
        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun SummaryCard(label: String, value: String, valueColor: Color = MaterialTheme.colorScheme.onSurface) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(4.dp))
            Text(value, fontSize = 14.sp, color = valueColor, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun FeatureCard(icon: ImageVector, title: String, subtitle: String, tint: Color = MaterialTheme.colorScheme.primary) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
        border = BorderStroke(1.dp, tint.copy(alpha = 0.3f)),
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(12.dp))
            Column {
                Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun CommandBlock(command: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Text(
            command, modifier = Modifier.padding(12.dp),
            fontSize = 12.sp, fontFamily = FontFamily.Monospace,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
private fun GuideBlock(title: String, body: String) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        Spacer(Modifier.height(2.dp))
        Text(body, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 18.sp)
    }
}

// MARK: - Gateway Mode Components

@Composable
private fun GatewayModeToggle(
    currentMode: String,
    onModeChange: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        GatewayModeChip("Discovery", isSelected = currentMode == "discovery", onClick = { onModeChange("discovery") }, modifier = Modifier.weight(1f))
        GatewayModeChip("Manual", isSelected = currentMode == "manual", onClick = { onModeChange("manual") }, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun GatewayModeChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.height(40.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(10.dp),
        color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
        border = BorderStroke(1.dp, if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.4f) else MaterialTheme.colorScheme.outlineVariant),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Text(label, fontSize = 13.sp, fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun QuickFillChip(label: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Text(label, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ResolvedEndpoint(endpoint: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f))
            .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f), RoundedCornerShape(10.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Link, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.width(8.dp))
        Text(endpoint, fontSize = 12.sp, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurface)
    }
}

// MARK: - Helper Functions

private fun isPermissionGranted(context: Context, permission: String): Boolean {
    return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}

private fun isNotificationListenerEnabled(context: Context): Boolean {
    val pkgName = context.packageName
    val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
    return flat.split(':').any { it.startsWith("$pkgName/") }
}

private fun openNotificationListenerSettings(context: Context) {
    try {
        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
    } catch (_: Throwable) {
        openAppSettings(context)
    }
}

private fun openAppSettings(context: Context) {
    try {
        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    } catch (_: Throwable) { /* ignore */ }
}

private fun hasMotionCapabilities(context: Context): Boolean {
    val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return false
    return sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null || sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null
}

// MARK: - OC-parity: Themed color factories

@Composable
private fun onboardingPrimaryButtonColors() = ButtonDefaults.buttonColors(
    containerColor = MobileUiTokens.BrandAccent,
    contentColor = Color.White,
    disabledContainerColor = MobileUiTokens.BrandAccent.copy(alpha = 0.45f),
    disabledContentColor = Color.White.copy(alpha = 0.9f),
)

@Composable
private fun onboardingTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
    focusedBorderColor = MobileUiTokens.BrandAccent,
    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
    focusedTextColor = MaterialTheme.colorScheme.onSurface,
    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
    cursorColor = MobileUiTokens.BrandAccent,
)

@Composable
private fun onboardingSwitchColors() = SwitchDefaults.colors(
    checkedTrackColor = MobileUiTokens.BrandAccent,
    uncheckedTrackColor = MaterialTheme.colorScheme.outline,
    checkedThumbColor = Color.White,
    uncheckedThumbColor = Color.White,
)

// MARK: - OC-parity: Permission toggle helpers

private enum class PermissionToggle { Discovery, Location, Notifications, Microphone, Camera, Photos, Contacts, Calendar, Motion, Sms, CallLog }
private enum class SpecialAccessToggle { NotificationListener }

private fun isPermissionToggleGranted(context: Context, toggle: PermissionToggle): Boolean = when (toggle) {
    PermissionToggle.Discovery -> isPermissionGranted(context, Manifest.permission.ACCESS_FINE_LOCATION)
    PermissionToggle.Location -> isPermissionGranted(context, Manifest.permission.ACCESS_FINE_LOCATION) || isPermissionGranted(context, Manifest.permission.ACCESS_COARSE_LOCATION)
    PermissionToggle.Notifications -> Build.VERSION.SDK_INT < 33 || isPermissionGranted(context, Manifest.permission.POST_NOTIFICATIONS)
    PermissionToggle.Microphone -> isPermissionGranted(context, Manifest.permission.RECORD_AUDIO)
    PermissionToggle.Camera -> isPermissionGranted(context, Manifest.permission.CAMERA)
    PermissionToggle.Photos -> isPermissionGranted(context, if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_IMAGES else Manifest.permission.READ_EXTERNAL_STORAGE)
    PermissionToggle.Contacts -> isPermissionGranted(context, Manifest.permission.READ_CONTACTS) && isPermissionGranted(context, Manifest.permission.WRITE_CONTACTS)
    PermissionToggle.Calendar -> isPermissionGranted(context, Manifest.permission.READ_CALENDAR) && isPermissionGranted(context, Manifest.permission.WRITE_CALENDAR)
    PermissionToggle.Motion -> isPermissionGranted(context, Manifest.permission.ACTIVITY_RECOGNITION)
    PermissionToggle.Sms -> isPermissionGranted(context, Manifest.permission.SEND_SMS) && isPermissionGranted(context, Manifest.permission.READ_SMS)
    PermissionToggle.CallLog -> isPermissionGranted(context, Manifest.permission.READ_CALL_LOG)
}

private fun qrScannerErrorMessage(): String {
    return "Google Code Scanner could not start. Update Google Play services or use the setup code manually."
}

// MARK: - OC-parity: GatewayStep composable

@Composable
private fun GatewayStep(
    setupCode: String,
    manualHost: String,
    manualPort: String,
    manualTls: Boolean,
    gatewayToken: String,
    gatewayError: String?,
    onScanQrClick: () -> Unit,
    onSetupCodeChange: (String) -> Unit,
    onManualHostChange: (String) -> Unit,
    onManualPortChange: (String) -> Unit,
    onManualTlsChange: (Boolean) -> Unit,
    onTokenChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Run `coreblow qr` on your gateway host, then scan the code with this device.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Button(
            onClick = onScanQrClick,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = onboardingPrimaryButtonColors(),
        ) {
            Text("Scan QR code", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
        }

        OutlinedTextField(
            value = setupCode, onValueChange = onSetupCodeChange,
            label = { Text("Setup Code") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = onboardingTextFieldColors(),
        )

        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))

        Text("Manual Connection", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)

        OutlinedTextField(
            value = manualHost, onValueChange = onManualHostChange,
            label = { Text("Host") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(), colors = onboardingTextFieldColors(),
        )
        OutlinedTextField(
            value = manualPort, onValueChange = onManualPortChange,
            label = { Text("Port") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(), colors = onboardingTextFieldColors(),
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Use TLS", style = MaterialTheme.typography.bodyMedium)
            Switch(checked = manualTls, onCheckedChange = onManualTlsChange, colors = onboardingSwitchColors())
        }
        OutlinedTextField(
            value = gatewayToken, onValueChange = onTokenChange,
            label = { Text("Token (optional)") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(), colors = onboardingTextFieldColors(),
        )

        if (!gatewayError.isNullOrBlank()) {
            Text(gatewayError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
    }
}

// ── Onboarding state machine (OC parity) ────────────────

/**
 * Step definitions for the onboarding wizard.
 */
enum class OnboardingStep(val index: Int, val title: String) {
    WELCOME(0, "Welcome"),
    PERMISSIONS(1, "Permissions"),
    GATEWAY_DISCOVERY(2, "Find Gateway"),
    GATEWAY_QR(3, "Scan QR Code"),
    GATEWAY_MANUAL(4, "Manual Setup"),
    GATEWAY_CONNECT(5, "Connecting"),
    GATEWAY_AUTH(6, "Authentication"),
    GATEWAY_TRUST(7, "Trust Gateway"),
    COMPLETE(8, "Ready"),
    ;

    companion object {
        val initialStep: OnboardingStep = WELCOME
        val permissionStep: OnboardingStep = PERMISSIONS
        val discoveryStep: OnboardingStep = GATEWAY_DISCOVERY
        val completeStep: OnboardingStep = COMPLETE

        fun fromIndex(index: Int): OnboardingStep =
            entries.firstOrNull { it.index == index } ?: WELCOME

        val totalSteps: Int = entries.size
        val progressSteps: Int = entries.size - 1 // exclude COMPLETE
    }

    fun next(): OnboardingStep = entries.getOrNull(ordinal + 1) ?: COMPLETE
    fun previous(): OnboardingStep = entries.getOrNull(ordinal - 1) ?: WELCOME
    fun isFirst(): Boolean = this == WELCOME
    fun isLast(): Boolean = this == COMPLETE
    fun progressFraction(): Float = if (progressSteps == 0) 1f else index.toFloat() / progressSteps.toFloat()
}

/**
 * Full state for the onboarding flow.
 */
data class OnboardingState(
    val currentStep: OnboardingStep = OnboardingStep.WELCOME,
    val canProceed: Boolean = true,
    val canGoBack: Boolean = false,
    val isLoading: Boolean = false,
    val errorText: String? = null,
    val permissionsPending: List<String> = emptyList(),
    val permissionsGranted: List<String> = emptyList(),
    val permissionsDenied: List<String> = emptyList(),
    val discoveredGateways: Int = 0,
    val selectedGatewayStableId: String? = null,
    val gatewayName: String? = null,
    val qrCodeValue: String? = null,
    val manualHost: String = "",
    val manualPort: Int = 18789,
    val manualTls: Boolean = false,
    val gatewayToken: String = "",
    val bootstrapToken: String = "",
    val password: String = "",
    val connectionAttempts: Int = 0,
    val maxConnectionAttempts: Int = 3,
    val trustFingerprint: String? = null,
    val trustStableId: String? = null,
    val completedAtMs: Long? = null,
) {
    val progressFraction: Float get() = currentStep.progressFraction()
    val isComplete: Boolean get() = currentStep == OnboardingStep.COMPLETE
    val hasError: Boolean get() = !errorText.isNullOrBlank()
    val canRetryConnection: Boolean get() = connectionAttempts < maxConnectionAttempts
    val permissionProgress: Float get() {
        val total = permissionsPending.size + permissionsGranted.size + permissionsDenied.size
        return if (total == 0) 1f else permissionsGranted.size.toFloat() / total.toFloat()
    }
}

// ── Onboarding actions (OC parity) ──────────────────────

sealed class OnboardingAction {
    data object Next : OnboardingAction()
    data object Back : OnboardingAction()
    data object Skip : OnboardingAction()
    data object Complete : OnboardingAction()
    data object RetryConnection : OnboardingAction()
    data object ScanQR : OnboardingAction()
    data object ManualSetup : OnboardingAction()
    data class SelectGateway(val stableId: String) : OnboardingAction()
    data class UpdateManualHost(val host: String) : OnboardingAction()
    data class UpdateManualPort(val port: Int) : OnboardingAction()
    data class UpdateManualTls(val tls: Boolean) : OnboardingAction()
    data class UpdateToken(val token: String) : OnboardingAction()
    data class UpdateBootstrapToken(val token: String) : OnboardingAction()
    data class UpdatePassword(val password: String) : OnboardingAction()
    data class PermissionResult(val permission: String, val granted: Boolean) : OnboardingAction()
    data class TrustGateway(val stableId: String, val fingerprint: String) : OnboardingAction()
    data object DeclineTrust : OnboardingAction()
    data class QRScanned(val value: String) : OnboardingAction()
    data object DismissError : OnboardingAction()
}

// ── Onboarding reducer (OC parity) ──────────────────────

fun reduceOnboarding(state: OnboardingState, action: OnboardingAction): OnboardingState = when (action) {
    is OnboardingAction.Next -> state.copy(
        currentStep = state.currentStep.next(),
        canGoBack = true,
        errorText = null,
    )
    is OnboardingAction.Back -> state.copy(
        currentStep = state.currentStep.previous(),
        canGoBack = !state.currentStep.previous().isFirst(),
        errorText = null,
    )
    is OnboardingAction.Skip -> state.copy(
        currentStep = OnboardingStep.COMPLETE,
        completedAtMs = System.currentTimeMillis(),
    )
    is OnboardingAction.Complete -> state.copy(
        currentStep = OnboardingStep.COMPLETE,
        completedAtMs = System.currentTimeMillis(),
        isLoading = false,
    )
    is OnboardingAction.RetryConnection -> state.copy(
        connectionAttempts = state.connectionAttempts + 1,
        isLoading = true,
        errorText = null,
    )
    is OnboardingAction.ScanQR -> state.copy(
        currentStep = OnboardingStep.GATEWAY_QR,
        canGoBack = true,
    )
    is OnboardingAction.ManualSetup -> state.copy(
        currentStep = OnboardingStep.GATEWAY_MANUAL,
        canGoBack = true,
    )
    is OnboardingAction.SelectGateway -> state.copy(
        selectedGatewayStableId = action.stableId,
        currentStep = OnboardingStep.GATEWAY_CONNECT,
        isLoading = true,
    )
    is OnboardingAction.UpdateManualHost -> state.copy(manualHost = action.host)
    is OnboardingAction.UpdateManualPort -> state.copy(manualPort = action.port)
    is OnboardingAction.UpdateManualTls -> state.copy(manualTls = action.tls)
    is OnboardingAction.UpdateToken -> state.copy(gatewayToken = action.token)
    is OnboardingAction.UpdateBootstrapToken -> state.copy(bootstrapToken = action.token)
    is OnboardingAction.UpdatePassword -> state.copy(password = action.password)
    is OnboardingAction.PermissionResult -> {
        val granted = state.permissionsGranted.toMutableList()
        val denied = state.permissionsDenied.toMutableList()
        val pending = state.permissionsPending.toMutableList()
        pending.remove(action.permission)
        if (action.granted) { granted.add(action.permission); denied.remove(action.permission) }
        else { denied.add(action.permission); granted.remove(action.permission) }
        state.copy(permissionsGranted = granted, permissionsDenied = denied, permissionsPending = pending)
    }
    is OnboardingAction.TrustGateway -> state.copy(
        trustFingerprint = action.fingerprint,
        trustStableId = action.stableId,
        currentStep = OnboardingStep.GATEWAY_AUTH,
        isLoading = true,
    )
    is OnboardingAction.DeclineTrust -> state.copy(
        trustFingerprint = null,
        trustStableId = null,
        currentStep = OnboardingStep.GATEWAY_DISCOVERY,
        errorText = "Trust declined. Select a different gateway.",
    )
    is OnboardingAction.QRScanned -> state.copy(
        qrCodeValue = action.value,
        currentStep = OnboardingStep.GATEWAY_CONNECT,
        isLoading = true,
    )
    is OnboardingAction.DismissError -> state.copy(errorText = null)
}

// ── QR code parsing (OC parity) ─────────────────────────

/**
 * Parsed result from a CoreBlow gateway QR code.
 */
data class GatewayQRPayload(
    val host: String,
    val port: Int,
    val tls: Boolean,
    val token: String?,
    val bootstrapToken: String?,
    val stableId: String?,
    val serverName: String?,
) {
    companion object {
        private val QR_PATTERN = Regex("""^coreblow://gateway/([^?]+)\?(.+)$""")

        fun parse(raw: String): GatewayQRPayload? {
            val trimmed = raw.trim()
            if (trimmed.isEmpty()) return null

            // URL-based format: coreblow://gateway/host:port?params
            val match = QR_PATTERN.matchEntire(trimmed)
            if (match != null) {
                val hostPort = match.groupValues[1]
                val params = parseQueryParams(match.groupValues[2])
                val parts = hostPort.split(":")
                val host = parts.getOrNull(0)?.trim().orEmpty()
                val port = parts.getOrNull(1)?.trim()?.toIntOrNull() ?: 18789
                if (host.isEmpty()) return null
                return GatewayQRPayload(
                    host = host, port = port,
                    tls = params["tls"]?.toBooleanStrictOrNull() ?: false,
                    token = params["token"],
                    bootstrapToken = params["bootstrapToken"] ?: params["bootstrap"],
                    stableId = params["stableId"] ?: params["id"],
                    serverName = params["name"],
                )
            }

            // JSON-based fallback
            return try {
                val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
                val obj = json.parseToJsonElement(trimmed) as? kotlinx.serialization.json.JsonObject ?: return null
                val host = (obj["host"] as? kotlinx.serialization.json.JsonPrimitive)?.content?.trim().orEmpty()
                if (host.isEmpty()) return null
                GatewayQRPayload(
                    host = host,
                    port = (obj["port"] as? kotlinx.serialization.json.JsonPrimitive)?.content?.toIntOrNull() ?: 18789,
                    tls = (obj["tls"] as? kotlinx.serialization.json.JsonPrimitive)?.content?.toBooleanStrictOrNull() ?: false,
                    token = (obj["token"] as? kotlinx.serialization.json.JsonPrimitive)?.content?.trim(),
                    bootstrapToken = (obj["bootstrapToken"] as? kotlinx.serialization.json.JsonPrimitive)?.content?.trim(),
                    stableId = (obj["stableId"] as? kotlinx.serialization.json.JsonPrimitive)?.content?.trim(),
                    serverName = (obj["serverName"] as? kotlinx.serialization.json.JsonPrimitive)?.content?.trim(),
                )
            } catch (_: Throwable) { null }
        }

        private fun parseQueryParams(query: String): Map<String, String> {
            return query.split("&").mapNotNull { param ->
                val parts = param.split("=", limit = 2)
                if (parts.size == 2) parts[0].trim() to java.net.URLDecoder.decode(parts[1].trim(), "UTF-8")
                else null
            }.toMap()
        }
    }

    fun toEndpointHost(): String = host
    fun toEndpointPort(): Int = port
    fun displayLabel(): String = serverName ?: "$host:$port"
}

// ── Onboarding analytics (OC parity) ────────────────────

/**
 * Tracks onboarding funnel events for diagnostics.
 */
class OnboardingAnalytics {
    private val events = mutableListOf<OnboardingEvent>()

    fun recordStepEntered(step: OnboardingStep) {
        events.add(OnboardingEvent(type = "step_entered", step = step.name, timestampMs = System.currentTimeMillis()))
    }

    fun recordStepCompleted(step: OnboardingStep) {
        events.add(OnboardingEvent(type = "step_completed", step = step.name, timestampMs = System.currentTimeMillis()))
    }

    fun recordError(step: OnboardingStep, error: String) {
        events.add(OnboardingEvent(type = "error", step = step.name, detail = error, timestampMs = System.currentTimeMillis()))
    }

    fun recordSkip() {
        events.add(OnboardingEvent(type = "skip", step = "", timestampMs = System.currentTimeMillis()))
    }

    fun recordComplete(totalDurationMs: Long) {
        events.add(OnboardingEvent(type = "complete", step = "", detail = "duration=${totalDurationMs}ms", timestampMs = System.currentTimeMillis()))
    }

    fun snapshot(): List<OnboardingEvent> = events.toList()

    fun clear() = events.clear()

    data class OnboardingEvent(
        val type: String,
        val step: String,
        val detail: String? = null,
        val timestampMs: Long,
    )
}

// ── Onboarding permission list (OC parity) ──────────────

/**
 * Permission request definitions for the onboarding flow.
 */
data class OnboardingPermission(
    val key: String,
    val title: String,
    val subtitle: String,
    val required: Boolean,
    val androidPermissions: List<String>,
    val category: PermissionCategory,
) {
    enum class PermissionCategory { MEDIA, DATA, LOCATION, SYSTEM }
}

fun buildOnboardingPermissions(): List<OnboardingPermission> = listOf(
    OnboardingPermission(
        key = "camera", title = "Camera", subtitle = "Capture photos and video for the gateway.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.CAMERA, android.Manifest.permission.RECORD_AUDIO),
        category = OnboardingPermission.PermissionCategory.MEDIA,
    ),
    OnboardingPermission(
        key = "microphone", title = "Microphone", subtitle = "Voice transcription and talk mode.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.RECORD_AUDIO),
        category = OnboardingPermission.PermissionCategory.MEDIA,
    ),
    OnboardingPermission(
        key = "location", title = "Location", subtitle = "Share your location with the gateway.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION),
        category = OnboardingPermission.PermissionCategory.LOCATION,
    ),
    OnboardingPermission(
        key = "contacts", title = "Contacts", subtitle = "Search and manage contacts.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.READ_CONTACTS, android.Manifest.permission.WRITE_CONTACTS),
        category = OnboardingPermission.PermissionCategory.DATA,
    ),
    OnboardingPermission(
        key = "calendar", title = "Calendar", subtitle = "Read and create calendar events.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR),
        category = OnboardingPermission.PermissionCategory.DATA,
    ),
    OnboardingPermission(
        key = "photos", title = "Photos", subtitle = "Access device photo library.",
        required = false,
        androidPermissions = listOf(
            if (android.os.Build.VERSION.SDK_INT >= 33) android.Manifest.permission.READ_MEDIA_IMAGES
            else android.Manifest.permission.READ_EXTERNAL_STORAGE
        ),
        category = OnboardingPermission.PermissionCategory.DATA,
    ),
    OnboardingPermission(
        key = "notifications", title = "Notifications", subtitle = "Receive alerts and service notifications.",
        required = true,
        androidPermissions = if (android.os.Build.VERSION.SDK_INT >= 33) listOf(android.Manifest.permission.POST_NOTIFICATIONS) else emptyList(),
        category = OnboardingPermission.PermissionCategory.SYSTEM,
    ),
    OnboardingPermission(
        key = "sms", title = "SMS", subtitle = "Send and search text messages.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.SEND_SMS, android.Manifest.permission.READ_SMS),
        category = OnboardingPermission.PermissionCategory.DATA,
    ),
    OnboardingPermission(
        key = "callLog", title = "Call Log", subtitle = "Search recent call history.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.READ_CALL_LOG),
        category = OnboardingPermission.PermissionCategory.DATA,
    ),
    OnboardingPermission(
        key = "motion", title = "Motion & Fitness", subtitle = "Track steps and activity.",
        required = false,
        androidPermissions = listOf(android.Manifest.permission.ACTIVITY_RECOGNITION),
        category = OnboardingPermission.PermissionCategory.DATA,
    ),
)

// ── Connection validation (OC parity) ───────────────────

/**
 * Result of gateway connection validation during onboarding.
 */
data class ConnectionValidationResult(
    val ok: Boolean,
    val latencyMs: Long? = null,
    val serverName: String? = null,
    val protocolVersion: String? = null,
    val error: String? = null,
    val requiresTrust: Boolean = false,
    val fingerprint: String? = null,
) {
    companion object {
        fun success(latencyMs: Long, serverName: String?, protocolVersion: String?) =
            ConnectionValidationResult(ok = true, latencyMs = latencyMs, serverName = serverName, protocolVersion = protocolVersion)

        fun failure(error: String) =
            ConnectionValidationResult(ok = false, error = error)

        fun trustRequired(fingerprint: String) =
            ConnectionValidationResult(ok = false, requiresTrust = true, fingerprint = fingerprint, error = "Trust required for TLS certificate.")
    }
}

// ── Onboarding page metadata (OC parity) ────────────────

/**
 * Metadata for each onboarding page/step.
 */
data class OnboardingPageInfo(
    val step: OnboardingStep,
    val title: String,
    val subtitle: String,
    val illustration: String,
    val primaryAction: String,
    val secondaryAction: String? = null,
    val showProgress: Boolean = true,
    val showBackButton: Boolean = false,
)

fun onboardingPageInfoForStep(step: OnboardingStep): OnboardingPageInfo = when (step) {
    OnboardingStep.WELCOME -> OnboardingPageInfo(
        step = step, title = "Welcome to CoreBlow",
        subtitle = "Your phone becomes a powerful node in your personal AI network.",
        illustration = "welcome", primaryAction = "Get Started",
        showProgress = false,
    )
    OnboardingStep.PERMISSIONS -> OnboardingPageInfo(
        step = step, title = "Set Up Permissions",
        subtitle = "Grant access so the gateway can use your device's capabilities.",
        illustration = "permissions", primaryAction = "Continue",
        secondaryAction = "Skip for now", showBackButton = true,
    )
    OnboardingStep.GATEWAY_DISCOVERY -> OnboardingPageInfo(
        step = step, title = "Find Your Gateway",
        subtitle = "Looking for CoreBlow gateways on your local network.",
        illustration = "discovery", primaryAction = "Connect",
        secondaryAction = "Enter manually", showBackButton = true,
    )
    OnboardingStep.GATEWAY_QR -> OnboardingPageInfo(
        step = step, title = "Scan Gateway QR",
        subtitle = "Point your camera at the QR code shown in the gateway dashboard.",
        illustration = "qr", primaryAction = "Scan",
        secondaryAction = "Enter manually", showBackButton = true,
    )
    OnboardingStep.GATEWAY_MANUAL -> OnboardingPageInfo(
        step = step, title = "Manual Connection",
        subtitle = "Enter your gateway's host, port, and credentials.",
        illustration = "manual", primaryAction = "Connect",
        showBackButton = true,
    )
    OnboardingStep.GATEWAY_CONNECT -> OnboardingPageInfo(
        step = step, title = "Connecting…",
        subtitle = "Establishing a secure connection to your gateway.",
        illustration = "connecting", primaryAction = "Cancel",
    )
    OnboardingStep.GATEWAY_AUTH -> OnboardingPageInfo(
        step = step, title = "Authenticating…",
        subtitle = "Verifying your credentials with the gateway.",
        illustration = "auth", primaryAction = "Cancel",
    )
    OnboardingStep.GATEWAY_TRUST -> OnboardingPageInfo(
        step = step, title = "Trust This Gateway?",
        subtitle = "Verify the gateway's TLS certificate fingerprint before connecting.",
        illustration = "trust", primaryAction = "Trust & Connect",
        secondaryAction = "Decline", showBackButton = true,
    )
    OnboardingStep.COMPLETE -> OnboardingPageInfo(
        step = step, title = "You're All Set!",
        subtitle = "CoreBlow is connected and ready. Your phone is now a node.",
        illustration = "complete", primaryAction = "Done",
        showProgress = false,
    )
}

// ── Onboarding text field & switch colors (OC parity) ───

@Composable
internal fun onboardingTextFieldColors() =
    OutlinedTextFieldDefaults.colors(
        focusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedTextColor = MaterialTheme.colorScheme.onSurface,
        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
        cursorColor = MaterialTheme.colorScheme.primary,
    )

@Composable
internal fun onboardingSwitchColors() = androidx.compose.material3.SwitchDefaults.colors(
    checkedThumbColor = MaterialTheme.colorScheme.primary,
    checkedTrackColor = MaterialTheme.colorScheme.primaryContainer,
    uncheckedThumbColor = MaterialTheme.colorScheme.outline,
    uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant,
)

// ── Onboarding error types (OC parity) ──────────────────

/**
 * Typed error for onboarding failures.
 */
sealed class OnboardingError(val message: String, val isRetryable: Boolean) {
    class NetworkError(message: String) : OnboardingError(message, isRetryable = true)
    class AuthError(message: String) : OnboardingError(message, isRetryable = true)
    class TrustError(message: String) : OnboardingError(message, isRetryable = false)
    class PermissionError(message: String) : OnboardingError(message, isRetryable = false)
    class TimeoutError(message: String = "Connection timed out") : OnboardingError(message, isRetryable = true)
    class UnknownError(message: String = "An unexpected error occurred") : OnboardingError(message, isRetryable = true)

    companion object {
        fun from(throwable: Throwable): OnboardingError = when (throwable) {
            is java.net.SocketTimeoutException -> TimeoutError()
            is java.net.ConnectException -> NetworkError("Unable to reach gateway: ${throwable.message}")
            is javax.net.ssl.SSLException -> TrustError("TLS verification failed: ${throwable.message}")
            is SecurityException -> PermissionError("Permission denied: ${throwable.message}")
            else -> UnknownError(throwable.message ?: "Unknown error")
        }
    }

    val userFriendlyMessage: String get() = when (this) {
        is NetworkError -> "Can't reach the gateway. Check your network connection and try again."
        is AuthError -> "Authentication failed. Verify your token or password."
        is TrustError -> "This gateway's certificate is not trusted."
        is PermissionError -> "A required permission was denied."
        is TimeoutError -> "The connection timed out. Try again."
        is UnknownError -> message
    }
}

// ── Gateway deep link parsing (OC parity) ───────────────

/**
 * Parses a CoreBlow deep link for gateway connection.
 * Supports both coreblow:// and https:// schemes.
 */
data class GatewayDeepLink(
    val host: String,
    val port: Int,
    val tls: Boolean,
    val token: String?,
    val stableId: String?,
) {
    companion object {
        private val DEEP_LINK_REGEX = Regex("""^(?:coreblow|https?)://(?:connect|gateway)/([^/?#]+)(?:\?(.*))?$""")

        fun parse(uri: String): GatewayDeepLink? {
            val trimmed = uri.trim()
            if (trimmed.isEmpty()) return null

            val match = DEEP_LINK_REGEX.matchEntire(trimmed) ?: return null
            val hostPort = match.groupValues[1]
            val queryString = match.groupValues.getOrNull(2).orEmpty()
            val params = queryString.split("&").mapNotNull { param ->
                val parts = param.split("=", limit = 2)
                if (parts.size == 2) parts[0] to parts[1] else null
            }.toMap()

            val parts = hostPort.split(":")
            val host = parts.getOrNull(0)?.trim().orEmpty()
            if (host.isEmpty()) return null
            val port = parts.getOrNull(1)?.toIntOrNull() ?: 18789
            val tls = params["tls"]?.toBooleanStrictOrNull() ?: (port == 443)

            return GatewayDeepLink(
                host = host, port = port, tls = tls,
                token = params["token"]?.trim(),
                stableId = params["id"]?.trim() ?: params["stableId"]?.trim(),
            )
        }
    }
}

// ── Step transition validation (OC parity) ──────────────

/**
 * Validates whether a step transition is allowed.
 */
fun canTransition(from: OnboardingStep, to: OnboardingStep, state: OnboardingState): Boolean = when {
    from == to -> false
    to == OnboardingStep.COMPLETE && state.isLoading -> false
    to == OnboardingStep.GATEWAY_CONNECT && state.selectedGatewayStableId == null && state.manualHost.isBlank() && state.qrCodeValue == null -> false
    to.ordinal > from.ordinal + 1 && to != OnboardingStep.COMPLETE -> false
    else -> true
}
