import Foundation
import OSLog
import CoreBlowKit
import OSLog
import SwabbleKit
import CoreBlowKit

/// Utility helpers for wake-word text processing. Bridges between raw transcript
/// strings and the segment-timed `WakeWordGate` matching engine.
enum VoiceWakeTextUtils {
    /// Signature for a function that strips trigger words from a transcript.
    typealias TrimWake = (String, [String]) -> String

    private static let trimCharacters = CharacterSet.whitespacesAndNewlines
        .union(.punctuationCharacters)

    /// Normalizes a single token by lowercasing and stripping surrounding
    /// whitespace and punctuation.
    static func normalizeToken(_ token: String) -> String {
        token
            .trimmingCharacters(in: trimCharacters)
            .lowercased()
    }

    /// Checks whether the transcript *starts* with one of the given trigger
    /// phrases by comparing individual word tokens in order.
    static func startsWithTrigger(transcript: String, triggers: [String]) -> Bool {
        let tokens = transcript
            .split(whereSeparator: \.isWhitespace)
            .map { normalizeToken(String($0)) }
            .filter { !$0.isEmpty }
        guard !tokens.isEmpty else { return false }

        for trigger in triggers {
            let triggerTokens = trigger
                .split(whereSeparator: \.isWhitespace)
                .map { normalizeToken(String($0)) }
                .filter { !$0.isEmpty }
            guard !triggerTokens.isEmpty, tokens.count >= triggerTokens.count else { continue }
            if zip(triggerTokens, tokens.prefix(triggerTokens.count)).allSatisfy({ $0 == $1 }) {
                return true
            }
        }
        return false
    }

    /// Extracts a command from a transcript using text-only (non-timed) analysis.
    /// Falls back to `WakeWordGate.matchesTextOnly` for initial detection, then
    /// validates that the trigger appears at the start of the transcript.
    ///
    /// Returns `nil` if no wake word is detected or the command is too short.
    static func textOnlyCommand(
        transcript: String,
        triggers: [String],
        minCommandLength: Int,
        trimWake: TrimWake) -> String?
    {
        guard !transcript.isEmpty else { return nil }
        guard !normalizeToken(transcript).isEmpty else { return nil }
        guard WakeWordGate.matchesTextOnly(text: transcript, triggers: triggers) else { return nil }
        guard startsWithTrigger(transcript: transcript, triggers: triggers) else { return nil }
        let trimmed = trimWake(transcript, triggers)
        guard trimmed.count >= minCommandLength else { return nil }
        return trimmed
    }
}
