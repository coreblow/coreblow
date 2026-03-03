import AppIntents

struct CheckUsageIntent: AppIntent {
    static var title: LocalizedStringResource = "CheckUsage"
    static var description = IntentDescription("CoreBlow CheckUsage")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
