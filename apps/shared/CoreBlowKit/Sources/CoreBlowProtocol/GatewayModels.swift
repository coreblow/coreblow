import Foundation

public let GATEWAY_PROTOCOL_VERSION = 3

public enum ErrorCode: String, Codable, Sendable {
    case notLinked = "NOT_LINKED"; case notPaired = "NOT_PAIRED"; case agentTimeout = "AGENT_TIMEOUT"
    case invalidRequest = "INVALID_REQUEST"; case approvalNotFound = "APPROVAL_NOT_FOUND"; case unavailable = "UNAVAILABLE"
}

public struct ConnectParams: Codable, Sendable {
    public let minprotocol: Int; public let maxprotocol: Int; public let client: [String: AnyCodable]
    public let caps: [String]?; public let commands: [String]?; public let permissions: [String: AnyCodable]?
    public let pathenv: String?; public let role: String?; public let scopes: [String]?
    public let device: [String: AnyCodable]?; public let auth: [String: AnyCodable]?
    public let locale: String?; public let useragent: String?
    public init(minprotocol: Int, maxprotocol: Int, client: [String: AnyCodable], caps: [String]?, commands: [String]?, permissions: [String: AnyCodable]?, pathenv: String?, role: String?, scopes: [String]?, device: [String: AnyCodable]?, auth: [String: AnyCodable]?, locale: String?, useragent: String?) {
        self.minprotocol = minprotocol; self.maxprotocol = maxprotocol; self.client = client; self.caps = caps; self.commands = commands; self.permissions = permissions; self.pathenv = pathenv; self.role = role; self.scopes = scopes; self.device = device; self.auth = auth; self.locale = locale; self.useragent = useragent
    }
}

public struct GatewayMessage: Codable, Sendable { public let type: String; public let id: String?; public let method: String?; public let params: AnyCodable?; public let result: AnyCodable?; public let error: GatewayError? }
public struct GatewayError: Codable, Sendable { public let code: String; public let message: String }
public struct GatewayFrame: Codable, Sendable { public let messages: [GatewayMessage] }
