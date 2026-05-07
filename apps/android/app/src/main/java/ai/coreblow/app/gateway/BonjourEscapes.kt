package ai.coreblow.app.gateway

/**
 * mDNS TXT record key escaping/unescaping utilities.
 * Handles the Bonjour/mDNS convention of encoding binary data
 * and special characters in DNS-SD TXT records.
 */
object BonjourEscapes {

    /**
     * Unescape a TXT record value from mDNS discovery.
     * Handles common encoding patterns:
     * - \\xHH hex escape sequences
     * - \\NNN octal escape sequences
     * - \\\\ literal backslash
     * - Standard ASCII pass-through
     */
    fun unescapeValue(raw: String): String {
        if (raw.isEmpty()) return raw
        val sb = StringBuilder(raw.length)
        var i = 0
        while (i < raw.length) {
            if (raw[i] == '\\' && i + 1 < raw.length) {
                when (raw[i + 1]) {
                    'x', 'X' -> {
                        // Hex escape: \xHH
                        if (i + 3 < raw.length) {
                            val hex = raw.substring(i + 2, i + 4)
                            try {
                                sb.append(hex.toInt(16).toChar())
                                i += 4
                                continue
                            } catch (_: NumberFormatException) {}
                        }
                        sb.append(raw[i])
                        i++
                    }
                    in '0'..'3' -> {
                        // Octal escape: \NNN
                        if (i + 3 < raw.length) {
                            val octal = raw.substring(i + 1, i + 4)
                            try {
                                val code = octal.toInt(8)
                                if (code in 0..255) {
                                    sb.append(code.toChar())
                                    i += 4
                                    continue
                                }
                            } catch (_: NumberFormatException) {}
                        }
                        sb.append(raw[i])
                        i++
                    }
                    '\\' -> {
                        sb.append('\\')
                        i += 2
                    }
                    'n' -> { sb.append('\n'); i += 2 }
                    't' -> { sb.append('\t'); i += 2 }
                    'r' -> { sb.append('\r'); i += 2 }
                    else -> {
                        sb.append(raw[i])
                        i++
                    }
                }
            } else {
                sb.append(raw[i])
                i++
            }
        }
        return sb.toString()
    }

    /**
     * Escape a value for TXT record storage.
     */
    fun escapeValue(value: String): String {
        val sb = StringBuilder(value.length)
        for (ch in value) {
            when {
                ch == '\\' -> sb.append("\\\\")
                ch == '=' -> sb.append("\\x3d")
                ch.code < 0x20 || ch.code > 0x7E -> {
                    sb.append("\\x%02x".format(ch.code))
                }
                else -> sb.append(ch)
            }
        }
        return sb.toString()
    }

    /**
     * Parse a TXT record string into key-value pairs.
     * Format: "key1=value1" per record entry.
     */
    fun parseTxtRecords(records: List<String>): Map<String, String> {
        val result = mutableMapOf<String, String>()
        for (record in records) {
            val eqIdx = record.indexOf('=')
            if (eqIdx > 0) {
                val key = record.substring(0, eqIdx).trim()
                val value = unescapeValue(record.substring(eqIdx + 1))
                result[key] = value
            } else if (record.isNotBlank()) {
                // Boolean flag (key without value)
                result[record.trim()] = "true"
            }
        }
        return result
    }

    /**
     * Extract a typed value from TXT records.
     */
    fun getInt(records: Map<String, String>, key: String, default: Int = 0): Int {
        return records[key]?.trim()?.toIntOrNull() ?: default
    }

    fun getBool(records: Map<String, String>, key: String, default: Boolean = false): Boolean {
        val v = records[key]?.trim()?.lowercase() ?: return default
        return v == "true" || v == "1" || v == "yes"
    }

    fun getString(records: Map<String, String>, key: String, default: String = ""): String {
        return records[key]?.trim() ?: default
    }
}
