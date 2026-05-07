package ai.coreblow.app.node.handlers

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.*
import kotlin.coroutines.resume

/**
 * Manages location capture with FusedLocationProvider.
 * Supports single-shot location fixes, continuous tracking,
 * geofencing, and reverse geocoding.
 */
class LocationCaptureManager(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    companion object {
        private const val TAG = "LocationCaptureMgr"
        private const val DEFAULT_TIMEOUT_MS = 15_000L
        private const val DEFAULT_INTERVAL_MS = 5_000L
        private const val DEFAULT_FASTEST_MS = 2_000L
    }

    private var fusedClient: FusedLocationProviderClient? = null
    private var activeCallback: LocationCallback? = null
    private var lastKnownLocation: Location? = null
    private var isTracking = false

    var onLocationUpdate: ((Location) -> Unit)? = null

    init {
        try {
            fusedClient = LocationServices.getFusedLocationProviderClient(context)
        } catch (e: Exception) {
            Log.e(TAG, "FusedLocation not available: ${e.message}")
        }
    }

    /**
     * Get a single fresh location fix.
     */
    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(
        priority: Int = Priority.PRIORITY_HIGH_ACCURACY,
        timeoutMs: Long = DEFAULT_TIMEOUT_MS,
        includeGeocode: Boolean = false,
    ): LocationResult {
        if (!hasPermission()) return LocationResult.Error("Location permission not granted")

        val client = fusedClient ?: return LocationResult.Error("FusedLocationClient not available")

        // Try last known first for speed
        val lastLocation = try {
            val deferred = CompletableDeferred<Location?>()
            client.lastLocation.addOnSuccessListener { deferred.complete(it) }.addOnFailureListener { deferred.complete(null) }
            deferred.await()
        } catch (_: Throwable) { null }

        // If last location is recent enough (< 30 seconds), use it
        if (lastLocation != null && System.currentTimeMillis() - lastLocation.time < 30_000) {
            lastKnownLocation = lastLocation
            return buildResult(lastLocation, includeGeocode, "cached")
        }

        // Request fresh fix
        val freshLocation = withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine<Location?> { cont ->
                val request = LocationRequest.Builder(priority, DEFAULT_INTERVAL_MS)
                    .setMaxUpdates(1)
                    .setMinUpdateIntervalMillis(DEFAULT_FASTEST_MS)
                    .setWaitForAccurateLocation(true)
                    .build()

                val callback = object : LocationCallback() {
                    override fun onLocationResult(result: LocationResult) {
                        val loc = result.lastLocation
                        if (loc != null && cont.isActive) cont.resume(loc)
                        client.removeLocationUpdates(this)
                    }
                }

                client.requestLocationUpdates(request, callback, Looper.getMainLooper())
                cont.invokeOnCancellation { client.removeLocationUpdates(callback) }
            }
        }

        if (freshLocation != null) {
            lastKnownLocation = freshLocation
            return buildResult(freshLocation, includeGeocode, "fresh")
        }

        // Fallback to last known
        if (lastLocation != null) {
            lastKnownLocation = lastLocation
            return buildResult(lastLocation, includeGeocode, "stale")
        }

        return LocationResult.Error("Could not determine location within ${timeoutMs}ms")
    }

    /**
     * Start continuous location tracking.
     */
    @SuppressLint("MissingPermission")
    fun startTracking(intervalMs: Long = DEFAULT_INTERVAL_MS) {
        if (!hasPermission() || isTracking) return
        val client = fusedClient ?: return

        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { loc ->
                    lastKnownLocation = loc
                    onLocationUpdate?.invoke(loc)
                }
            }
        }

        activeCallback = callback
        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        isTracking = true
        Log.i(TAG, "Location tracking started (interval=${intervalMs}ms)")
    }

    /**
     * Stop continuous location tracking.
     */
    fun stopTracking() {
        activeCallback?.let { fusedClient?.removeLocationUpdates(it) }
        activeCallback = null
        isTracking = false
        Log.i(TAG, "Location tracking stopped")
    }

    /**
     * Get last known location without requesting a new fix.
     */
    fun getLastKnown(): Location? = lastKnownLocation

    /**
     * Check if location permission is granted.
     */
    fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Calculate distance between two points in meters.
     */
    fun distanceBetween(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
        val results = FloatArray(1)
        Location.distanceBetween(lat1, lon1, lat2, lon2, results)
        return results[0]
    }

    // MARK: - Private

    private fun buildResult(location: Location, includeGeocode: Boolean, source: String): LocationResult {
        val geocode = if (includeGeocode) reverseGeocode(location.latitude, location.longitude) else null

        return LocationResult.Success(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = location.accuracy,
            altitude = location.altitude,
            speed = location.speed,
            bearing = location.bearing,
            timestampMs = location.time,
            source = source,
            address = geocode,
        )
    }

    private fun reverseGeocode(lat: Double, lon: Double): String? {
        return try {
            @Suppress("DEPRECATION")
            val addresses = Geocoder(context).getFromLocation(lat, lon, 1)
            addresses?.firstOrNull()?.let { addr ->
                (0..addr.maxAddressLineIndex).joinToString(", ") { addr.getAddressLine(it) }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Geocode failed: ${e.message}")
            null
        }
    }

    sealed class LocationResult {
        data class Success(
            val latitude: Double,
            val longitude: Double,
            val accuracy: Float,
            val altitude: Double,
            val speed: Float,
            val bearing: Float,
            val timestampMs: Long,
            val source: String,
            val address: String?,
        ) : LocationResult() {
            fun toJson(): String = buildJsonObject {
                put("latitude", latitude)
                put("longitude", longitude)
                put("accuracy", accuracy)
                put("altitude", altitude)
                put("speed", speed)
                put("bearing", bearing)
                put("timestampMs", timestampMs)
                put("source", source)
                address?.let { put("address", it) }
            }.toString()
        }

        data class Error(val message: String) : LocationResult() {
            fun toJson(): String = buildJsonObject { put("error", message) }.toString()
        }
    }
}
