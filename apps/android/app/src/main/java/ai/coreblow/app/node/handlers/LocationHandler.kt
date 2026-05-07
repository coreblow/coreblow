package ai.coreblow.app.node.handlers

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.Locale
import kotlin.coroutines.resume

/**
 * Handles location requests for gateway invoke commands.
 * Supports last-known location, fresh GPS fix, reverse geocoding,
 * and location provider status.
 */
class LocationHandler(private val appContext: Context) {

    companion object {
        private const val TAG = "LocationHandler"
        private const val FRESH_FIX_TIMEOUT_MS = 15_000L
        private const val MAX_AGE_MS = 5 * 60_000L // 5 minutes
    }

    private val fusedClient: FusedLocationProviderClient by lazy {
        LocationServices.getFusedLocationProviderClient(appContext)
    }

    /**
     * Get current location. Returns last-known if fresh enough,
     * otherwise requests a fresh fix.
     */
    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(
        highAccuracy: Boolean = true,
        includeGeocoding: Boolean = false,
    ): LocationResult {
        return withContext(Dispatchers.IO) {
            try {
                // Try last known first
                val lastKnown = getLastKnownLocation()
                if (lastKnown != null) {
                    val age = System.currentTimeMillis() - lastKnown.time
                    if (age < MAX_AGE_MS) {
                        return@withContext buildResult(lastKnown, includeGeocoding, "lastKnown")
                    }
                }

                // Request fresh fix
                val fresh = requestFreshFix(highAccuracy)
                if (fresh != null) {
                    return@withContext buildResult(fresh, includeGeocoding, "fresh")
                }

                // Fallback to last known regardless of age
                if (lastKnown != null) {
                    return@withContext buildResult(lastKnown, includeGeocoding, "stale")
                }

                LocationResult(success = false, error = "Location unavailable")
            } catch (e: SecurityException) {
                LocationResult(success = false, error = "Location permission denied")
            } catch (e: Exception) {
                Log.e(TAG, "Location error: ${e.message}")
                LocationResult(success = false, error = e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Check if location services are enabled.
     */
    fun isLocationEnabled(): Boolean {
        val lm = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    /**
     * Get location provider status info.
     */
    fun getProviderStatus(): String {
        val lm = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return buildJsonObject {
            put("gpsEnabled", JsonPrimitive(lm.isProviderEnabled(LocationManager.GPS_PROVIDER)))
            put("networkEnabled", JsonPrimitive(lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)))
            put("passiveEnabled", JsonPrimitive(lm.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)))
            val providers = lm.allProviders
            put("providers", JsonPrimitive(providers.joinToString(",")))
        }.toString()
    }

    /**
     * Reverse geocode a lat/lng pair.
     */
    suspend fun reverseGeocode(lat: Double, lng: Double): String? {
        return withContext(Dispatchers.IO) {
            try {
                if (!Geocoder.isPresent()) return@withContext null
                val geocoder = Geocoder(appContext, Locale.getDefault())
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocation(lat, lng, 1)
                val addr = addresses?.firstOrNull() ?: return@withContext null
                buildJsonObject {
                    put("address", JsonPrimitive(addr.getAddressLine(0) ?: ""))
                    put("city", JsonPrimitive(addr.locality ?: ""))
                    put("state", JsonPrimitive(addr.adminArea ?: ""))
                    put("country", JsonPrimitive(addr.countryName ?: ""))
                    put("countryCode", JsonPrimitive(addr.countryCode ?: ""))
                    put("postalCode", JsonPrimitive(addr.postalCode ?: ""))
                    put("subLocality", JsonPrimitive(addr.subLocality ?: ""))
                    put("thoroughfare", JsonPrimitive(addr.thoroughfare ?: ""))
                }.toString()
            } catch (e: Exception) {
                Log.w(TAG, "Geocoding failed: ${e.message}")
                null
            }
        }
    }

    // MARK: - Private

    @SuppressLint("MissingPermission")
    private suspend fun getLastKnownLocation(): Location? {
        return suspendCancellableCoroutine { cont ->
            fusedClient.lastLocation
                .addOnSuccessListener { location -> cont.resume(location) }
                .addOnFailureListener { cont.resume(null) }
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun requestFreshFix(highAccuracy: Boolean): Location? {
        return withTimeoutOrNull(FRESH_FIX_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val request = LocationRequest.Builder(
                    if (highAccuracy) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                    1000L,
                ).setMaxUpdates(1).build()

                val callback = object : LocationCallback() {
                    override fun onLocationResult(result: com.google.android.gms.location.LocationResult) {
                        fusedClient.removeLocationUpdates(this)
                        cont.resume(result.lastLocation)
                    }
                }

                fusedClient.requestLocationUpdates(request, callback, appContext.mainLooper)

                cont.invokeOnCancellation {
                    fusedClient.removeLocationUpdates(callback)
                }
            }
        }
    }

    private suspend fun buildResult(
        location: Location,
        includeGeocoding: Boolean,
        source: String,
    ): LocationResult {
        var geocodeJson: String? = null
        if (includeGeocoding) {
            geocodeJson = reverseGeocode(location.latitude, location.longitude)
        }

        return LocationResult(
            success = true,
            latitude = location.latitude,
            longitude = location.longitude,
            altitude = if (location.hasAltitude()) location.altitude else null,
            accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else null,
            bearing = if (location.hasBearing()) location.bearing.toDouble() else null,
            speed = if (location.hasSpeed()) location.speed.toDouble() else null,
            timestampMs = location.time,
            provider = location.provider,
            source = source,
            geocodeJson = geocodeJson,
        )
    }
}

data class LocationResult(
    val success: Boolean,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val altitude: Double? = null,
    val accuracy: Double? = null,
    val bearing: Double? = null,
    val speed: Double? = null,
    val timestampMs: Long? = null,
    val provider: String? = null,
    val source: String? = null,
    val geocodeJson: String? = null,
    val error: String? = null,
) {
    fun toJson(): String = buildJsonObject {
        put("success", JsonPrimitive(success))
        latitude?.let { put("latitude", JsonPrimitive(it)) }
        longitude?.let { put("longitude", JsonPrimitive(it)) }
        altitude?.let { put("altitude", JsonPrimitive(it)) }
        accuracy?.let { put("accuracy", JsonPrimitive(it)) }
        bearing?.let { put("bearing", JsonPrimitive(it)) }
        speed?.let { put("speed", JsonPrimitive(it)) }
        timestampMs?.let { put("timestampMs", JsonPrimitive(it)) }
        provider?.let { put("provider", JsonPrimitive(it)) }
        source?.let { put("source", JsonPrimitive(it)) }
        error?.let { put("error", JsonPrimitive(it)) }
    }.toString()
}
