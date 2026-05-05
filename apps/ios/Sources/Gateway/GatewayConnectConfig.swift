import Foundation

/// Configuration for establishing a gateway WebSocket connection.
struct GatewayConnectConfig: Codable, Identifiable {
    let id: String
    let host: String
    let port: Int
    let useTLS: Bool
    let path: String
    let displayName: String?
    let source: DiscoverySource

    enum DiscoverySource: String, Codable {
        case manual, bonjour, qrCode, deepLink, saved
    }

    /// Stable identifier for keychain and settings storage.
    var stableID: String {
        "\(source.rawValue)|\(host):\(port)"
    }

    /// Full WebSocket URL.
    var wsURL: URL? {
        let scheme = useTLS ? "wss" : "ws"
        return URL(string: "\(scheme)://\(host):\(port)\(path)")
    }

    /// Human-readable label.
    var label: String {
        displayName ?? "\(host):\(port)"
    }

    init(
        host: String,
        port: Int,
        useTLS: Bool = false,
        path: String = "/ws",
        displayName: String? = nil,
        source: DiscoverySource = .manual
    ) {
        self.id = "\(source.rawValue)|\(host):\(port)"
        self.host = host
        self.port = port
        self.useTLS = useTLS
        self.path = path
        self.displayName = displayName
        self.source = source
    }
}
