import Foundation
enum VoiceWakeTextUtils {
    static func normalize(_ text: String) -> String {
        text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }

    static func containsTrigger(_ transcript: String, triggers: [String]) -> Bool {
        let normalized = normalize(transcript)
        return triggers.contains { normalized.contains(normalize($0)) }
    }

    static func extractAfterTrigger(_ transcript: String, trigger: String) -> String? {
        let norm = normalize(transcript)
        let trig = normalize(trigger)
        guard let range = norm.range(of: trig) else { return nil }
        let after = String(transcript[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        return after.isEmpty ? nil : after
    }
}
