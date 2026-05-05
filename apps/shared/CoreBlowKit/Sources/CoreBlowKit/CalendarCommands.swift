import EventKit; import Foundation
public enum CalendarCommands {
    public static func listEvents(from: Date, to: Date) async throws -> [[String: Any]] {
        let store = EKEventStore(); try await store.requestFullAccessToEvents()
        let pred = store.predicateForEvents(withStart: from, end: to, calendars: nil)
        return store.events(matching: pred).map { ["title": $0.title ?? "", "start": $0.startDate?.description ?? "", "end": $0.endDate?.description ?? ""] }
    }
}
