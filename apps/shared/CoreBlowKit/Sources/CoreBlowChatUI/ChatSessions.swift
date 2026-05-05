import Foundation; import Observation
@MainActor @Observable public final class ChatSessions {
    public struct Session: Identifiable { public let id: String; public var name: String; public var messages: [ChatMessage] }
    public var sessions: [Session] = []; public var activeSessionId: String?
    public init() {}
    public func create(name: String) -> String { let id = UUID().uuidString; sessions.append(Session(id: id, name: name, messages: [])); return id }
    public func delete(id: String) { sessions.removeAll { $0.id == id } }
}
