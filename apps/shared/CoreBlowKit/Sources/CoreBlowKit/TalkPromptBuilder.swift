import Foundation
public enum TalkPromptBuilder {
    public static func buildSystemPrompt(locale: String, context: String?) -> String {
        var prompt = "You are CoreBlow, a helpful AI assistant. Respond concisely for voice conversations. Language: \(locale)."
        if let ctx = context { prompt += " Context: \(ctx)" }; return prompt
    }
}
