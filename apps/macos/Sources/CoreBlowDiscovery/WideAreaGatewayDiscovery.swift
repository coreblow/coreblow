import Foundation

/// Beacon for gateways discovered via wide-area DNS-SD or manual config.
struct WideAreaGatewayBeacon: Equatable {
    let identifier: String
    let host: String
    let port: UInt16
    let useTLS: Bool
    let source: DiscoverySource

    enum DiscoverySource: String, Equatable {
        case manual
        case dnsSD = "dns-sd"
        case tailscale
        case cached
    }

    var baseURL: String {
        let scheme = useTLS ? "wss" : "ws"
        return "\(scheme)://\(host):\(port)"
    }
}

/// Discovers gateways beyond the local network using DNS-SD browsing,
/// cached endpoints, and Tailscale integration.
enum WideAreaGatewayDiscovery {
    static func cachedEndpoints() -> [WideAreaGatewayBeacon] {
        guard let data = UserDefaults.standard.data(forKey: "coreblow.cachedEndpoints"),
              let entries = try? JSONDecoder().decode([CachedEntry].self, from: data) else { return [] }
        return entries.map { entry in
            WideAreaGatewayBeacon(identifier: entry.id, host: entry.host, port: entry.port,
                                 useTLS: entry.tls, source: .cached)
        }
    }

    static func saveCachedEndpoints(_ beacons: [WideAreaGatewayBeacon]) {
        let entries = beacons.map { CachedEntry(id: $0.identifier, host: $0.host, port: $0.port, tls: $0.useTLS) }
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: "coreblow.cachedEndpoints")
        }
    }

    static func manualBeacon(host: String, port: UInt16, tls: Bool) -> WideAreaGatewayBeacon {
        WideAreaGatewayBeacon(identifier: "manual-\(host):\(port)", host: host, port: port, useTLS: tls, source: .manual)
    }

    static func mergeBeacons(_ sources: [WideAreaGatewayBeacon]...) -> [WideAreaGatewayBeacon] {
        var seen = Set<String>()
        var merged: [WideAreaGatewayBeacon] = []
        for source in sources {
            for beacon in source where seen.insert(beacon.identifier).inserted {
                merged.append(beacon)
            }
        }
        return merged
    }

    private struct CachedEntry: Codable {
        let id: String; let host: String; let port: UInt16; let tls: Bool
    }
}
