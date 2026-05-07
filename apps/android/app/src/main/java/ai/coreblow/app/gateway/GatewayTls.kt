package ai.coreblow.app.gateway

import android.util.Log
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import okhttp3.OkHttpClient

/**
 * Gateway TLS configuration.
 * Supports standard CA-verified TLS, self-signed certificate
 * pinning via SHA-256 fingerprint, and trust-on-first-use (TOFU).
 */
object GatewayTls {

    private const val TAG = "GatewayTls"

    /**
     * Configure an OkHttpClient.Builder with appropriate TLS settings.
     */
    fun configureClient(builder: OkHttpClient.Builder, params: GatewayTlsParams?) {
        if (params == null || !params.required) return

        val fingerprint = params.fingerprint?.trim()

        if (fingerprint.isNullOrEmpty()) {
            // Standard TLS with system trust store — no extra config needed
            Log.d(TAG, "Using system CA trust store")
            return
        }

        // Pin to specific certificate fingerprint
        configurePinnedTrust(builder, fingerprint)
    }

    /**
     * Create a trust manager that accepts a specific certificate fingerprint.
     */
    private fun configurePinnedTrust(builder: OkHttpClient.Builder, fingerprint: String) {
        val normalizedFingerprint = fingerprint
            .replace(":", "")
            .replace(" ", "")
            .lowercase()

        val trustManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                if (chain.isNullOrEmpty()) throw javax.net.ssl.SSLException("No server certificate")

                val serverCert = chain[0]
                val serverFingerprint = calculateFingerprint(serverCert)

                if (serverFingerprint != normalizedFingerprint) {
                    Log.e(TAG, "Certificate fingerprint mismatch!")
                    Log.e(TAG, "Expected: $normalizedFingerprint")
                    Log.e(TAG, "Got:      $serverFingerprint")
                    throw javax.net.ssl.SSLException(
                        "Certificate fingerprint mismatch: expected=$normalizedFingerprint got=$serverFingerprint"
                    )
                }
                Log.d(TAG, "Certificate fingerprint verified")
            }

            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }

        try {
            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(null, arrayOf<TrustManager>(trustManager), SecureRandom())

            builder.sslSocketFactory(sslContext.socketFactory, trustManager)
            builder.hostnameVerifier { _, _ -> true } // Fingerprint-based trust replaces hostname check
        } catch (e: Exception) {
            Log.e(TAG, "Failed to configure pinned TLS: ${e.message}")
        }
    }

    /**
     * Calculate SHA-256 fingerprint of a certificate.
     */
    fun calculateFingerprint(cert: X509Certificate): String {
        return try {
            val md = java.security.MessageDigest.getInstance("SHA-256")
            val digest = md.digest(cert.encoded)
            digest.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to calculate fingerprint: ${e.message}")
            ""
        }
    }

    /**
     * Get a TOFU (Trust On First Use) trust manager that accepts any cert
     * on first connection and stores the fingerprint for future verification.
     */
    fun createTofuTrustManager(
        onFirstConnect: (fingerprint: String, subject: String) -> Boolean,
        getStoredFingerprint: () -> String?,
        storeFingerprint: (fingerprint: String) -> Unit,
    ): X509TrustManager {
        return object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                if (chain.isNullOrEmpty()) throw javax.net.ssl.SSLException("No certificate")

                val cert = chain[0]
                val fp = calculateFingerprint(cert)
                val stored = getStoredFingerprint()

                when {
                    stored == null -> {
                        // First connection — ask user to trust
                        val subject = cert.subjectDN?.name ?: "Unknown"
                        val trusted = onFirstConnect(fp, subject)
                        if (trusted) {
                            storeFingerprint(fp)
                            Log.i(TAG, "TOFU: Trusted new certificate: $fp")
                        } else {
                            throw javax.net.ssl.SSLException("Certificate not trusted by user")
                        }
                    }
                    stored == fp -> {
                        Log.d(TAG, "TOFU: Certificate matches stored fingerprint")
                    }
                    else -> {
                        Log.e(TAG, "TOFU: Certificate changed! Expected=$stored Got=$fp")
                        throw javax.net.ssl.SSLException(
                            "Certificate changed unexpectedly. This could indicate a MITM attack."
                        )
                    }
                }
            }

            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }
    }

    /**
     * Get the system default trust manager for standard CA verification.
     */
    fun getSystemTrustManager(): X509TrustManager {
        val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        tmf.init(null as KeyStore?)
        return tmf.trustManagers.first { it is X509TrustManager } as X509TrustManager
    }
}
