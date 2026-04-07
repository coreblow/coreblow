import AppIntents

struct AskAIIntent: AppIntent {
    static var title: LocalizedStringResource = "AskAI"
    static var description = IntentDescription("CoreBlow AskAI")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
