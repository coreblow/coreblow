import Foundation

struct GatewayConfig {
    let host: String; let port: UInt16; let useTLS: Bool; let authToken: String?
    var baseURL: String { "\(useTLS ? "wss" : "ws")://\(host):\(port)" }
}

struct GatewayEndpoint {
    let name: String; let config: GatewayConfig; let source: String
}
