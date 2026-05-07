package ai.coreblow.app

/**
 * Voice wake-word detection mode.
 */
enum class VoiceWakeMode(val rawValue: String) {
    Off("off"),
    Foreground("foreground"),
    Always("always"),
    ;

    companion object {
        fun fromRawValue(raw: String?): VoiceWakeMode {
            return entries.firstOrNull { it.rawValue == raw?.trim()?.lowercase() }
                ?: Foreground
        }
    }
}
