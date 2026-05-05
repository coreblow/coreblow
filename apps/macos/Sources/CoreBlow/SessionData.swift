import Foundation
struct SessionData: Identifiable, Codable, Sendable {
    let id: String; let agentName: String?; let modelName: String?; let startedAt: Date; var messageCount: Int
    var isActive: Bool { true }
    var displayName: String { agentName ?? id.prefix(8).description }
}
