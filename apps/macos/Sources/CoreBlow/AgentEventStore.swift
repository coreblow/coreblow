import Foundation; import Observation
@MainActor @Observable final class AgentEventStore { struct Event: Identifiable { let id = UUID(); let type: String; let timestamp: Date; let payload: String? }; var events: [Event] = []; func add(type: String, payload: String?) { events.append(Event(type: type, timestamp: Date(), payload: payload)) }; func clear() { events.removeAll() } }
