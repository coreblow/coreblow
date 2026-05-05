package ai.coreblow.app.gateway

import android.util.Log
import java.security.MessageDigest
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import okhttp3.OkHttpClient

/**
 * TLS configuration for gateway connections.
 *
 * Supports certificate fingerprint pinning for self-signed gateway certificates.
 */
data class GatewayTlsParams(
    val required: Boolean,
    val fingerprint: String?,
)

object GatewayTls {

    private const val TAG = "GatewayTls"

    /**
     * Build an OkHttpClient.Builder with custom TLS trust for the given params.
     *
     * If [params] is null or has no fingerprint, returns a default builder.
     * If a fingerprint is provided, pins against that SHA-256 fingerprint.
     */
    fun configureClient(
        builder: OkHttpClient.Builder,
        params: GatewayTlsParams?,
    ): OkHttpClient.Builder {
        if (params == null || params.fingerprint.isNullOrBlank()) {
            return builder
        }

        val expectedFingerprint = params.fingerprint.lowercase().replace(":", "")

        val trustManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                val cert = chain?.firstOrNull()
                    ?: throw SecurityException("No server certificate presented")

                val actualFingerprint = sha256Fingerprint(cert)
                if (actualFingerprint != expectedFingerprint) {
                    Log.e(TAG, "Certificate fingerprint mismatch: expected=$expectedFingerprint actual=$actualFingerprint")
                    throw SecurityException("Certificate fingerprint mismatch")
                }

                Log.d(TAG, "Certificate fingerprint verified: $actualFingerprint")
            }

            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }

        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, arrayOf<TrustManager>(trustManager), null)

        return builder
            .sslSocketFactory(sslContext.socketFactory, trustManager)
            .hostnameVerifier { _, _ -> true }
    }

    /**
     * Compute SHA-256 fingerprint of an X.509 certificate.
     */
    fun sha256Fingerprint(cert: X509Certificate): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(cert.encoded)
        return hash.joinToString("") { "%02x".format(it) }
    }
}
