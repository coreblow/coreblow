import SwabbleKit
import Foundation
enum VoiceWakeRecognitionDebugSupport { static func logRecognitionEvent(transcript: String, confidence: Float, triggerMatched: Bool) { #if DEBUG; print("[VoiceWake] transcript=\"\(transcript)\" conf=\(confidence) match=\(triggerMatched)"); #endif } }
