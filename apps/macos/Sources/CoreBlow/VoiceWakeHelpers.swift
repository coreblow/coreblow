import Foundation
enum VoiceWakeHelpers {
    static func extractCommand(from transcript: String, triggerWords: [String]) -> String? {
        let lower = transcript.lowercased()
        for trigger in triggerWords { if let range = lower.range(of: trigger.lowercased()) { let after = String(transcript[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines); return after.isEmpty ? nil : after } }
        return nil
    }
    static func sanitizeTriggerWords(_ words: [String]) -> [String] { words.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }.filter { !$0.isEmpty } }
}
