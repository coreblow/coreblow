import Foundation
enum GatewayDiscoveryHelpers {
    static func isLocalAddress(_ host: String) -> Bool {
        host == "localhost" || host == "127.0.0.1" || host == "::1" || host.hasSuffix(".local")
    }
    static func bestEndpointName(host: String, serverName: String?) -> String {
        serverName ?? (isLocalAddress(host) ? "Local Gateway" : host)
    }
}
