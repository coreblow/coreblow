import Foundation
struct TalkModeGatewayConfig: Codable, Sendable { var sttLocale: String = "en-US"; var silenceTimeoutMs: Int = TalkDefaults.silenceTimeoutMs; var maxDurationSec: Int = 60; var voiceId: String? }
