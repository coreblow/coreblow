package ai.coreblow.app.node.handlers

import android.annotation.SuppressLint
import android.content.Context
import android.location.LocationManager
import ai.coreblow.app.gateway.CoreBlowProtocol
import ai.coreblow.app.node.InvokeHandler
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class LocationHandler(private val context: Context) : InvokeHandler {
    override val namespace = CoreBlowProtocol.NS_LOCATION

    @SuppressLint("MissingPermission")
    override suspend fun execute(command: String, params: JsonObject): JsonElement {
        return when (command) {
            "get-location" -> getLocation()
            "start-tracking" -> startTracking(params)
            else -> throw IllegalArgumentException("Unknown command: $command")
        }
    }

    @SuppressLint("MissingPermission")
    private fun getLocation(): JsonElement {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

        val location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            ?: locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)

        return if (location != null) {
            buildJsonObject {
                put("latitude", location.latitude)
                put("longitude", location.longitude)
                put("altitude", location.altitude)
                put("accuracy", location.accuracy.toDouble())
                put("speed", location.speed.toDouble())
                put("bearing", location.bearing.toDouble())
                put("timestamp", location.time)
                put("provider", location.provider ?: "unknown")
            }
        } else {
            buildJsonObject {
                put("error", "no-location-available")
                put("message", "No cached location; GPS may need warm-up time")
            }
        }
    }

    private fun startTracking(params: JsonObject): JsonElement {
        return buildJsonObject {
            put("status", "pending")
            put("message", "Continuous tracking requires FusedLocationProviderClient integration")
        }
    }
}
