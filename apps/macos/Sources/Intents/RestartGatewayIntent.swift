import AppIntents

struct RestartGatewayIntent: AppIntent {
    static var title: LocalizedStringResource = "RestartGateway"
    static var description = IntentDescription("CoreBlow RestartGateway")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
