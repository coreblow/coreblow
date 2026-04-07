import AppIntents

struct AskAIIntent: AppIntent {
    static var title: LocalizedStringResource = "AskAI"
    func perform() async throws -> some IntentResult { .result() }
}
