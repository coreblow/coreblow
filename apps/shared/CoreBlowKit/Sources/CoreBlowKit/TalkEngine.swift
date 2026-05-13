// CoreBlowKit/Features/TalkEngine.swift
// Text-to-speech engine using AVSpeechSynthesizer (no ElevenLabs dependency).

import Foundation
import AVFoundation

/// Voice configuration for TTS.
public struct TalkVoice: Sendable, Hashable, Codable {
    public let identifier: String
    public let name: String
    public let language: String
    public let quality: String

    public init(identifier: String, name: String, language: String, quality: String = "default") {
        self.identifier = identifier; self.name = name
        self.language = language; self.quality = quality
    }
}

/// Talk directive specifying what and how to speak.
public struct TalkDirective: Sendable, Codable, Equatable {
    public let text: String
    public let voiceId: String?
    public let rate: Float?
    public let pitch: Float?
    public let volume: Float?
    public let language: String?
    public let modelId: String?
    public let speed: Double?
    public let rateWPM: Int?
    public let stability: Double?
    public let similarity: Double?
    public let style: Double?
    public let speakerBoost: Bool?
    public let seed: Int?
    public let normalize: String?
    public let outputFormat: String?
    public let latencyTier: Int?
    public let once: Bool?

    public init(
        text: String = "",
        voiceId: String? = nil,
        rate: Float? = nil,
        pitch: Float? = nil,
        volume: Float? = nil,
        language: String? = nil,
        modelId: String? = nil,
        speed: Double? = nil,
        rateWPM: Int? = nil,
        stability: Double? = nil,
        similarity: Double? = nil,
        style: Double? = nil,
        speakerBoost: Bool? = nil,
        seed: Int? = nil,
        normalize: String? = nil,
        outputFormat: String? = nil,
        latencyTier: Int? = nil,
        once: Bool? = nil
    ) {
        self.text = text; self.voiceId = voiceId; self.rate = rate
        self.pitch = pitch; self.volume = volume; self.language = language
        self.modelId = modelId; self.speed = speed; self.rateWPM = rateWPM
        self.stability = stability; self.similarity = similarity; self.style = style
        self.speakerBoost = speakerBoost; self.seed = seed; self.normalize = normalize
        self.outputFormat = outputFormat; self.latencyTier = latencyTier; self.once = once
    }
}

/// TTS engine state.
public enum TalkState: Sendable {
    case idle
    case speaking
    case paused
}

/// Native TTS engine using AVSpeechSynthesizer.
///
/// Uses platform native voices — no external API dependency.
public final class TalkEngine: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    private let synthesizer = AVSpeechSynthesizer()
    private var stateCallback: ((TalkState) -> Void)?
    private var completionCallback: (() -> Void)?

    public override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// Set callback for state changes.
    public func onStateChange(_ callback: @escaping (TalkState) -> Void) {
        stateCallback = callback
    }

    /// Speak a directive.
    public func speak(_ directive: TalkDirective) {
        stop()
        let utterance = AVSpeechUtterance(string: directive.text)

        if let voiceId = directive.voiceId {
            utterance.voice = AVSpeechSynthesisVoice(identifier: voiceId)
        } else if let lang = directive.language {
            utterance.voice = AVSpeechSynthesisVoice(language: lang)
        }

        utterance.rate = clamp(directive.rate ?? AVSpeechUtteranceDefaultSpeechRate, 0.0, 1.0)
        utterance.pitchMultiplier = clamp(directive.pitch ?? 1.0, 0.5, 2.0)
        utterance.volume = clamp(directive.volume ?? 1.0, 0.0, 1.0)

        synthesizer.speak(utterance)
    }

    /// Stop speaking immediately.
    public func stop() {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }

    /// Pause speech.
    public func pause() {
        if synthesizer.isSpeaking {
            synthesizer.pauseSpeaking(at: .word)
        }
    }

    /// Resume speech.
    public func resume() {
        if synthesizer.isPaused {
            synthesizer.continueSpeaking()
        }
    }

    /// Whether the engine is currently speaking.
    public var isSpeaking: Bool { synthesizer.isSpeaking }

    /// List all available voices.
    public static func availableVoices() -> [TalkVoice] {
        AVSpeechSynthesisVoice.speechVoices().map { voice in
            let quality: String
            switch voice.quality {
            case .enhanced: quality = "enhanced"
            case .premium: quality = "premium"
            default: quality = "default"
            }
            return TalkVoice(
                identifier: voice.identifier,
                name: voice.name,
                language: voice.language,
                quality: quality)
        }
    }

    /// List voices for a specific language.
    public static func voices(for language: String) -> [TalkVoice] {
        availableVoices().filter { $0.language.hasPrefix(language) }
    }

    // MARK: - AVSpeechSynthesizerDelegate

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                   didStart utterance: AVSpeechUtterance) {
        stateCallback?(.speaking)
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                   didFinish utterance: AVSpeechUtterance) {
        stateCallback?(.idle)
        completionCallback?()
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                   didPause utterance: AVSpeechUtterance) {
        stateCallback?(.paused)
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                   didContinue utterance: AVSpeechUtterance) {
        stateCallback?(.speaking)
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                   didCancel utterance: AVSpeechUtterance) {
        stateCallback?(.idle)
    }

    private func clamp<T: Comparable>(_ val: T, _ lo: T, _ hi: T) -> T {
        min(max(val, lo), hi)
    }
}
