import AppIntents

struct ListConversationsIntent: AppIntent {
    static var title: LocalizedStringResource = "ListConversations"
    func perform() async throws -> some IntentResult { .result() }
}
