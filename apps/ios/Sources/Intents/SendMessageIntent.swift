import AppIntents

struct SendMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "SendMessage"
    func perform() async throws -> some IntentResult { .result() }
}
