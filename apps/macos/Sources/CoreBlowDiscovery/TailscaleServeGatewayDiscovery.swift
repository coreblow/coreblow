import Foundation

/// Beacon representing a gateway discovered via Tailscale Serve.
struct TailscaleServeGatewayBeacon: Equatable {
    let hostname: String
    let port: UInt16
    let path: String
    let isHTTPS: Bool

    var baseURL: String {
        let scheme = isHTTPS ? "https" : "http"
        return "\(scheme)://\(hostname):\(port)\(path)"
    }
}

/// Discovers gateways advertised through Tailscale Serve JSON status.
enum TailscaleServeGatewayDiscovery {
    static func parseServeStatus(json: Data) throws -> [TailscaleServeGatewayBeacon] {
        guard let root = try JSONSerialization.jsonObject(with: json) as? [String: Any] else { return [] }
        guard let services = root["Services"] as? [String: Any] else { return [] }
        var beacons: [TailscaleServeGatewayBeacon] = []
        for (key, value) in services {
            guard let config = value as? [String: Any] else { continue }
            guard let handlers = config["Handlers"] as? [String: Any] else { continue }
            for (path, handler) in handlers {
                guard let h = handler as? [String: Any] else { continue }
                guard let proxy = h["Proxy"] as? String, proxy.contains("coreblow") || proxy.contains("gateway") else { continue }
                let parts = key.split(separator: ":")
                let hostname = parts.count > 0 ? String(parts[0]) : "localhost"
                let port = parts.count > 1 ? UInt16(parts[1]) ?? 443 : 443
                beacons.append(TailscaleServeGatewayBeacon(hostname: hostname, port: port, path: path, isHTTPS: true))
            }
        }
        return beacons
    }

    static func fetchBeacons() async -> [TailscaleServeGatewayBeacon] {
        let statusURL = URL(string: "http://127.0.0.1:41112/localapi/v0/serve-status")!
        do {
            let (data, _) = try await URLSession.shared.data(from: statusURL)
            return try parseServeStatus(json: data)
        } catch {
            return []
        }
    }
}
