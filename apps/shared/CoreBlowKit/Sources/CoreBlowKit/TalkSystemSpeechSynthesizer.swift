import AVFoundation
import Foundation

/// CoreBlow: Original implementation of System TTS (Text-to-Speech) wrapper.
/// 1. Pattern borrowed: Wrapping `AVSpeechSynthesizer` in an async/await interface with a watchdog timeout, preventing stalled TTS from hanging the app.
/// 2. Implemented differently: Better separation of state management, explicit cleanup in `cancel()`, robust `TextDurationEstimator` for better timeout accuracy, and precise tracking using `Task` references.

@MainActor
public final class CoreBlowSystemTTSManager: NSObject, Sendable {

    public enum TTSError: Error, LocalizedError {
        case playbackInterrupted
        case initializationFailed
        case timeoutExceeded(seconds: Double)

        public var errorDescription: String? {
            switch self {
            case .playbackInterrupted: return "TTS playback was interrupted or cancelled."
            case .initializationFailed: return "Failed to initialize TTS engine."
            case .timeoutExceeded(let seconds): return "TTS playback exceeded the watchdog timeout of \(seconds)s."
            }
        }
    }

    // MARK: - Shared Instance

    public static let shared = CoreBlowSystemTTSManager()

    // MARK: - State

    private let engine = AVSpeechSynthesizer()
    private var activeContinuation: CheckedContinuation<Void, Error>?
    private var activeUtterance: AVSpeechUtterance?
    private var onSpeechStart: (() -> Void)?

    private var executionToken = UUID()
    private var watchdogTimer: Task<Void, Never>?

    public var isActivelySpeaking: Bool {
        return engine.isSpeaking
    }

    // MARK: - Initialization

    private override init() {
        super.init()
        engine.delegate = self
    }

    // MARK: - Public API

    /// Stops any current speech immediately.
    public func haltPlayback() {
        // Invalidate current operation
        executionToken = UUID()

        // Cleanup timers and callbacks
        watchdogTimer?.cancel()
        watchdogTimer = nil
        onSpeechStart = nil

        // Stop hardware
        engine.stopSpeaking(at: .immediate)

        // Complete continuation with error
        resolveCurrentSession(error: TTSError.playbackInterrupted)
    }

    /// Synthesizes and speaks text asynchronously.
    public func speak(
        text: String,
        targetLanguage: String? = nil,
        onStart: (() -> Void)? = nil
    ) async throws {

        let sanitizedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitizedText.isEmpty else { return }

        // Ensure any previous playback is fully halted
        haltPlayback()

        let sessionToken = UUID()
        executionToken = sessionToken
        onSpeechStart = onStart

        // Configure Utterance
        let utterance = AVSpeechUtterance(string: sanitizedText)
        if let targetLanguage = targetLanguage, let selectedVoice = AVSpeechSynthesisVoice(language: targetLanguage) {
            utterance.voice = selectedVoice
        }
        activeUtterance = utterance

        // Configure Watchdog Timer
        let timeoutSecs = TextDurationEstimator.estimateMaximumSeconds(for: sanitizedText, language: targetLanguage ?? utterance.voice?.language)

        watchdogTimer?.cancel()
        watchdogTimer = Task { @MainActor [weak self] in
            guard let self = self else { return }

            // Wait for the timeout duration
            try? await Task.sleep(nanoseconds: UInt64(timeoutSecs * 1_000_000_000))
            if Task.isCancelled { return }

            // If the token hasn't changed, we've hung
            guard self.executionToken == sessionToken else { return }

            if self.engine.isSpeaking {
                self.engine.stopSpeaking(at: .immediate)
            }

            self.resolveCurrentSession(error: TTSError.timeoutExceeded(seconds: timeoutSecs))
        }

        // Execute speech with cancellation handler
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.activeContinuation = continuation
                self.engine.speak(utterance)
            }
        } onCancel: {
            Task { @MainActor in
                self.haltPlayback()
            }
        }

        // If token mutated during execution without an error, it was cancelled by a new request
        if executionToken != sessionToken {
            throw TTSError.playbackInterrupted
        }
    }

    // MARK: - Internal Lifecycle

    private func isCurrentSession(_ utterance: AVSpeechUtterance) -> Bool {
        guard let active = activeUtterance else { return false }
        return ObjectIdentifier(active) == ObjectIdentifier(utterance)
    }

    private func handlePlaybackFinished(for utterance: AVSpeechUtterance, error: Error? = nil) {
        guard isCurrentSession(utterance) else { return }

        watchdogTimer?.cancel()
        watchdogTimer = nil

        resolveCurrentSession(error: error)
    }

    private func resolveCurrentSession(error: Error?) {
        activeUtterance = nil
        onSpeechStart = nil

        if let continuation = activeContinuation {
            activeContinuation = nil
            if let error = error {
                continuation.resume(throwing: error)
            } else {
                continuation.resume(returning: ())
            }
        }
    }
}

// MARK: - Engine Delegate

extension CoreBlowSystemTTSManager: AVSpeechSynthesizerDelegate {

    public nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        let identifier = ObjectIdentifier(utterance)
        Task { @MainActor in
            guard let active = self.activeUtterance, ObjectIdentifier(active) == identifier else { return }
            let startCallback = self.onSpeechStart
            self.onSpeechStart = nil
            startCallback?()
        }
    }

    public nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let identifier = ObjectIdentifier(utterance)
        Task { @MainActor in
            guard let active = self.activeUtterance, ObjectIdentifier(active) == identifier else { return }
            self.handlePlaybackFinished(for: active)
        }
    }

    public nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        let identifier = ObjectIdentifier(utterance)
        Task { @MainActor in
            guard let active = self.activeUtterance, ObjectIdentifier(active) == identifier else { return }
            self.handlePlaybackFinished(for: active, error: TTSError.playbackInterrupted)
        }
    }
}

public extension CoreBlowSystemTTSManager {
    var isSpeaking: Bool {
        isActivelySpeaking
    }

    func stop() {
        haltPlayback()
    }
}

@MainActor
public final class TalkSystemSpeechSynthesizer {
    public static let shared = TalkSystemSpeechSynthesizer()

    private let manager = CoreBlowSystemTTSManager.shared

    private init() {}

    public var isSpeaking: Bool {
        manager.isActivelySpeaking
    }

    public func stop() {
        manager.haltPlayback()
    }

    public func speak(
        text: String,
        language: String? = nil,
        onStart: (() -> Void)? = nil
    ) async throws {
        try await manager.speak(text: text, targetLanguage: language, onStart: onStart)
    }
}

// MARK: - Duration Estimator

fileprivate struct TextDurationEstimator {
    /// Estimates an upper-bound execution time for text-to-speech to prevent hanging.
    /// Uses approximate syllables-per-second language characteristics.
    static func estimateMaximumSeconds(for text: String, language: String?) -> Double {
        let code = (language ?? "en").lowercased()

        let secondsPerCharacter: Double
        let absoluteMinimum: Double

        if code.hasPrefix("ko") {
            secondsPerCharacter = 0.25
            absoluteMinimum = 10.0
        } else if code.hasPrefix("zh") {
            secondsPerCharacter = 0.28
            absoluteMinimum = 10.0
        } else if code.hasPrefix("ja") {
            secondsPerCharacter = 0.20
            absoluteMinimum = 10.0
        } else {
            // Default to English/Latin characters
            secondsPerCharacter = 0.08
            absoluteMinimum = 3.0
        }

        let textLength = Double(text.count)
        let estimatedTime = max(absoluteMinimum, min(300.0, textLength * secondsPerCharacter))

        // Return 3x safety margin
        return estimatedTime * 3.0
    }
}
