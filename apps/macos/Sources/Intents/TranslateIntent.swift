import AppIntents

struct TranslateIntent: AppIntent {
    static var title: LocalizedStringResource = "Translate"
    static var description = IntentDescription("CoreBlow Translate")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
