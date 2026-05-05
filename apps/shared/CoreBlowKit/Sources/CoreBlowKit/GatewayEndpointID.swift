import Foundation
public struct GatewayEndpointID: Hashable, Codable, Sendable, CustomStringConvertible {
    public let host: String; public let port: UInt16
    public init(host: String, port: UInt16) { self.host = host; self.port = port }
    public var description: String { "\(host):\(port)" }
}
