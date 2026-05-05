import Foundation
enum MenuSessionsInjector { static func buildSessionItems(_ sessions: [SessionData]) -> [(id: String, label: String)] { sessions.map { ($0.id, $0.displayName) } } }
