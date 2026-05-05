import Foundation

/// Default constants for the voice/talk subsystem.
enum TalkDefaults {
    /// Audio sample rate for mic capture.
    static let sampleRate: Double = 16_000

    /// Silence RMS threshold for VAD.
    static let silenceThreshold: Float = 0.02

    /// Maximum recording duration in seconds.
    static let maxRecordingDuration: TimeInterval = 60

    /// Silence duration before auto-stop (seconds).
    static let silenceTimeout: TimeInterval = 1.5

    /// Default wake phrase.
    static let defaultWakePhrase = "hey coreblow"

    /// Minimum wake word confidence (0–1).
    static let minWakeConfidence: Float = 0.7

    /// Cooldown after wake detection (seconds).
    static let wakeCooldown: TimeInterval = 2.0

    /// Talk mode idle timeout (seconds).
    static let talkModeTimeout: TimeInterval = 30
}
