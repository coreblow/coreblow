import AppIntents

struct ExportChatIntent: AppIntent {
    static var title: LocalizedStringResource = "ExportChat"
    static var description = IntentDescription("CoreBlow ExportChat")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
