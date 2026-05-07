package ai.coreblow.app.gateway

import android.util.Log

/**
 * Escaping and unescaping utilities for Bonjour/mDNS TXT record values.
 * Handles DNS-SD specification encoding for special characters in
 * service names, TXT key-value pairs, and service instance names.
 */
object BonjourEscapes {

    private const val TAG = "BonjourEscapes"

    // Characters that must be escaped in mDNS names
    private val ESCAPE_CHARS = setOf('.', '\\', ' ', '(', ')', '[', ']', '{', '}', '<', '>', ';', ',', '"', '\'')

    /**
     * Escape a value for mDNS TXT record.
     */
    fun escapeValue(value: String): String {
        if (value.isEmpty()) return value
        val sb = StringBuilder(value.length + 10)
        for (c in value) {
            if (c in ESCAPE_CHARS) {
                sb.append('\\').append(c)
            } else if (c.code < 0x20 || c.code > 0x7E) {
                // Non-printable: escape as octal
                sb.append("\\%03d".format(c.code))
            } else {
                sb.append(c)
            }
        }
        return sb.toString()
    }

    /**
     * Unescape a value from mDNS TXT record.
     */
    fun unescapeValue(value: String): String {
        if (!value.contains('\\')) return value
        val sb = StringBuilder(value.length)
        var i = 0
        while (i < value.length) {
            if (value[i] == '\\' && i + 1 < value.length) {
                val next = value[i + 1]
                if (next.isDigit() && i + 3 < value.length) {
                    // Octal escape
                    val octal = value.substring(i + 1, i + 4)
                    val code = octal.toIntOrNull()
                    if (code != null) {
                        sb.append(code.toChar())
                        i += 4
                        continue
                    }
                }
                sb.append(next)
                i += 2
            } else {
                sb.append(value[i])
                i++
            }
        }
        return sb.toString()
    }

    /**
     * Escape a service instance name.
     */
    fun escapeServiceName(name: String): String {
        return name.replace(".", "\\.")
            .replace("\\", "\\\\")
            .take(63) // DNS label max length
    }

    /**
     * Unescape a service instance name.
     */
    fun unescapeServiceName(name: String): String {
        return unescapeValue(name)
    }

    /**
     * Encode a TXT record key-value pair.
     */
    fun encodeTxtPair(key: String, value: String): ByteArray {
        val escaped = escapeValue(value)
        val pair = "$key=$escaped"
        if (pair.length > 255) {
            Log.w(TAG, "TXT pair exceeds 255 bytes: ${pair.take(50)}…")
            return "$key=${escaped.take(255 - key.length - 1)}".toByteArray(Charsets.UTF_8)
        }
        return pair.toByteArray(Charsets.UTF_8)
    }

    /**
     * Decode a TXT record byte array into key-value pairs.
     */
    fun decodeTxtRecords(data: ByteArray): Map<String, String> {
        val result = mutableMapOf<String, String>()
        var offset = 0
        while (offset < data.size) {
            val length = data[offset].toInt() and 0xFF
            if (length == 0 || offset + 1 + length > data.size) break

            val record = String(data, offset + 1, length, Charsets.UTF_8)
            val eqIdx = record.indexOf('=')
            if (eqIdx > 0) {
                val key = record.substring(0, eqIdx)
                val value = unescapeValue(record.substring(eqIdx + 1))
                result[key] = value
            } else {
                result[record] = "true"
            }
            offset += 1 + length
        }
        return result
    }

    /**
     * Validate a service name.
     */
    fun isValidServiceName(name: String): Boolean {
        return name.isNotBlank() &&
            name.length <= 63 &&
            name.all { it.isLetterOrDigit() || it in setOf('-', '_', '.', ' ') }
    }

    /**
     * Sanitize a service name for DNS compatibility.
     */
    fun sanitizeServiceName(name: String): String {
        return name.filter { it.isLetterOrDigit() || it in setOf('-', '_', ' ') }
            .trim()
            .take(63)
            .ifBlank { "CoreBlow" }
    }

    /**
     * Parse a fully qualified domain name.
     */
    fun parseFqdn(fqdn: String): FqdnParts? {
        val parts = fqdn.split(".")
        return if (parts.size >= 4) {
            FqdnParts(
                instanceName = unescapeValue(parts[0]),
                serviceType = "_${parts[1]}",
                protocol = "_${parts[2]}",
                domain = parts.drop(3).joinToString("."),
            )
        } else null
    }

    /**
     * Get a boolean value from TXT records.
     */
    fun getBool(records: Map<String, String>, key: String, default: Boolean = false): Boolean {
        val value = records[key] ?: return default
        return value.lowercase() in setOf("true", "1", "yes", "on")
    }

    /**
     * Get an integer value from TXT records.
     */
    fun getInt(records: Map<String, String>, key: String, default: Int = 0): Int {
        return records[key]?.toIntOrNull() ?: default
    }

    data class FqdnParts(
        val instanceName: String,
        val serviceType: String,
        val protocol: String,
        val domain: String,
    ) {
        val fullServiceType: String get() = "$serviceType.$protocol"
    }
}
