import AppIntents

struct ClearHistoryIntent: AppIntent {
    static var title: LocalizedStringResource = "ClearHistory"
    func perform() async throws -> some IntentResult { .result() }
}
