package ai.coreblow.app.ui.compose

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.widget.Toast
import ai.coreblow.app.BuildConfig

/**
 * Gateway diagnostics utilities — version labels, status formatting,
 * and clipboard-copyable diagnostic reports for troubleshooting.
 */

/** App version label, appending "-dev" for debug builds. */
fun coreBlowAndroidVersionLabel(): String {
    val versionName = BuildConfig.VERSION_NAME.trim().ifEmpty { "dev" }
    return if (BuildConfig.DEBUG && !versionName.contains("dev", ignoreCase = true)) {
        "$versionName-dev"
    } else {
        versionName
    }
}

/** Normalise gateway status text for display. */
fun gatewayStatusForDisplay(statusText: String): String =
    statusText.trim().ifEmpty { "Offline" }

/** True if the status indicates we have something worth diagnosing. */
fun gatewayStatusHasDiagnostics(statusText: String): Boolean {
    val lower = gatewayStatusForDisplay(statusText).lowercase()
    return lower != "offline" && !lower.contains("connecting")
}

/** True if the status looks like a pairing/approval flow. */
fun gatewayStatusLooksLikePairing(statusText: String): Boolean {
    val lower = gatewayStatusForDisplay(statusText).lowercase()
    return lower.contains("pair") || lower.contains("approve")
}

/** Build a structured diagnostics report for clipboard sharing. */
fun buildGatewayDiagnosticsReport(
    screen: String,
    gatewayAddress: String,
    statusText: String,
): String {
    val device = listOfNotNull(Build.MANUFACTURER, Build.MODEL)
        .joinToString(" ").trim().ifEmpty { "Android" }
    val androidVersion = Build.VERSION.RELEASE?.trim().orEmpty()
        .ifEmpty { Build.VERSION.SDK_INT.toString() }
    val endpoint = gatewayAddress.trim().ifEmpty { "unknown" }
    val status = gatewayStatusForDisplay(statusText)
    return """
        Help diagnose this CoreBlow Android gateway connection failure.

        Please:
        - pick one route only: same machine, same LAN, Tailscale, or public URL
        - classify this as pairing/auth, TLS trust, wrong advertised route, wrong address/port, or gateway down
        - quote the exact app status/error below
        - tell me whether `coreblow devices list` should show a pending pairing request
        - if more signal is needed, ask for `coreblow qr --json`, `coreblow devices list`, and `coreblow nodes status`
        - give the next exact command or tap

        Debug info:
        - screen: $screen
        - app version: ${coreBlowAndroidVersionLabel()}
        - device: $device
        - android: $androidVersion (SDK ${Build.VERSION.SDK_INT})
        - gateway address: $endpoint
        - status/error: $status
    """.trimIndent()
}

/** Copy the diagnostics report to the system clipboard. */
fun copyGatewayDiagnosticsReport(
    context: Context,
    screen: String,
    gatewayAddress: String,
    statusText: String,
) {
    val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return
    val report = buildGatewayDiagnosticsReport(
        screen = screen,
        gatewayAddress = gatewayAddress,
        statusText = statusText,
    )
    clipboard.setPrimaryClip(ClipData.newPlainText("CoreBlow gateway diagnostics", report))
    Toast.makeText(context, "Copied gateway diagnostics", Toast.LENGTH_SHORT).show()
}
