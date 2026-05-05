import Foundation

public struct WakeWordSegment: Sendable, Equatable {
    public let text: String; public let start: TimeInterval; public let duration: TimeInterval; public let range: Range<String.Index>?
    public init(text: String, start: TimeInterval, duration: TimeInterval, range: Range<String.Index>? = nil) { self.text = text; self.start = start; self.duration = duration; self.range = range }
    public var end: TimeInterval { start + duration }
}

public struct WakeWordGateConfig: Sendable, Equatable {
    public var triggers: [String]; public var minPostTriggerGap: TimeInterval; public var minCommandLength: Int
    public init(triggers: [String], minPostTriggerGap: TimeInterval = 0.45, minCommandLength: Int = 1) { self.triggers = triggers; self.minPostTriggerGap = minPostTriggerGap; self.minCommandLength = minCommandLength }
}

public struct WakeWordGateMatch: Sendable, Equatable {
    public let triggerEndTime: TimeInterval; public let postGap: TimeInterval; public let command: String
    public init(triggerEndTime: TimeInterval, postGap: TimeInterval, command: String) { self.triggerEndTime = triggerEndTime; self.postGap = postGap; self.command = command }
}

public enum WakeWordGate {
    private struct Token { let normalized: String; let start: TimeInterval; let end: TimeInterval; let range: Range<String.Index>?; let text: String }
    private struct TriggerTokens { let tokens: [String] }
    private struct MatchCandidate { let index: Int; let triggerEnd: TimeInterval; let gap: TimeInterval }

    public static func match(transcript: String, segments: [WakeWordSegment], config: WakeWordGateConfig) -> WakeWordGateMatch? {
        let triggerSets = normalizeTriggers(config.triggers)
        guard !triggerSets.isEmpty else { return nil }
        let tokens = normalizeSegments(segments)
        guard !tokens.isEmpty else { return nil }

        var best: MatchCandidate?
        for trigger in triggerSets {
            let count = trigger.tokens.count
            guard count > 0, tokens.count > count else { continue }
            for i in 0...(tokens.count - count - 1) {
                let matched = (0..<count).allSatisfy { tokens[i + $0].normalized == trigger.tokens[$0] }
                guard matched else { continue }
                let triggerEnd = tokens[i + count - 1].end
                let gap = tokens[i + count].start - triggerEnd
                guard gap >= config.minPostTriggerGap else { continue }
                if let b = best, i <= b.index { continue }
                best = MatchCandidate(index: i, triggerEnd: triggerEnd, gap: gap)
            }
        }
        guard let best else { return nil }
        let cmd = commandText(transcript: transcript, segments: segments, triggerEndTime: best.triggerEnd)
            .trimmingCharacters(in: trimSet)
        guard cmd.count >= config.minCommandLength else { return nil }
        return WakeWordGateMatch(triggerEndTime: best.triggerEnd, postGap: best.gap, command: cmd)
    }

    public static func commandText(transcript _: String, segments: [WakeWordSegment], triggerEndTime: TimeInterval) -> String {
        let threshold = triggerEndTime + 0.001
        var words: [String] = []; words.reserveCapacity(segments.count)
        for seg in segments where seg.start >= threshold { let n = normalizeToken(seg.text); if !n.isEmpty { words.append(seg.text) } }
        return words.joined(separator: " ").trimmingCharacters(in: trimSet)
    }

    public static func matchesTextOnly(text: String, triggers: [String]) -> Bool {
        guard !text.isEmpty else { return false }
        let norm = text.lowercased()
        return triggers.contains { !$0.trimmingCharacters(in: trimSet).isEmpty && norm.contains($0.trimmingCharacters(in: trimSet).lowercased()) }
    }

    public static func stripWake(text: String, triggers: [String]) -> String {
        var out = text
        for t in triggers { let token = t.trimmingCharacters(in: trimSet); if !token.isEmpty { out = out.replacingOccurrences(of: token, with: "", options: .caseInsensitive) } }
        return out.trimmingCharacters(in: trimSet)
    }

    private static func normalizeTriggers(_ triggers: [String]) -> [TriggerTokens] {
        triggers.compactMap { t in let tokens = t.split(whereSeparator: \.isWhitespace).map { normalizeToken(String($0)) }.filter { !$0.isEmpty }; return tokens.isEmpty ? nil : TriggerTokens(tokens: tokens) }
    }
    private static func normalizeSegments(_ segments: [WakeWordSegment]) -> [Token] {
        segments.compactMap { s in let n = normalizeToken(s.text); return n.isEmpty ? nil : Token(normalized: n, start: s.start, end: s.end, range: s.range, text: s.text) }
    }
    private static func normalizeToken(_ token: String) -> String { token.trimmingCharacters(in: trimSet).lowercased() }
    private static let trimSet = CharacterSet.whitespacesAndNewlines.union(.punctuationCharacters)
}

#if canImport(Speech)
import Speech
public enum WakeWordSpeechSegments {
    public static func from(transcription: SFTranscription, transcript: String) -> [WakeWordSegment] {
        transcription.segments.map { seg in WakeWordSegment(text: seg.substring, start: seg.timestamp, duration: seg.duration, range: Range(seg.substringRange, in: transcript)) }
    }
}
#endif
