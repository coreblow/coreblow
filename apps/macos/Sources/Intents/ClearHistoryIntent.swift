import AppIntents

struct ClearHistoryIntent: AppIntent {
    static var title: LocalizedStringResource = "ClearHistory"
    static var description = IntentDescription("CoreBlow ClearHistory")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
