import EventKit
import Foundation

/// Provides calendar event listing and creation for gateway invoke commands.
final class CalendarService {

    func events(startISO: String?, endISO: String?, limit: Int?) async throws -> CoreBlowCalendarEventsPayload {
        let store = EKEventStore()
        let status = EKEventStore.authorizationStatus(for: .event)
        guard Self.allowsRead(status) else {
            throw NSError(domain: "Calendar", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "CALENDAR_PERMISSION_REQUIRED: grant Calendar permission",
            ])
        }

        let (start, end) = Self.resolveRange(startISO: startISO, endISO: endISO)
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: predicate)
        let cap = max(1, min(limit ?? 50, 500))
        let selected = Array(events.prefix(cap))

        let formatter = ISO8601DateFormatter()
        let payload = selected.map { event in
            CoreBlowCalendarEventPayload(
                identifier: event.eventIdentifier ?? UUID().uuidString,
                title: event.title ?? "(untitled)",
                startISO: formatter.string(from: event.startDate),
                endISO: formatter.string(from: event.endDate),
                isAllDay: event.isAllDay,
                location: event.location,
                calendarTitle: event.calendar.title)
        }

        return CoreBlowCalendarEventsPayload(events: payload)
    }

    func add(title: String, startISO: String, endISO: String, isAllDay: Bool?,
             location: String?, notes: String?, calendarId: String?,
             calendarTitle: String?) async throws -> CoreBlowCalendarEventPayload {
        let store = EKEventStore()
        let status = EKEventStore.authorizationStatus(for: .event)
        guard Self.allowsWrite(status) else {
            throw NSError(domain: "Calendar", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "CALENDAR_PERMISSION_REQUIRED: grant Calendar permission",
            ])
        }

        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            throw NSError(domain: "Calendar", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "CALENDAR_INVALID: title required",
            ])
        }

        let formatter = ISO8601DateFormatter()
        guard let start = formatter.date(from: startISO) else {
            throw NSError(domain: "Calendar", code: 4, userInfo: [
                NSLocalizedDescriptionKey: "CALENDAR_INVALID: startISO required",
            ])
        }
        guard let end = formatter.date(from: endISO) else {
            throw NSError(domain: "Calendar", code: 5, userInfo: [
                NSLocalizedDescriptionKey: "CALENDAR_INVALID: endISO required",
            ])
        }

        let event = EKEvent(eventStore: store)
        event.title = trimmedTitle
        event.startDate = start
        event.endDate = end
        event.isAllDay = isAllDay ?? false
        if let loc = location?.trimmingCharacters(in: .whitespacesAndNewlines), !loc.isEmpty {
            event.location = loc
        }
        if let n = notes?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty {
            event.notes = n
        }
        event.calendar = try Self.resolveCalendar(store: store, calendarId: calendarId, calendarTitle: calendarTitle)
        try store.save(event, span: .thisEvent)

        return CoreBlowCalendarEventPayload(
            identifier: event.eventIdentifier ?? UUID().uuidString,
            title: event.title ?? trimmedTitle,
            startISO: formatter.string(from: event.startDate),
            endISO: formatter.string(from: event.endDate),
            isAllDay: event.isAllDay,
            location: event.location,
            calendarTitle: event.calendar.title)
    }

    private static func allowsRead(_ status: EKAuthorizationStatus) -> Bool {
        status == .authorized || status == .fullAccess || status == .writeOnly
    }

    private static func allowsWrite(_ status: EKAuthorizationStatus) -> Bool {
        status == .authorized || status == .fullAccess
    }

    private static func resolveRange(startISO: String?, endISO: String?) -> (Date, Date) {
        let formatter = ISO8601DateFormatter()
        let start = startISO.flatMap { formatter.date(from: $0) } ?? Date()
        let end = endISO.flatMap { formatter.date(from: $0) } ?? start.addingTimeInterval(7 * 24 * 3600)
        return (start, end)
    }

    private static func resolveCalendar(store: EKEventStore, calendarId: String?, calendarTitle: String?) throws -> EKCalendar {
        if let id = calendarId?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty,
           let cal = store.calendar(withIdentifier: id) {
            return cal
        }
        if let title = calendarTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
            if let cal = store.calendars(for: .event).first(where: {
                $0.title.compare(title, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame
            }) { return cal }
            throw NSError(domain: "Calendar", code: 6, userInfo: [
                NSLocalizedDescriptionKey: "CALENDAR_NOT_FOUND: no calendar named \(title)",
            ])
        }
        if let fallback = store.defaultCalendarForNewEvents { return fallback }
        throw NSError(domain: "Calendar", code: 7, userInfo: [
            NSLocalizedDescriptionKey: "CALENDAR_NOT_FOUND: no default calendar",
        ])
    }
}

// MARK: - Payload Types

struct CoreBlowCalendarEventsPayload { let events: [CoreBlowCalendarEventPayload] }
struct CoreBlowCalendarEventPayload {
    let identifier: String; let title: String; let startISO: String; let endISO: String
    let isAllDay: Bool; let location: String?; let calendarTitle: String
}
