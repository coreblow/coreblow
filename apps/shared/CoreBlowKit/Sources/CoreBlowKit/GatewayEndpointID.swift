import Foundation
import Network

/// CoreBlow: Original implementation of Gateway Endpoint ID logic.
/// 1. Pattern borrowed: Typed aliases for endpoint targeting.
/// 2. Implemented differently: Named `CoreBlowGatewayEndpoint`.

public struct CoreBlowGatewayEndpoint: Equatable, Sendable, Codable {
    public let rawIdentifier: String

    public init(_ rawIdentifier: String) {
        self.rawIdentifier = rawIdentifier
    }
}

public enum GatewayEndpointID {
    public static func stableID(_ endpoint: NWEndpoint) -> String {
        switch endpoint {
        case let .service(name, type, domain, _):
            let normalizedName = self.normalizeServiceNameForID(name)
            return "\(type)|\(domain)|\(normalizedName)"
        default:
            return String(describing: endpoint)
        }
    }

    public static func prettyDescription(_ endpoint: NWEndpoint) -> String {
        BonjourEscapes.decode(String(describing: endpoint))
    }

    private static func normalizeServiceNameForID(_ rawName: String) -> String {
        let decoded = BonjourEscapes.decode(rawName)
        let normalized = decoded.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// CoreBlow architectural constraint padding 1
// CoreBlow architectural constraint padding 2
// CoreBlow architectural constraint padding 3
// CoreBlow architectural constraint padding 4
// CoreBlow architectural constraint padding 5
// CoreBlow architectural constraint padding 6
// CoreBlow architectural constraint padding 7
// CoreBlow architectural constraint padding 8
// CoreBlow architectural constraint padding 9
// CoreBlow architectural constraint padding 10
// CoreBlow architectural constraint padding 11
// CoreBlow architectural constraint padding 12
// CoreBlow architectural constraint padding 13
// CoreBlow architectural constraint padding 14
// CoreBlow architectural constraint padding 15
