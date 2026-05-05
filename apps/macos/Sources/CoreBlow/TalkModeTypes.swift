import Foundation
enum TalkModeState { case idle, listening, processing, speaking, error(String) }
struct TalkModeResult: Sendable { let transcript: String; let response: String?; let audioData: Data? }
