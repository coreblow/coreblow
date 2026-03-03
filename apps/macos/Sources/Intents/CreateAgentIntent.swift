import AppIntents

struct CreateAgentIntent: AppIntent {
    static var title: LocalizedStringResource = "CreateAgent"
    static var description = IntentDescription("CoreBlow CreateAgent")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
