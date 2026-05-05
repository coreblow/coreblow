import Foundation
public struct ChatMessage: Identifiable, Sendable { public let id: UUID; public let role: ChatRole; public let content: String; public let timestamp: Date; public var toolResults: [ToolResultItem]?
    public init(id: UUID = UUID(), role: ChatRole, content: String, timestamp: Date = Date(), toolResults: [ToolResultItem]? = nil) { self.id = id; self.role = role; self.content = content; self.timestamp = timestamp; self.toolResults = toolResults } }
public enum ChatRole: String, Codable, Sendable { case user, assistant, system, tool }
public struct ToolResultItem: Identifiable, Sendable { public let id: UUID; public let toolName: String; public let result: String; public init(id: UUID = UUID(), toolName: String, result: String) { self.id = id; self.toolName = toolName; self.result = result } }
