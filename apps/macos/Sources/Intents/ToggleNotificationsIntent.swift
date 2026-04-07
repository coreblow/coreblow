import AppIntents

struct ToggleNotificationsIntent: AppIntent {
    static var title: LocalizedStringResource = "ToggleNotifications"
    static var description = IntentDescription("CoreBlow ToggleNotifications")

    func perform() async throws -> some IntentResult {
        return .result()
    }
}
