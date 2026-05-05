import Foundation
public struct GatewayNodeSession: Identifiable, Codable, Sendable {
    public let id: String; public let nodeId: String; public let nodeName: String; public let platform: String
    public let connectedAt: Date; public var capabilities: [String]
}
