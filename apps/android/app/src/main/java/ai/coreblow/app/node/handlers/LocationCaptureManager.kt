package ai.coreblow.app.node.handlers

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Manages continuous location capture for the LocationHandler.
 *
 * Wraps FusedLocationProviderClient for high-accuracy, battery-efficient
 * location updates emitted as a Kotlin Flow.
 */
class LocationCaptureManager(private val context: Context) {

    companion object {
        private const val TAG = "LocationCaptureManager"
        private const val DEFAULT_INTERVAL_MS = 10_000L
        private const val FASTEST_INTERVAL_MS = 5_000L
    }

    private val fusedClient: FusedLocationProviderClient by lazy {
        LocationServices.getFusedLocationProviderClient(context)
    }

    /**
     * Start continuous location updates as a Flow.
     */
    @SuppressLint("MissingPermission")
    fun trackLocation(intervalMs: Long = DEFAULT_INTERVAL_MS): Flow<Location> = callbackFlow {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    Log.d(TAG, "Location update: ${location.latitude}, ${location.longitude}")
                    trySend(location)
                }
            }
        }

        fusedClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
        Log.i(TAG, "Location tracking started (interval=${intervalMs}ms)")

        awaitClose {
            fusedClient.removeLocationUpdates(callback)
            Log.i(TAG, "Location tracking stopped")
        }
    }

    /**
     * Get the last known location without starting updates.
     */
    @SuppressLint("MissingPermission")
    fun getLastKnown(onResult: (Location?) -> Unit) {
        fusedClient.lastLocation.addOnSuccessListener { location ->
            onResult(location)
        }.addOnFailureListener {
            Log.e(TAG, "Failed to get last location: ${it.message}")
            onResult(null)
        }
    }
}
