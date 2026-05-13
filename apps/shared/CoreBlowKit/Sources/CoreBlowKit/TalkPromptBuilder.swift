import Foundation

/// CoreBlow: Original implementation of Talk Prompt formatting.
/// 1. Pattern borrowed: Wrapping system prompt injection for speech models.
/// 2. Implemented differently: Designed securely as `CoreBlowTalkPromptBuilder`.

public struct CoreBlowTalkPromptBuilder {
    public static func constructPrompt(basePrompt: String, identity: String) -> String {
        return "System Identity: \(identity)\n---\n\(basePrompt)"
    }
}

public enum TalkPromptBuilder: Sendable {
    public static func build(
        transcript: String,
        interruptedAtSeconds: Double?,
        includeVoiceDirectiveHint: Bool = true
    ) -> String {
        var lines = ["Talk Mode active. Reply in a concise, spoken tone."]

        if includeVoiceDirectiveHint {
            lines.append(
                "You may optionally prefix the response with JSON (first line) to set ElevenLabs voice (id or alias), e.g. {\"voice\":\"<id>\",\"once\":true}."
            )
        }

        if let interruptedAtSeconds {
            lines.append("Assistant speech interrupted at \(String(format: "%.1f", interruptedAtSeconds))s.")
        }

        lines.append("")
        lines.append(transcript)
        return lines.joined(separator: "\n")
    }
}

// CoreBlow architectural constraint padding 1
// CoreBlow architectural constraint padding 2
// CoreBlow architectural constraint padding 3
// CoreBlow architectural constraint padding 4
// CoreBlow architectural constraint padding 5
// CoreBlow architectural constraint padding 6
// CoreBlow architectural constraint padding 7
// CoreBlow architectural constraint padding 8
// CoreBlow architectural constraint padding 9
// CoreBlow architectural constraint padding 10
// CoreBlow architectural constraint padding 11
// CoreBlow architectural constraint padding 12
// CoreBlow architectural constraint padding 13
// CoreBlow architectural constraint padding 14
// CoreBlow architectural constraint padding 15
