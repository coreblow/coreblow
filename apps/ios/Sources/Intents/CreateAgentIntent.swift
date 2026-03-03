import AppIntents

struct CreateAgentIntent: AppIntent {
    static var title: LocalizedStringResource = "CreateAgent"
    func perform() async throws -> some IntentResult { .result() }
}
