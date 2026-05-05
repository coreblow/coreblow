import Foundation
public struct GatewayPushPayload: Codable, Sendable { public let type: String; public let title: String?; public let body: String?; public let sessionId: String? }
