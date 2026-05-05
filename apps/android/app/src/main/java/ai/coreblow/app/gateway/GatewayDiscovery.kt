package ai.coreblow.app.gateway

import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.content.Context
import android.util.Log
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Discovers CoreBlow gateway instances on the local network via mDNS/NSD.
 *
 * Scans for `_coreblow._tcp.` services and emits [GatewayEndpoint] instances.
 */
class GatewayDiscovery(private val context: Context) {

    companion object {
        private const val TAG = "GatewayDiscovery"
        private const val SERVICE_TYPE = "_coreblow._tcp."
    }

    /**
     * Start scanning and emit discovered endpoints as a cold Flow.
     * Stops scanning when the collector is cancelled.
     */
    fun discover(): Flow<GatewayEndpoint> = callbackFlow {
        val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

        val discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {
                Log.d(TAG, "Discovery started for $serviceType")
            }

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                Log.d(TAG, "Service found: ${serviceInfo.serviceName}")
                nsdManager.resolveService(serviceInfo, createResolveListener())
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                Log.d(TAG, "Service lost: ${serviceInfo.serviceName}")
            }

            override fun onDiscoveryStopped(serviceType: String) {
                Log.d(TAG, "Discovery stopped")
            }

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "Discovery start failed: $errorCode")
                close()
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.e(TAG, "Discovery stop failed: $errorCode")
            }
        }

        fun createResolveListener() = object : NsdManager.ResolveListener {
            override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "Resolve failed for ${serviceInfo.serviceName}: $errorCode")
            }

            override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                val host = serviceInfo.host?.hostAddress ?: return
                val port = serviceInfo.port
                val name = serviceInfo.serviceName

                val endpoint = GatewayEndpoint(
                    host = host,
                    port = port,
                    useTls = port == 443 || port == 8443,
                    source = DiscoverySource.BONJOUR,
                    displayName = name,
                )

                Log.i(TAG, "Resolved: $name → $host:$port")
                trySend(endpoint)
            }
        }

        nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)

        awaitClose {
            try {
                nsdManager.stopServiceDiscovery(discoveryListener)
            } catch (e: IllegalArgumentException) {
                Log.w(TAG, "Stop discovery failed: ${e.message}")
            }
        }
    }
}
