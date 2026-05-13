import Foundation
/// Shim for ElevenLabs TTS integration. Provides a unified interface for TTS providers.
public protocol TTSProvider: Sendable { func synthesize(text: String, voice: String?) async throws -> Data }
public struct ElevenLabsTTSShim: TTSProvider {
    private let apiKey: String; public init(apiKey: String) { self.apiKey = apiKey }
    public func synthesize(text: String, voice: String?) async throws -> Data {
        throw NSError(domain: "TTS", code: 1, userInfo: [NSLocalizedDescriptionKey: "ElevenLabs not configured"])
    }
}

public struct ElevenLabsVoice: Codable, Sendable, Equatable {
    public var voiceId: String
    public var name: String?

    public init(voiceId: String, name: String? = nil) {
        self.voiceId = voiceId
        self.name = name
    }
}

public struct ElevenLabsTTSRequest: Codable, Sendable, Equatable {
    public var text: String
    public var modelId: String?
    public var outputFormat: String?
    public var speed: Double?
    public var stability: Double?
    public var similarity: Double?
    public var style: Double?
    public var speakerBoost: Bool?
    public var seed: Int?
    public var normalize: String?
    public var language: String?
    public var latencyTier: Int?

    public init(
        text: String,
        modelId: String? = nil,
        outputFormat: String? = nil,
        speed: Double? = nil,
        stability: Double? = nil,
        similarity: Double? = nil,
        style: Double? = nil,
        speakerBoost: Bool? = nil,
        seed: Int? = nil,
        normalize: String? = nil,
        language: String? = nil,
        latencyTier: Int? = nil
    ) {
        self.text = text
        self.modelId = modelId
        self.outputFormat = outputFormat
        self.speed = speed
        self.stability = stability
        self.similarity = similarity
        self.style = style
        self.speakerBoost = speakerBoost
        self.seed = seed
        self.normalize = normalize
        self.language = language
        self.latencyTier = latencyTier
    }
}

public struct StreamingPlaybackResult: Sendable, Equatable {
    public var finished: Bool
    public var interruptedAt: Double?

    public init(finished: Bool = true, interruptedAt: Double? = nil) {
        self.finished = finished
        self.interruptedAt = interruptedAt
    }
}

public struct ElevenLabsTTSClient: Sendable {
    private let apiKey: String

    public init(apiKey: String) {
        self.apiKey = apiKey
    }

    public static func validatedLanguage(_ language: String?) -> String? {
        guard let language = language?.trimmingCharacters(in: .whitespacesAndNewlines),
              !language.isEmpty
        else { return nil }
        return language
    }

    public static func validatedOutputFormat(_ outputFormat: String?) -> String? {
        guard let raw = outputFormat?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !raw.isEmpty
        else { return nil }
        if raw == "mp3" { return "mp3_44100_128" }
        if raw.hasPrefix("mp3_") || raw.hasPrefix("pcm_") { return raw }
        return nil
    }

    public static func validatedNormalize(_ normalize: String?) -> String? {
        guard let raw = normalize?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !raw.isEmpty
        else { return nil }
        let accepted = ["auto", "on", "off", "true", "false", "apply_english"]
        return accepted.contains(raw) ? raw : nil
    }

    public func streamSynthesize(
        voiceId: String,
        request: ElevenLabsTTSRequest
    ) -> AsyncThrowingStream<Data, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish(throwing: NSError(
                domain: "CoreBlow.ElevenLabsTTSClient",
                code: 501,
                userInfo: [NSLocalizedDescriptionKey: "ElevenLabs streaming client is not configured in this build."]))
        }
    }

    public func listVoices() async throws -> [ElevenLabsVoice] {
        _ = apiKey
        return []
    }
}

public enum TalkTTSValidation {
    public static func resolveSpeed(speed: Double?, rateWPM: Int?) -> Double? {
        if let speed { return clamp(speed, 0.7, 1.2) }
        guard let rateWPM else { return nil }
        return clamp(Double(rateWPM) / 175.0, 0.7, 1.2)
    }

    public static func validatedStability(_ value: Double?, modelId: String?) -> Double? {
        guard let value else { return nil }
        _ = modelId
        return validatedUnit(value)
    }

    public static func validatedUnit(_ value: Double?) -> Double? {
        guard let value else { return nil }
        return clamp(value, 0.0, 1.0)
    }

    public static func validatedSeed(_ seed: Int?) -> Int? {
        guard let seed, seed >= 0 else { return nil }
        return seed
    }

    public static func validatedLatencyTier(_ tier: Int?) -> Int? {
        guard let tier else { return nil }
        return min(max(tier, 0), 4)
    }

    public static func pcmSampleRate(from outputFormat: String?) -> Double? {
        guard let outputFormat = outputFormat?.lowercased(),
              outputFormat.hasPrefix("pcm_")
        else { return nil }
        let suffix = outputFormat.dropFirst("pcm_".count)
        return Double(suffix)
    }

    private static func clamp(_ value: Double, _ minimum: Double, _ maximum: Double) -> Double {
        min(max(value, minimum), maximum)
    }
}

@MainActor
public final class StreamingAudioPlayer: StreamingAudioPlaying {
    public static let shared = StreamingAudioPlayer()

    private init() {}

    public func play(stream: AsyncThrowingStream<Data, Error>) async -> StreamingPlaybackResult {
        do {
            for try await _ in stream {}
            return StreamingPlaybackResult(finished: true)
        } catch {
            return StreamingPlaybackResult(finished: false)
        }
    }

    public func stop() -> Double? {
        nil
    }
}

@MainActor
public final class PCMStreamingAudioPlayer: PCMStreamingAudioPlaying {
    public static let shared = PCMStreamingAudioPlayer()

    private init() {}

    public func play(stream: AsyncThrowingStream<Data, Error>, sampleRate: Double) async -> StreamingPlaybackResult {
        _ = sampleRate
        do {
            for try await _ in stream {}
            return StreamingPlaybackResult(finished: true)
        } catch {
            return StreamingPlaybackResult(finished: false)
        }
    }

    public func stop() -> Double? {
        nil
    }
}
