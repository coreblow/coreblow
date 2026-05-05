import EventKit
import Foundation

final class RemindersService {
    enum StatusFilter: String { case all, completed, incomplete }

    func list(limit: Int?, status: StatusFilter?) async throws -> CoreBlowRemindersPayload {
        let store = EKEventStore()
        guard Self.canRead(EKEventStore.authorizationStatus(for: .reminder)) else {
            throw NSError(domain: "Reminders", code: 1, userInfo: [NSLocalizedDescriptionKey: "REMINDERS_PERMISSION_REQUIRED"])
        }
        let cap = max(1, min(limit ?? 50, 500))
        let filter = status ?? .incomplete
        let predicate = store.predicateForReminders(in: nil)
        let items: [CoreBlowReminderPayload] = try await withCheckedThrowingContinuation { cont in
            store.fetchReminders(matching: predicate) { reminders in
                let fmt = ISO8601DateFormatter()
                let filtered = (reminders ?? []).filter { r in
                    switch filter {
                    case .all: true
                    case .completed: r.isCompleted
                    case .incomplete: !r.isCompleted
                    }
                }
                cont.resume(returning: Array(filtered.prefix(cap)).map { r in
                    let due = r.dueDateComponents.flatMap { Calendar.current.date(from: $0) }
                    return CoreBlowReminderPayload(identifier: r.calendarItemIdentifier, title: r.title,
                        dueISO: due.map { fmt.string(from: $0) }, completed: r.isCompleted, listName: r.calendar.title)
                })
            }
        }
        return CoreBlowRemindersPayload(reminders: items)
    }

    func add(title: String, notes: String?, dueISO: String?, listId: String?, listName: String?) async throws -> CoreBlowReminderPayload {
        let store = EKEventStore()
        guard Self.canWrite(EKEventStore.authorizationStatus(for: .reminder)) else {
            throw NSError(domain: "Reminders", code: 2, userInfo: [NSLocalizedDescriptionKey: "REMINDERS_PERMISSION_REQUIRED"])
        }
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { throw NSError(domain: "Reminders", code: 3, userInfo: [NSLocalizedDescriptionKey: "title required"]) }
        let reminder = EKReminder(eventStore: store)
        reminder.title = t
        if let n = notes?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty { reminder.notes = n }
        reminder.calendar = try Self.resolveList(store: store, listId: listId, listName: listName)
        if let d = dueISO, let date = ISO8601DateFormatter().date(from: d) {
            reminder.dueDateComponents = Calendar.current.dateComponents([.year,.month,.day,.hour,.minute,.second], from: date)
        }
        try store.save(reminder, commit: true)
        let fmt = ISO8601DateFormatter()
        let due = reminder.dueDateComponents.flatMap { Calendar.current.date(from: $0) }
        return CoreBlowReminderPayload(identifier: reminder.calendarItemIdentifier, title: reminder.title,
            dueISO: due.map { fmt.string(from: $0) }, completed: reminder.isCompleted, listName: reminder.calendar.title)
    }

    private static func canRead(_ s: EKAuthorizationStatus) -> Bool { s == .authorized || s == .fullAccess }
    private static func canWrite(_ s: EKAuthorizationStatus) -> Bool { s == .authorized || s == .fullAccess }
    private static func resolveList(store: EKEventStore, listId: String?, listName: String?) throws -> EKCalendar {
        if let id = listId, !id.isEmpty, let c = store.calendar(withIdentifier: id) { return c }
        if let t = listName, !t.isEmpty, let c = store.calendars(for: .reminder).first(where: { $0.title.caseInsensitiveCompare(t) == .orderedSame }) { return c }
        if let d = store.defaultCalendarForNewReminders() { return d }
        throw NSError(domain: "Reminders", code: 5, userInfo: [NSLocalizedDescriptionKey: "no default reminders list"])
    }
}

struct CoreBlowRemindersPayload { let reminders: [CoreBlowReminderPayload] }
struct CoreBlowReminderPayload { let identifier: String; let title: String; let dueISO: String?; let completed: Bool; let listName: String }
