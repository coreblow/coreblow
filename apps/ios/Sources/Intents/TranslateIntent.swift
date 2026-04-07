import AppIntents

struct TranslateIntent: AppIntent {
    static var title: LocalizedStringResource = "Translate"
    func perform() async throws -> some IntentResult { .result() }
}
