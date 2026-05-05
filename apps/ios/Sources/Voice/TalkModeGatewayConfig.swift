import Foundation

/// Gateway-pushed configuration for talk mode behavior.
struct TalkModeGatewayConfig: Codable {
    let language: String
    let sttModel: String
    let ttsVoice: String
    let maxDurationMs: Int
    let silenceTimeoutMs: Int
    let streamAudio: Bool
    let autoRespond: Bool

    init(
        language: String = "en-US",
        sttModel: String = "default",
        ttsVoice: String = "default",
        maxDurationMs: Int = 30_000,
        silenceTimeoutMs: Int = 1_500,
        streamAudio: Bool = false,
        autoRespond: Bool = true
    ) {
        self.language = language
        self.sttModel = sttModel
        self.ttsVoice = ttsVoice
        self.maxDurationMs = maxDurationMs
        self.silenceTimeoutMs = silenceTimeoutMs
        self.streamAudio = streamAudio
        self.autoRespond = autoRespond
    }

    /// Parse from gateway JSON payload.
    static func from(json: [String: Any]) -> TalkModeGatewayConfig {
        TalkModeGatewayConfig(
            language: json["language"] as? String ?? "en-US",
            sttModel: json["sttModel"] as? String ?? "default",
            ttsVoice: json["ttsVoice"] as? String ?? "default",
            maxDurationMs: json["maxDurationMs"] as? Int ?? 30_000,
            silenceTimeoutMs: json["silenceTimeoutMs"] as? Int ?? 1_500,
            streamAudio: json["streamAudio"] as? Bool ?? false,
            autoRespond: json["autoRespond"] as? Bool ?? true
        )
    }

    var maxDuration: TimeInterval { Double(maxDurationMs) / 1000 }
    var silenceTimeout: TimeInterval { Double(silenceTimeoutMs) / 1000 }
}
