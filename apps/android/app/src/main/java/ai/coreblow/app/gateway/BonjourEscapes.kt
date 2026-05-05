package ai.coreblow.app.gateway

/**
 * Escaping utilities for mDNS/Bonjour service names and TXT records.
 *
 * Bonjour service names have specific character restrictions. This object
 * provides encode/decode for safe transport of arbitrary strings.
 */
object BonjourEscapes {

    private val UNSAFE_CHARS = Regex("[^a-zA-Z0-9._-]")

    /**
     * Escape a string for use in a Bonjour service name.
     * Replaces unsafe characters with their hex-encoded form (%XX).
     */
    fun encode(input: String): String {
        return UNSAFE_CHARS.replace(input) { match ->
            val byte = match.value[0].code
            "%%%02x".format(byte)
        }
    }

    /**
     * Decode a Bonjour-escaped string back to its original form.
     */
    fun decode(input: String): String {
        return Regex("%([0-9a-fA-F]{2})").replace(input) { match ->
            val code = match.groupValues[1].toInt(16)
            code.toChar().toString()
        }
    }

    /**
     * Sanitize a display name for use as a Bonjour service name.
     * Truncates to 63 chars (DNS label limit) after encoding.
     */
    fun sanitizeServiceName(name: String): String {
        val encoded = encode(name.trim())
        return if (encoded.length > 63) encoded.substring(0, 63) else encoded
    }

    /**
     * Parse a Bonjour TXT record value.
     * TXT records are key=value pairs separated by null bytes.
     */
    fun parseTxtRecord(data: Map<String, ByteArray?>): Map<String, String> {
        return data.mapValues { (_, bytes) ->
            bytes?.toString(Charsets.UTF_8) ?: ""
        }
    }
}
