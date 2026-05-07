package ai.coreblow.app

/**
 * Wake-word list management — parsing, validation, and sanitisation.
 */
object WakeWords {

    const val MAX_WORDS = 32
    const val MAX_WORD_LENGTH = 64

    /** Split a comma-separated input string into trimmed, non-empty words. */
    fun parseCommaSeparated(input: String): List<String> {
        return input.split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
    }

    /**
     * Parse [input] only if it differs from [current].
     * Returns the new list, or `null` if nothing changed.
     */
    fun parseIfChanged(input: String, current: List<String>): List<String>? {
        val parsed = parseCommaSeparated(input)
        return if (parsed == current) null else parsed
    }

    /**
     * Sanitise a word list: trim, de-blank, enforce count + length limits,
     * fall back to [defaults] if the result is empty.
     */
    fun sanitize(words: List<String>, defaults: List<String>): List<String> {
        val cleaned = words
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .take(MAX_WORDS)
            .map { it.take(MAX_WORD_LENGTH) }
        return cleaned.ifEmpty { defaults }
    }
}
