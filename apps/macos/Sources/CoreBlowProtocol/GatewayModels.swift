// Generated protocol models for CoreBlow gateway communication.
import Foundation

public let GATEWAY_PROTOCOL_VERSION = 3

public enum ErrorCode: String, Codable, Sendable {
    case notLinked = "NOT_LINKED"
    case notPaired = "NOT_PAIRED"
    case agentTimeout = "AGENT_TIMEOUT"
    case invalidRequest = "INVALID_REQUEST"
    case approvalNotFound = "APPROVAL_NOT_FOUND"
    case unavailable = "UNAVAILABLE"
}

public struct ConnectParams: Codable, Sendable {
    public let minprotocol: Int
    public let maxprotocol: Int
    public let client: [String: AnyCodable]
    public let caps: [String]?
    public let commands: [String]?
    public let permissions: [String: AnyCodable]?
    public let pathenv: String?
    public let role: String?
    public let scopes: [String]?
    public let device: [String: AnyCodable]?
    public let auth: [String: AnyCodable]?
    public let locale: String?
    public let useragent: String?

    public init(minprotocol: Int, maxprotocol: Int, client: [String: AnyCodable],
                caps: [String]?, commands: [String]?, permissions: [String: AnyCodable]?,
                pathenv: String?, role: String?, scopes: [String]?,
                device: [String: AnyCodable]?, auth: [String: AnyCodable]?,
                locale: String?, useragent: String?) {
        self.minprotocol = minprotocol; self.maxprotocol = maxprotocol
        self.client = client; self.caps = caps; self.commands = commands
        self.permissions = permissions; self.pathenv = pathenv; self.role = role
        self.scopes = scopes; self.device = device; self.auth = auth
        self.locale = locale; self.useragent = useragent
    }
}

public struct GatewayMessage: Codable, Sendable {
    public let type: String
    public let id: String?
    public let method: String?
    public let params: AnyCodable?
    public let result: AnyCodable?
    public let error: GatewayError?
}

public struct GatewayError: Codable, Sendable {
    public let code: String
    public let message: String
}

public struct AnyCodable: Codable, Sendable, Hashable {
    public let value: Any

    public init(_ value: Any) { self.value = value }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { value = NSNull() }
        else if let b = try? container.decode(Bool.self) { value = b }
        else if let i = try? container.decode(Int.self) { value = i }
        else if let d = try? container.decode(Double.self) { value = d }
        else if let s = try? container.decode(String.self) { value = s }
        else if let a = try? container.decode([AnyCodable].self) { value = a }
        else if let o = try? container.decode([String: AnyCodable].self) { value = o }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "unsupported type") }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull: try container.encodeNil()
        case let b as Bool: try container.encode(b)
        case let i as Int: try container.encode(i)
        case let d as Double: try container.encode(d)
        case let s as String: try container.encode(s)
        case let a as [AnyCodable]: try container.encode(a)
        case let o as [String: AnyCodable]: try container.encode(o)
        default: try container.encodeNil()
        }
    }

    public static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        String(describing: lhs.value) == String(describing: rhs.value)
    }

    public func hash(into hasher: inout Hasher) { // codespell:ignore inout
        hasher.combine(String(describing: value))
    }
}
