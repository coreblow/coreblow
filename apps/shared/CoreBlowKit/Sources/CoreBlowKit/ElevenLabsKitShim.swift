import Foundation
/// Shim for ElevenLabs TTS integration. Provides a unified interface for TTS providers.
public protocol TTSProvider: Sendable { func synthesize(text: String, voice: String?) async throws -> Data }
public struct ElevenLabsTTSShim: TTSProvider {
    private let apiKey: String; public init(apiKey: String) { self.apiKey = apiKey }
    public func synthesize(text: String, voice: String?) async throws -> Data {
        throw NSError(domain: "TTS", code: 1, userInfo: [NSLocalizedDescriptionKey: "ElevenLabs not configured"])
    }
}
