import AppIntents

struct ExportChatIntent: AppIntent {
    static var title: LocalizedStringResource = "ExportChat"
    func perform() async throws -> some IntentResult { .result() }
}
