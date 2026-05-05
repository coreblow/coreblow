import Foundation

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
