package ai.coreblow.app.ui.compose

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import ai.coreblow.app.MainViewModel

/**
 * Connection tab — the primary gateway configuration screen.
 *
 * Shows status + endpoint cards, a connect/disconnect button,
 * diagnostics report panel, and an expandable "Advanced controls"
 * section with setup-code entry, manual host/port/TLS, token, and
 * password fields.
 */

private enum class ConnectInputMode { SetupCode, Manual }

@Composable
fun ConnectTabScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val statusText by viewModel.statusText.collectAsState()
    val isConnected by viewModel.isConnected.collectAsState()
    val remoteAddress by viewModel.remoteAddress.collectAsState()
    val manualHost by viewModel.manualHost.collectAsState()
    val manualPort by viewModel.manualPort.collectAsState()
    val manualTls by viewModel.manualTls.collectAsState()
    val manualEnabled by viewModel.manualEnabled.collectAsState()
    val gatewayToken by viewModel.gatewayToken.collectAsState()
    val pendingTrust by viewModel.pendingGatewayTrust.collectAsState()

    var advancedOpen by rememberSaveable { mutableStateOf(false) }
    var inputMode by remember(manualEnabled, manualHost, gatewayToken) {
        mutableStateOf(
            if (manualEnabled || manualHost.isNotBlank() || gatewayToken.trim().isNotEmpty())
                ConnectInputMode.Manual else ConnectInputMode.SetupCode,
        )
    }
    var setupCode by rememberSaveable { mutableStateOf("") }
    var manualHostInput by rememberSaveable { mutableStateOf(manualHost.ifBlank { "10.0.2.2" }) }
    var manualPortInput by rememberSaveable { mutableStateOf(manualPort.toString()) }
    var manualTlsInput by rememberSaveable { mutableStateOf(manualTls) }
    var passwordInput by rememberSaveable { mutableStateOf("") }
    var validationText by rememberSaveable { mutableStateOf<String?>(null) }

    val colors = LocalMobileColors.current
    val cardBg = colors.cardSurface
    val border = colors.border
    val accent = colors.accent
    val text = colors.text
    val textSecondary = colors.textSecondary

    // ── Trust dialog ────────────────────────────────────
    if (pendingTrust != null) {
        val prompt = pendingTrust!!
        AlertDialog(
            onDismissRequest = { viewModel.declineGatewayTrustPrompt() },
            containerColor = cardBg,
            title = { Text("Trust this gateway?", fontWeight = FontWeight.SemiBold) },
            text = {
                Text("First-time TLS connection.\n\nVerify this SHA-256 fingerprint:\n${prompt.fingerprintSha256}")
            },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.acceptGatewayTrustPrompt() },
                    colors = ButtonDefaults.textButtonColors(contentColor = accent),
                ) { Text("Trust and continue") }
            },
            dismissButton = {
                TextButton(
                    onClick = { viewModel.declineGatewayTrustPrompt() },
                    colors = ButtonDefaults.textButtonColors(contentColor = textSecondary),
                ) { Text("Cancel") }
            },
        )
    }

    // ── Resolved endpoints ──────────────────────────────
    val setupResolvedEndpoint = remember(setupCode) {
        decodeGatewaySetupCode(setupCode)?.url?.let { parseGatewayEndpoint(it)?.displayUrl }
    }
    val manualResolvedEndpoint = remember(manualHostInput, manualPortInput, manualTlsInput) {
        composeGatewayManualUrl(manualHostInput, manualPortInput, manualTlsInput)
            ?.let { parseGatewayEndpoint(it)?.displayUrl }
    }
    val activeEndpoint = remember(isConnected, remoteAddress, setupResolvedEndpoint, manualResolvedEndpoint, inputMode) {
        when {
            isConnected && !remoteAddress.isNullOrBlank() -> remoteAddress!!
            inputMode == ConnectInputMode.SetupCode -> setupResolvedEndpoint ?: "Not set"
            else -> manualResolvedEndpoint ?: "Not set"
        }
    }

    val showDiagnostics = !isConnected && gatewayStatusHasDiagnostics(statusText)
    val statusLabel = gatewayStatusForDisplay(statusText)

    // ── Main layout ─────────────────────────────────────
    Column(
        modifier = Modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Header
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Gateway Connection", style = MaterialTheme.typography.titleLarge, color = text)
            Text(
                if (isConnected) "Your gateway is active and ready."
                else "Connect to your gateway to get started.",
                style = MaterialTheme.typography.bodyMedium,
                color = textSecondary,
            )
        }

        // Status card
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            color = cardBg,
            border = BorderStroke(1.dp, border),
        ) {
            Column {
                // Endpoint row
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Surface(shape = RoundedCornerShape(10.dp), color = accent.copy(alpha = 0.12f)) {
                        Icon(Icons.Default.Link, null, Modifier.padding(8.dp).size(18.dp), tint = accent)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("Endpoint", style = MaterialTheme.typography.labelSmall, color = textSecondary)
                        Text(activeEndpoint, style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace), color = text)
                    }
                }
                HorizontalDivider(color = border)
                // Status row
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    val successColor = colors.success
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (isConnected) successColor.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
                    ) {
                        Icon(
                            Icons.Default.Cloud, null,
                            Modifier.padding(8.dp).size(18.dp),
                            tint = if (isConnected) successColor else textSecondary,
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("Status", style = MaterialTheme.typography.labelSmall, color = textSecondary)
                        Text(statusText, style = MaterialTheme.typography.bodyMedium, color = if (isConnected) colors.success else text)
                    }
                }
            }
        }

        // ── Connect / Disconnect button ─────────────────
        if (isConnected) {
            Button(
                onClick = { viewModel.disconnect(); validationText = null },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = cardBg, contentColor = colors.danger),
                border = BorderStroke(1.dp, colors.danger.copy(alpha = 0.4f)),
            ) {
                Icon(Icons.Default.PowerSettingsNew, null, Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Disconnect", fontWeight = FontWeight.SemiBold)
            }
        } else {
            Button(
                onClick = {
                    if (statusText.contains("operator offline", ignoreCase = true)) {
                        validationText = null
                        viewModel.refreshGatewayConnection()
                        return@Button
                    }
                    val config = resolveGatewayConnectConfig(
                        useSetupCode = inputMode == ConnectInputMode.SetupCode,
                        setupCode = setupCode,
                        manualHost = manualHostInput,
                        manualPort = manualPortInput,
                        manualTls = manualTlsInput,
                        fallbackToken = gatewayToken,
                        fallbackPassword = passwordInput,
                    )
                    if (config == null) {
                        validationText = if (inputMode == ConnectInputMode.SetupCode)
                            "Paste a valid setup code to connect."
                        else "Enter a valid manual host and port to connect."
                        return@Button
                    }
                    validationText = null
                    viewModel.setManualEnabled(true)
                    viewModel.setManualHost(config.host)
                    viewModel.setManualPort(config.port)
                    viewModel.setManualTls(config.tls)
                    viewModel.setGatewayBootstrapToken(config.bootstrapToken)
                    if (config.token.isNotBlank()) viewModel.setGatewayToken(config.token)
                    else if (config.bootstrapToken.isNotBlank()) viewModel.setGatewayToken("")
                    viewModel.setGatewayPassword(config.password)
                    viewModel.connectManual()
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color.White),
            ) {
                Text("Connect Gateway", fontWeight = FontWeight.Bold)
            }
        }

        // ── Diagnostics banner ──────────────────────────
        if (showDiagnostics) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = colors.warning.copy(alpha = 0.08f),
                border = BorderStroke(1.dp, colors.warning.copy(alpha = 0.25f)),
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text("Last gateway error", fontWeight = FontWeight.SemiBold, color = colors.warning)
                    Text(statusLabel, style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace), color = text)
                    Text("CoreBlow Android ${coreBlowAndroidVersionLabel()}", style = MaterialTheme.typography.labelSmall, color = textSecondary)
                    Button(
                        onClick = {
                            copyGatewayDiagnosticsReport(context = context, screen = "connect tab", gatewayAddress = activeEndpoint, statusText = statusLabel)
                        },
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = cardBg, contentColor = colors.warning),
                        border = BorderStroke(1.dp, colors.warning.copy(alpha = 0.3f)),
                    ) {
                        Icon(Icons.Default.ContentCopy, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Copy Report for CoreBlow", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        // ── Advanced controls toggle ────────────────────
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, border),
            onClick = { advancedOpen = !advancedOpen },
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Advanced controls", fontWeight = FontWeight.SemiBold, color = text)
                    Text("Setup code, endpoint, TLS, token, password.", style = MaterialTheme.typography.labelSmall, color = textSecondary)
                }
                Icon(
                    if (advancedOpen) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (advancedOpen) "Collapse" else "Expand",
                    tint = textSecondary,
                )
            }
        }

        // ── Advanced controls content ───────────────────
        AnimatedVisibility(visible = advancedOpen) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = cardBg,
                border = BorderStroke(1.dp, border),
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Connection method", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = textSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MethodChip("Setup Code", inputMode == ConnectInputMode.SetupCode) { inputMode = ConnectInputMode.SetupCode }
                        MethodChip("Manual", inputMode == ConnectInputMode.Manual) { inputMode = ConnectInputMode.Manual }
                    }

                    Text("Run on the gateway host:", style = MaterialTheme.typography.bodySmall, color = textSecondary)
                    CommandBlock("coreblow qr --setup-code-only")
                    CommandBlock("coreblow qr --json")

                    if (inputMode == ConnectInputMode.SetupCode) {
                        Text("Setup Code", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = textSecondary)
                        OutlinedTextField(
                            value = setupCode,
                            onValueChange = { setupCode = it; validationText = null },
                            placeholder = { Text("Paste setup code", color = textSecondary.copy(alpha = 0.5f)) },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 3, maxLines = 5,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace, color = text),
                            shape = RoundedCornerShape(14.dp),
                            colors = outlinedColors(accent, border, text),
                        )
                        if (!setupResolvedEndpoint.isNullOrBlank()) EndpointPreview(setupResolvedEndpoint, text, textSecondary, border)
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            QuickFillChip("Android Emulator", accent) {
                                manualHostInput = "10.0.2.2"; manualPortInput = "18789"; manualTlsInput = false; validationText = null
                            }
                            QuickFillChip("Localhost", accent) {
                                manualHostInput = "127.0.0.1"; manualPortInput = "18789"; manualTlsInput = false; validationText = null
                            }
                        }

                        Text("Host", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = textSecondary)
                        OutlinedTextField(
                            value = manualHostInput, onValueChange = { manualHostInput = it; validationText = null },
                            placeholder = { Text("10.0.2.2") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(color = text),
                            shape = RoundedCornerShape(14.dp), colors = outlinedColors(accent, border, text),
                        )

                        Text("Port", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = textSecondary)
                        OutlinedTextField(
                            value = manualPortInput, onValueChange = { manualPortInput = it; validationText = null },
                            placeholder = { Text("18789") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace, color = text),
                            shape = RoundedCornerShape(14.dp), colors = outlinedColors(accent, border, text),
                        )

                        Row(Modifier.fillMaxWidth(), Alignment.CenterVertically, Arrangement.SpaceBetween) {
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text("Use TLS", fontWeight = FontWeight.SemiBold, color = text)
                                Text("Secure websocket (wss).", style = MaterialTheme.typography.bodySmall, color = textSecondary)
                            }
                            Switch(
                                checked = manualTlsInput, onCheckedChange = { manualTlsInput = it; validationText = null },
                                colors = SwitchDefaults.colors(checkedTrackColor = accent, uncheckedTrackColor = border, checkedThumbColor = Color.White, uncheckedThumbColor = Color.White),
                            )
                        }

                        Text("Token (optional)", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = textSecondary)
                        OutlinedTextField(
                            value = gatewayToken, onValueChange = { viewModel.setGatewayToken(it) },
                            placeholder = { Text("token") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(color = text),
                            shape = RoundedCornerShape(14.dp), colors = outlinedColors(accent, border, text),
                        )

                        Text("Password (optional)", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = textSecondary)
                        OutlinedTextField(
                            value = passwordInput, onValueChange = { passwordInput = it },
                            placeholder = { Text("password") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(color = text),
                            shape = RoundedCornerShape(14.dp), colors = outlinedColors(accent, border, text),
                        )

                        if (!manualResolvedEndpoint.isNullOrBlank()) EndpointPreview(manualResolvedEndpoint, text, textSecondary, border)
                    }

                    HorizontalDivider(color = border)
                    TextButton(onClick = { viewModel.setOnboardingCompleted(false) }) {
                        Text("Run onboarding again", fontWeight = FontWeight.SemiBold, color = accent)
                    }
                }
            }
        }

        if (!validationText.isNullOrBlank()) {
            Text(validationText!!, style = MaterialTheme.typography.labelSmall, color = colors.warning)
        }
    }
}

// ── Helper composables ──────────────────────────────────

@Composable
private fun MethodChip(label: String, active: Boolean, onClick: () -> Unit) {
    val colors = LocalMobileColors.current
    Button(
        onClick = onClick,
        modifier = Modifier.height(40.dp),
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (active) colors.accent else MaterialTheme.colorScheme.surface,
            contentColor = if (active) Color.White else colors.text,
        ),
        border = BorderStroke(1.dp, if (active) colors.accent else colors.border),
    ) { Text(label, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelSmall) }
}

@Composable
private fun QuickFillChip(label: String, accent: Color, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
        colors = ButtonDefaults.buttonColors(containerColor = accent.copy(alpha = 0.12f), contentColor = accent),
        elevation = null,
    ) { Text(label, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelSmall) }
}

@Composable
private fun CommandBlock(command: String) {
    val colors = LocalMobileColors.current
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        border = BorderStroke(1.dp, colors.border),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(3.dp).height(42.dp).background(colors.accent))
            Text(command, Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                color = colors.text)
        }
    }
}

@Composable
private fun EndpointPreview(endpoint: String, text: Color, secondary: Color, border: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HorizontalDivider(color = border)
        Text("Resolved endpoint", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = secondary)
        Text(endpoint, style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace), color = text)
        HorizontalDivider(color = border)
    }
}

@Composable
private fun outlinedColors(accent: Color, border: Color, text: Color) =
    OutlinedTextFieldDefaults.colors(
        focusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        focusedBorderColor = accent,
        unfocusedBorderColor = border,
        focusedTextColor = text,
        unfocusedTextColor = text,
        cursorColor = accent,
    )
