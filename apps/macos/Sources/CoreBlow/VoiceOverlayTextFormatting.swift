import Foundation
enum VoiceOverlayTextFormatting { static func format(transcript: String, trigger: String) -> (before: String, command: String)? { guard let range = transcript.lowercased().range(of: trigger.lowercased()) else { return nil }; return (String(transcript[..<range.lowerBound]), String(transcript[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)) } }
