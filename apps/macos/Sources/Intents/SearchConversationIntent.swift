import AppIntents

struct SearchConversationIntent: AppIntent {
    static var title: LocalizedStringResource = "SearchConversation"
    static var description = IntentDescription("CoreBlow SearchConversation")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
