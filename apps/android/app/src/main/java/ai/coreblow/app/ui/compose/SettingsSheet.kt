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
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ai.coreblow.app.BuildConfig
import ai.coreblow.app.LocationMode
import ai.coreblow.app.MainViewModel
import ai.coreblow.app.node.DeviceNotificationListenerService
import ai.coreblow.app.ui.LocalMobileColors

/**
 * Full-page settings sheet with sectioned permission management,
 * lifecycle-aware permission refresh, device info, location mode,
 * and preference toggles.
 */
@Composable
fun SettingsSheet(viewModel: MainViewModel) {
    val colors = LocalMobileColors.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val instanceId by viewModel.instanceId.collectAsState()
    val displayName by viewModel.displayName.collectAsState()
    val cameraEnabled by viewModel.cameraEnabled.collectAsState()
    val locationMode by viewModel.locationMode.collectAsState()
    val locationPreciseEnabled by viewModel.locationPreciseEnabled.collectAsState()
    val preventSleep by viewModel.preventSleep.collectAsState()
    val canvasDebugStatusEnabled by viewModel.canvasDebugStatusEnabled.collectAsState()
    val manualEnabled by viewModel.manualEnabled.collectAsState()
    val manualHost by viewModel.manualHost.collectAsState()
    val manualPort by viewModel.manualPort.collectAsState()
    val manualTls by viewModel.manualTls.collectAsState()
    val gatewayToken by viewModel.gatewayToken.collectAsState()
    val isConnected by viewModel.isConnected.collectAsState()
    val statusText by viewModel.statusText.collectAsState()
    val serverName by viewModel.serverName.collectAsState()

    val listState = rememberLazyListState()
    val deviceModel = remember {
        listOfNotNull(Build.MANUFACTURER, Build.MODEL).joinToString(" ").trim().ifEmpty { "Android" }
    }
    val appVersion = remember {
        val versionName = BuildConfig.VERSION_NAME.trim().ifEmpty { "dev" }
        if (BuildConfig.DEBUG && !versionName.contains("dev", ignoreCase = true)) "$versionName-dev" else versionName
    }
    val listItemColors = ListItemDefaults.colors(
        containerColor = Color.Transparent,
        headlineColor = colors.text,
        supportingColor = colors.textSecondary,
        trailingIconColor = colors.textSecondary,
        leadingIconColor = colors.textSecondary,
    )

    // ── Permission launchers ────────────────────────────

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        viewModel.setCameraEnabled(perms[Manifest.permission.CAMERA] == true)
    }

    var pendingLocationRequest by remember { mutableStateOf(false) }
    var pendingPreciseToggle by remember { mutableStateOf(false) }
    val locationPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        val fineOk = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseOk = perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (pendingPreciseToggle) { pendingPreciseToggle = false; viewModel.setLocationPreciseEnabled(fineOk); return@rememberLauncherForActivityResult }
        if (pendingLocationRequest) { pendingLocationRequest = false; viewModel.setLocationMode(if (fineOk || coarseOk) LocationMode.WhileUsing else LocationMode.Off) }
    }

    var micPermissionGranted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) }
    val audioPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { micPermissionGranted = it }

    val smsPermissionAvailable = remember { BuildConfig.COREBLOW_ENABLE_SMS && context.packageManager?.hasSystemFeature(PackageManager.FEATURE_TELEPHONY) == true }
    val callLogPermissionAvailable = remember { BuildConfig.COREBLOW_ENABLE_CALL_LOG }
    val photosPermission = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_IMAGES else Manifest.permission.READ_EXTERNAL_STORAGE
    val motionAvailable = remember(context) { hasMotionCapabilities(context) }

    var notificationsPermissionGranted by remember { mutableStateOf(hasNotificationsPermission(context)) }
    val notificationsPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { notificationsPermissionGranted = it }

    var notificationListenerEnabled by remember { mutableStateOf(isNotificationListenerEnabled(context)) }

    var photosPermissionGranted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, photosPermission) == PackageManager.PERMISSION_GRANTED) }
    val photosPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { photosPermissionGranted = it }

    var contactsPermissionGranted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CONTACTS) == PackageManager.PERMISSION_GRANTED)
    }
    val contactsPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        contactsPermissionGranted = perms[Manifest.permission.READ_CONTACTS] == true && perms[Manifest.permission.WRITE_CONTACTS] == true
    }

    var calendarPermissionGranted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED)
    }
    val calendarPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        calendarPermissionGranted = perms[Manifest.permission.READ_CALENDAR] == true && perms[Manifest.permission.WRITE_CALENDAR] == true
    }

    var callLogPermissionGranted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) }
    val callLogPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { callLogPermissionGranted = it }

    var motionPermissionGranted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED) }
    val motionPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { motionPermissionGranted = it }

    var smsPermissionGranted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED)
    }
    val smsPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        smsPermissionGranted = perms[Manifest.permission.SEND_SMS] == true && perms[Manifest.permission.READ_SMS] == true
        viewModel.refreshGatewayConnection()
    }

    // ── Lifecycle-aware permission refresh ───────────────

    DisposableEffect(lifecycleOwner, context) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                micPermissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                notificationsPermissionGranted = hasNotificationsPermission(context)
                notificationListenerEnabled = isNotificationListenerEnabled(context)
                photosPermissionGranted = ContextCompat.checkSelfPermission(context, photosPermission) == PackageManager.PERMISSION_GRANTED
                contactsPermissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CONTACTS) == PackageManager.PERMISSION_GRANTED
                calendarPermissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED
                callLogPermissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
                motionPermissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
                smsPermissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // ── Helper functions ────────────────────────────────

    fun setCameraEnabledChecked(checked: Boolean) {
        if (!checked) { viewModel.setCameraEnabled(false); return }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            viewModel.setCameraEnabled(true)
        } else {
            permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }
    }

    fun requestLocationPermissions() {
        val fineOk = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseOk = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (fineOk || coarseOk) { viewModel.setLocationMode(LocationMode.WhileUsing) }
        else { pendingLocationRequest = true; locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }
    }

    fun setPreciseLocationChecked(checked: Boolean) {
        if (!checked) { viewModel.setLocationPreciseEnabled(false); return }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            viewModel.setLocationPreciseEnabled(true)
        } else { pendingPreciseToggle = true; locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)) }
    }

    // ── UI ───────────────────────────────────────────────

    Box(modifier = Modifier.fillMaxSize().background(colors.backgroundGradient)) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxWidth().fillMaxHeight().imePadding().windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // ── DEVICE ──
            item { SectionHeader("DEVICE", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    OutlinedTextField(
                        value = displayName, onValueChange = viewModel::setDisplayName,
                        label = { Text("Name", style = colors.caption1, color = colors.textSecondary) },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                        textStyle = colors.body.copy(color = colors.text),
                        colors = settingsTextFieldColors(colors),
                    )
                    HorizontalDivider(color = colors.border)
                    Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("$deviceModel · $appVersion", style = colors.callout, color = colors.textSecondary)
                        Text(instanceId.take(8) + "…", style = colors.caption1.copy(fontFamily = FontFamily.Monospace), color = colors.textTertiary)
                    }
                }
            }

            // ── MEDIA ──
            item { SectionHeader("MEDIA", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    PermissionRow("Microphone", if (micPermissionGranted) "Granted" else "Required for voice transcription.", micPermissionGranted, listItemColors, colors,
                        onClick = { if (micPermissionGranted) openAppSettings(context) else audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO) })
                    HorizontalDivider(color = colors.border)
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Camera", style = colors.headline) },
                        supportingContent = { Text("Photos and video clips (foreground only).", style = colors.callout) },
                        trailingContent = { Switch(checked = cameraEnabled, onCheckedChange = ::setCameraEnabledChecked) })
                }
            }

            // ── NOTIFICATIONS ──
            item { SectionHeader("NOTIFICATIONS", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    PermissionRow("System Notifications", "Alerts and foreground service.", notificationsPermissionGranted, listItemColors, colors,
                        onClick = { if (notificationsPermissionGranted || Build.VERSION.SDK_INT < 33) openAppSettings(context) else notificationsPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) })
                    HorizontalDivider(color = colors.border)
                    PermissionRow("Notification Listener", "Read and interact with notifications.", notificationListenerEnabled, listItemColors, colors,
                        buttonLabel = if (notificationListenerEnabled) "Manage" else "Enable",
                        onClick = { openNotificationListenerSettings(context) })
                    if (smsPermissionAvailable) {
                        HorizontalDivider(color = colors.border)
                        PermissionRow("SMS", "Send and search SMS from this device.", smsPermissionGranted, listItemColors, colors,
                            onClick = { if (smsPermissionGranted) openAppSettings(context) else smsPermissionLauncher.launch(arrayOf(Manifest.permission.SEND_SMS, Manifest.permission.READ_SMS)) })
                    }
                }
            }

            // ── DATA ACCESS ──
            item { SectionHeader("DATA ACCESS", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    PermissionRow("Photos", "Access recent photos.", photosPermissionGranted, listItemColors, colors,
                        onClick = { if (photosPermissionGranted) openAppSettings(context) else photosPermissionLauncher.launch(photosPermission) })
                    HorizontalDivider(color = colors.border)
                    PermissionRow("Contacts", "Search and add contacts.", contactsPermissionGranted, listItemColors, colors,
                        onClick = { if (contactsPermissionGranted) openAppSettings(context) else contactsPermissionLauncher.launch(arrayOf(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)) })
                    HorizontalDivider(color = colors.border)
                    PermissionRow("Calendar", "Read and create events.", calendarPermissionGranted, listItemColors, colors,
                        onClick = { if (calendarPermissionGranted) openAppSettings(context) else calendarPermissionLauncher.launch(arrayOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR)) })
                    if (callLogPermissionAvailable) {
                        HorizontalDivider(color = colors.border)
                        PermissionRow("Call Log", "Search recent call history.", callLogPermissionGranted, listItemColors, colors,
                            onClick = { if (callLogPermissionGranted) openAppSettings(context) else callLogPermissionLauncher.launch(Manifest.permission.READ_CALL_LOG) })
                    }
                    if (motionAvailable) {
                        HorizontalDivider(color = colors.border)
                        PermissionRow("Motion", "Track steps and activity.", motionPermissionGranted, listItemColors, colors,
                            onClick = { if (motionPermissionGranted) openAppSettings(context) else motionPermissionLauncher.launch(Manifest.permission.ACTIVITY_RECOGNITION) })
                    }
                }
            }

            // ── LOCATION ──
            item { SectionHeader("LOCATION", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Off", style = colors.headline) },
                        supportingContent = { Text("Disable location sharing.", style = colors.callout) },
                        trailingContent = { RadioButton(selected = locationMode == LocationMode.Off, onClick = { viewModel.setLocationMode(LocationMode.Off) }) })
                    HorizontalDivider(color = colors.border)
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("While Using", style = colors.headline) },
                        supportingContent = { Text("Only while CoreBlow is open.", style = colors.callout) },
                        trailingContent = { RadioButton(selected = locationMode == LocationMode.WhileUsing, onClick = { requestLocationPermissions() }) })
                    HorizontalDivider(color = colors.border)
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Precise Location", style = colors.headline) },
                        supportingContent = { Text("Use precise GPS when available.", style = colors.callout) },
                        trailingContent = { Switch(checked = locationPreciseEnabled, onCheckedChange = ::setPreciseLocationChecked, enabled = locationMode != LocationMode.Off) })
                }
            }

            // ── PREFERENCES ──
            item { SectionHeader("PREFERENCES", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Prevent Sleep", style = colors.headline) },
                        supportingContent = { Text("Keep screen awake while open.", style = colors.callout) },
                        trailingContent = { Switch(checked = preventSleep, onCheckedChange = viewModel::setPreventSleep) })
                    HorizontalDivider(color = colors.border)
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Debug Canvas", style = colors.headline) },
                        supportingContent = { Text("Show status overlay on canvas.", style = colors.callout) },
                        trailingContent = { Switch(checked = canvasDebugStatusEnabled, onCheckedChange = viewModel::setCanvasDebugStatusEnabled) })
                }
            }

            // ── GATEWAY ──
            item { SectionHeader("GATEWAY", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Status", style = colors.headline) },
                        supportingContent = {
                            Text(
                                if (isConnected) "Connected" + (serverName?.let { " — $it" } ?: "") else statusText,
                                style = colors.callout,
                                color = if (isConnected) colors.success else colors.textSecondary,
                            )
                        })
                    HorizontalDivider(color = colors.border)
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Manual Connection", style = colors.headline) },
                        supportingContent = { Text("Override discovery with manual settings.", style = colors.callout) },
                        trailingContent = { Switch(checked = manualEnabled, onCheckedChange = viewModel::setManualEnabled) })
                    if (manualEnabled) {
                        HorizontalDivider(color = colors.border)
                        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = manualHost, onValueChange = viewModel::setManualHost,
                                label = { Text("Host", style = colors.caption1, color = colors.textSecondary) },
                                modifier = Modifier.fillMaxWidth(), singleLine = true,
                                textStyle = colors.body.copy(color = colors.text), colors = settingsTextFieldColors(colors),
                            )
                            OutlinedTextField(
                                value = manualPort.toString(), onValueChange = { viewModel.setManualPort(it.toIntOrNull() ?: 18789) },
                                label = { Text("Port", style = colors.caption1, color = colors.textSecondary) },
                                modifier = Modifier.fillMaxWidth(), singleLine = true,
                                textStyle = colors.body.copy(color = colors.text), colors = settingsTextFieldColors(colors),
                            )
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Use TLS", style = colors.headline, color = colors.text)
                                Switch(checked = manualTls, onCheckedChange = viewModel::setManualTls)
                            }
                            OutlinedTextField(
                                value = gatewayToken, onValueChange = viewModel::setGatewayToken,
                                label = { Text("Token", style = colors.caption1, color = colors.textSecondary) },
                                modifier = Modifier.fillMaxWidth(), singleLine = true,
                                textStyle = colors.body.copy(color = colors.text, fontFamily = FontFamily.Monospace), colors = settingsTextFieldColors(colors),
                            )
                        }
                    }
                }
            }

            // ── DANGER ZONE ──
            item { SectionHeader("DANGER ZONE", colors) }
            item {
                Column(modifier = Modifier.settingsRowModifier(colors)) {
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Disconnect", style = colors.headline) },
                        supportingContent = { Text("Close the current gateway connection.", style = colors.callout) },
                        trailingContent = {
                            Button(
                                onClick = { viewModel.disconnect() }, enabled = isConnected,
                                colors = settingsDangerButtonColors(colors), shape = RoundedCornerShape(14.dp),
                            ) { Text("Disconnect", style = colors.callout.copy(fontWeight = FontWeight.Bold)) }
                        })
                    HorizontalDivider(color = colors.border)
                    ListItem(modifier = Modifier.fillMaxWidth(), colors = listItemColors,
                        headlineContent = { Text("Reconnect", style = colors.headline) },
                        supportingContent = { Text("Force a fresh connection to the gateway.", style = colors.callout) },
                        trailingContent = {
                            Button(
                                onClick = { viewModel.refreshGatewayConnection() },
                                colors = settingsPrimaryButtonColors(colors), shape = RoundedCornerShape(14.dp),
                            ) { Text("Reconnect", style = colors.callout.copy(fontWeight = FontWeight.Bold)) }
                        })
                }
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

// ── Supporting composables ──────────────────────────────

@Composable
private fun SectionHeader(title: String, colors: ai.coreblow.app.ui.MobileColors) {
    Text(title, style = colors.caption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp), color = colors.accent)
}

@Composable
private fun PermissionRow(
    title: String, subtitle: String, granted: Boolean,
    listItemColors: androidx.compose.material3.ListItemColors,
    colors: ai.coreblow.app.ui.MobileColors,
    buttonLabel: String = if (granted) "Manage" else "Grant",
    onClick: () -> Unit,
) {
    ListItem(
        modifier = Modifier.fillMaxWidth(), colors = listItemColors,
        headlineContent = { Text(title, style = colors.headline) },
        supportingContent = { Text(subtitle, style = colors.callout) },
        trailingContent = {
            Button(onClick = onClick, colors = settingsPrimaryButtonColors(colors), shape = RoundedCornerShape(14.dp)) {
                Text(buttonLabel, style = colors.callout.copy(fontWeight = FontWeight.Bold))
            }
        },
    )
}

@Composable
private fun settingsTextFieldColors(colors: ai.coreblow.app.ui.MobileColors) =
    OutlinedTextFieldDefaults.colors(
        focusedContainerColor = colors.surface, unfocusedContainerColor = colors.surface,
        focusedBorderColor = colors.accent, unfocusedBorderColor = colors.border,
        focusedTextColor = colors.text, unfocusedTextColor = colors.text, cursorColor = colors.accent,
    )

@Composable
private fun Modifier.settingsRowModifier(colors: ai.coreblow.app.ui.MobileColors) = this
    .fillMaxWidth()
    .border(width = 1.dp, color = colors.border, shape = RoundedCornerShape(14.dp))
    .background(colors.cardSurface, RoundedCornerShape(14.dp))

@Composable
private fun settingsPrimaryButtonColors(colors: ai.coreblow.app.ui.MobileColors) = ButtonDefaults.buttonColors(
    containerColor = colors.accent, contentColor = Color.White,
    disabledContainerColor = colors.accent.copy(alpha = 0.45f), disabledContentColor = Color.White.copy(alpha = 0.9f),
)

@Composable
private fun settingsDangerButtonColors(colors: ai.coreblow.app.ui.MobileColors) = ButtonDefaults.buttonColors(
    containerColor = colors.danger, contentColor = Color.White,
    disabledContainerColor = colors.danger.copy(alpha = 0.45f), disabledContentColor = Color.White.copy(alpha = 0.9f),
)

// ── Utility functions ───────────────────────────────────

private fun openAppSettings(context: Context) {
    context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)))
}

private fun openNotificationListenerSettings(context: Context) {
    runCatching { context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }.getOrElse { openAppSettings(context) }
}

private fun hasNotificationsPermission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < 33) return true
    return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
}

private fun isNotificationListenerEnabled(context: Context): Boolean = DeviceNotificationListenerService.isAccessEnabled(context)

private fun hasMotionCapabilities(context: Context): Boolean {
    val sensorManager = context.getSystemService(SensorManager::class.java) ?: return false
    return sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null || sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
}
