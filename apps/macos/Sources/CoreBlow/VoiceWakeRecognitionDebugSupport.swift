import Foundation
import Logging
import SwabbleKit

/// Diagnostic helpers for the voice-wake recognition pipeline. Provides
/// rate-limited logging, text-only fallback matching, and summary formatters
/// used during development and debug builds.
enum VoiceWakeRecognitionDebugSupport {

    /// Condensed view of a recognition result for debug logging.
    struct TranscriptSummary {
        let textOnly: Bool
        let timingCount: Int
    }

    // MARK: - Logging

    /// Determines whether a transcript update should be emitted to the log,
    /// applying deduplication and rate-limiting to avoid flooding the console
    /// during continuous recognition.
    static func shouldLogTranscript(
        transcript: String,
        isFinal: Bool,
        loggerLevel: Logger.Level,
        lastLoggedText: inout String?,
        lastLoggedAt: inout Date?,
        minRepeatInterval: TimeInterval = 0.25) -> Bool
    {
        guard !transcript.isEmpty else { return false }
        guard loggerLevel == .debug || loggerLevel == .trace else { return false }
        if transcript == lastLoggedText,
           !isFinal,
           let last = lastLoggedAt,
           Date().timeIntervalSince(last) < minRepeatInterval
        {
            return false
        }
        lastLoggedText = transcript
        lastLoggedAt = Date()
        return true
    }

    // MARK: - Text-Only Fallback

    /// Creates a synthetic `WakeWordGateMatch` from a text-only detection when
    /// segment timing is unavailable. This allows the voice-wake pipeline to
    /// still fire commands even if the speech recognition backend doesn't
    /// provide per-word timestamps.
    static func textOnlyFallbackMatch(
        transcript: String,
        triggers: [String],
        config: WakeWordGateConfig,
        trimWake: (String, [String]) -> String) -> WakeWordGateMatch?
    {
        guard let command = VoiceWakeTextUtils.textOnlyCommand(
            transcript: transcript,
            triggers: triggers,
            minCommandLength: config.minCommandLength,
            trimWake: trimWake)
        else { return nil }
        return WakeWordGateMatch(triggerEndTime: 0, postGap: 0, command: command)
    }

    // MARK: - Summaries

    /// Builds a condensed summary of a recognition result for structured
    /// debug output.
    static func transcriptSummary(
        transcript: String,
        triggers: [String],
        segments: [WakeWordSegment]) -> TranscriptSummary
    {
        TranscriptSummary(
            textOnly: WakeWordGate.matchesTextOnly(text: transcript, triggers: triggers),
            timingCount: segments.count(where: { $0.start > 0 || $0.duration > 0 }))
    }

    /// Formats a gate match result into a compact debug string.
    static func matchSummary(_ match: WakeWordGateMatch?) -> String {
        match.map {
            "match=true gap=\(String(format: "%.2f", $0.postGap))s cmdLen=\($0.command.count)"
        } ?? "match=false"
    }
}
