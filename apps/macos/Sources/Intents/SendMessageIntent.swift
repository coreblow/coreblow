import AppIntents

struct SendMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "SendMessage"
    static var description = IntentDescription("CoreBlow SendMessage")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
