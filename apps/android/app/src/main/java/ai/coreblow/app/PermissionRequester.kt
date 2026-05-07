package ai.coreblow.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume

/**
 * Suspendable runtime-permission requester.
 *
 * Wraps [ActivityResultContracts.RequestMultiplePermissions] so that
 * callers can `suspend`-request a set of permissions and receive the
 * granted-state map back.  Shows a rationale dialog when the OS
 * indicates prior denial, and a settings-redirect dialog when
 * permissions are permanently denied.
 *
 * Usage:
 * ```
 * val requester = PermissionRequester(activity)
 * val result = requester.requestIfMissing(listOf(CAMERA, RECORD_AUDIO))
 * ```
 */
class PermissionRequester(private val activity: ComponentActivity) {

    companion object {
        private const val TAG = "PermissionRequester"
        private const val DEFAULT_TIMEOUT_MS = 20_000L
    }

    private val mutex = Mutex()
    private var pending: CompletableDeferred<Map<String, Boolean>>? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private val launcher: ActivityResultLauncher<Array<String>> =
        activity.registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { result ->
            val deferred = pending
            pending = null
            deferred?.complete(result)
        }

    /**
     * Request [permissions] that have not yet been granted.
     *
     * @return a map of permission → granted (true if the user accepted).
     */
    suspend fun requestIfMissing(
        permissions: List<String>,
        timeoutMs: Long = DEFAULT_TIMEOUT_MS,
    ): Map<String, Boolean> = mutex.withLock {

        val missing = permissions.filter { perm ->
            ContextCompat.checkSelfPermission(activity, perm) != PackageManager.PERMISSION_GRANTED
        }

        // Fast path — everything already granted.
        if (missing.isEmpty()) {
            return permissions.associateWith { true }
        }

        // Show rationale if any permission was previously denied.
        val needsRationale = missing.any {
            ActivityCompat.shouldShowRequestPermissionRationale(activity, it)
        }
        if (needsRationale) {
            val proceed = showRationaleDialog(missing)
            if (!proceed) {
                return permissions.associateWith { perm ->
                    ContextCompat.checkSelfPermission(activity, perm) == PackageManager.PERMISSION_GRANTED
                }
            }
        }

        // Launch the OS permission dialog and await the result.
        val deferred = CompletableDeferred<Map<String, Boolean>>()
        pending = deferred

        withContext(Dispatchers.Main) {
            launcher.launch(missing.toTypedArray())
        }

        val result = withContext(Dispatchers.Default) {
            withTimeout(timeoutMs) { deferred.await() }
        }

        // Merge: permissions that were already granted stay granted even
        // if the launcher result didn't mention them.
        val merged = permissions.associateWith { perm ->
            val nowGranted =
                ContextCompat.checkSelfPermission(activity, perm) == PackageManager.PERMISSION_GRANTED
            result[perm] == true || nowGranted
        }

        // If any permission is permanently denied (no rationale shown),
        // guide the user to the system settings page.
        val permanentlyDenied = merged
            .filterValues { !it }
            .keys
            .filter { !ActivityCompat.shouldShowRequestPermissionRationale(activity, it) }

        if (permanentlyDenied.isNotEmpty()) {
            showSettingsDialog(permanentlyDenied)
        }

        Log.d(TAG, "Permission result: $merged")
        return merged
    }

    // ── Rationale dialog ────────────────────────────────────

    private suspend fun showRationaleDialog(permissions: List<String>): Boolean =
        withContext(Dispatchers.Main) {
            if (activity.isFinishing || activity.isDestroyed) return@withContext false

            suspendCancellableCoroutine { cont ->
                val lifecycle = activity.lifecycle
                var dialog: AlertDialog? = null
                var observer: LifecycleEventObserver? = null
                val finished = AtomicBoolean(false)

                val removeObserver = {
                    observer?.let(lifecycle::removeObserver)
                    observer = null
                }

                fun finish(result: Boolean?) {
                    if (!finished.compareAndSet(false, true)) return
                    removeObserver()
                    dialog?.dismiss()
                    if (result != null) cont.resume(result)
                }

                val lifecycleObserver = LifecycleEventObserver { _, event ->
                    if (event == Lifecycle.Event.ON_DESTROY) finish(false)
                }
                observer = lifecycleObserver
                lifecycle.addObserver(lifecycleObserver)
                cont.invokeOnCancellation { mainHandler.post { finish(null) } }

                dialog = AlertDialog.Builder(activity)
                    .setTitle("Permission required")
                    .setMessage(buildRationaleMessage(permissions))
                    .setPositiveButton("Continue") { _, _ -> finish(true) }
                    .setNegativeButton("Not now") { _, _ -> finish(false) }
                    .setOnCancelListener { finish(false) }
                    .show()
            }
        }

    // ── Settings redirect dialog ────────────────────────────

    private suspend fun showSettingsDialog(permissions: List<String>) =
        withContext(Dispatchers.Main) {
            if (activity.isFinishing || activity.isDestroyed) return@withContext

            val lifecycle = activity.lifecycle
            var dialog: AlertDialog? = null
            var observer: LifecycleEventObserver? = null

            val removeObserver = {
                observer?.let(lifecycle::removeObserver)
                observer = null
            }

            val lifecycleObserver = LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_DESTROY) {
                    removeObserver()
                    dialog?.dismiss()
                }
            }
            observer = lifecycleObserver
            lifecycle.addObserver(lifecycleObserver)

            dialog = AlertDialog.Builder(activity)
                .setTitle("Enable permission in Settings")
                .setMessage(buildSettingsMessage(permissions))
                .setPositiveButton("Open Settings") { _, _ ->
                    if (activity.isFinishing || activity.isDestroyed) return@setPositiveButton
                    val intent = Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", activity.packageName, null),
                    )
                    activity.startActivity(intent)
                }
                .setNegativeButton("Cancel", null)
                .setOnDismissListener { removeObserver() }
                .show()
        }

    // ── Helpers ─────────────────────────────────────────────

    private fun buildRationaleMessage(permissions: List<String>): String {
        val labels = permissions.map { permissionLabel(it) }
        return "CoreBlow needs ${labels.joinToString(", ")} permission${if (labels.size > 1) "s" else ""} to continue."
    }

    private fun buildSettingsMessage(permissions: List<String>): String {
        val labels = permissions.map { permissionLabel(it) }
        return "Please enable ${labels.joinToString(", ")} in Android Settings to continue."
    }

    private fun permissionLabel(permission: String): String = when (permission) {
        Manifest.permission.CAMERA -> "Camera"
        Manifest.permission.RECORD_AUDIO -> "Microphone"
        Manifest.permission.ACCESS_FINE_LOCATION -> "Precise Location"
        Manifest.permission.ACCESS_COARSE_LOCATION -> "Location"
        Manifest.permission.READ_CONTACTS -> "Contacts"
        Manifest.permission.READ_CALENDAR -> "Calendar"
        Manifest.permission.SEND_SMS -> "SMS"
        Manifest.permission.READ_SMS -> "SMS"
        Manifest.permission.READ_CALL_LOG -> "Call Log"
        Manifest.permission.ACTIVITY_RECOGNITION -> "Motion"
        Manifest.permission.READ_EXTERNAL_STORAGE -> "Storage"
        Manifest.permission.POST_NOTIFICATIONS -> "Notifications"
        else -> permission.substringAfterLast('.')
    }
}
