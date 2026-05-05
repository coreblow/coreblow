import EventKit; import Foundation
public enum RemindersCommands {
    public static func list(completed: Bool? = nil) async throws -> [[String: Any]] {
        let store = EKEventStore(); try await store.requestFullAccessToReminders()
        return try await withCheckedThrowingContinuation { cont in
            let pred = store.predicateForReminders(in: nil); store.fetchReminders(matching: pred) { reminders in
                let items = (reminders ?? []).filter { completed == nil || $0.isCompleted == completed }.map { ["title": $0.title ?? "", "completed": $0.isCompleted] as [String: Any] }
                cont.resume(returning: items)
            }
        }
    }
}
