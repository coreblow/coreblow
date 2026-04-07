import AppIntents

struct CheckUsageIntent: AppIntent {
    static var title: LocalizedStringResource = "CheckUsage"
    func perform() async throws -> some IntentResult { .result() }
}
