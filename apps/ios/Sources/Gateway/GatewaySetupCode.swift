import Foundation
import os.log

/// Validates and parses gateway setup codes for QR-based pairing.
///
/// Format: `coreblow://host:port?name=DisplayName&tls=true`
struct GatewaySetupCode {

    let config: GatewayConnectConfig

    /// Parse a raw QR/deep-link string into a setup code.
    static func parse(_ raw: String) -> GatewaySetupCode? {
        guard let url = URL(string: raw),
              url.scheme == "coreblow",
              let host = url.host else { return nil }

        let port = url.port ?? 8080
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []

        let displayName = queryItems.first(where: { $0.name == "name" })?.value
        let useTLS = queryItems.first(where: { $0.name == "tls" })?.value == "true"
        let path = url.path.isEmpty ? "/ws" : url.path

        let config = GatewayConnectConfig(
            host: host,
            port: port,
            useTLS: useTLS,
            path: path,
            displayName: displayName,
            source: .qrCode
        )

        return GatewaySetupCode(config: config)
    }

    /// Generate a setup code string for sharing.
    static func generate(from config: GatewayConnectConfig) -> String {
        var components = URLComponents()
        components.scheme = "coreblow"
        components.host = config.host
        components.port = config.port
        components.path = config.path

        var queryItems: [URLQueryItem] = []
        if let name = config.displayName {
            queryItems.append(URLQueryItem(name: "name", value: name))
        }
        if config.useTLS {
            queryItems.append(URLQueryItem(name: "tls", value: "true"))
        }
        if !queryItems.isEmpty { components.queryItems = queryItems }

        return components.string ?? "coreblow://\(config.host):\(config.port)"
    }
}
