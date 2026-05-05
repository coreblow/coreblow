import Foundation
public struct TalkConfig: Codable, Sendable { public var sttLocale: String = "en-US"; public var silenceTimeoutMs: Int = 1500; public var maxDurationSec: Int = 60; public var ttsVoice: String?; public var ttsProvider: String? }
public enum TalkConfigParsing { public static func parse(from json: String) -> TalkConfig? { guard let d = json.data(using: .utf8) else { return nil }; return try? JSONDecoder().decode(TalkConfig.self, from: d) } }
