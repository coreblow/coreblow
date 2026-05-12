// CoreBlowKit/Gateway/GatewayDiscovery.swift
// Bonjour/mDNS gateway discovery for LAN connections.

import Foundation
import CoreBlowProtocol

/// Gateway endpoint discovered on the local network.
public struct GatewayEndpoint: Sendable, Hashable, Identifiable {
    public var id: String { stableId }
    public let stableId: String
    public let host: String
    public let port: Int
    public let displayName: String
    public let isTLS: Bool

    public init(stableId: String, host: String, port: Int,
                displayName: String, isTLS: Bool = false) {
        self.stableId = stableId; self.host = host; self.port = port
        self.displayName = displayName; self.isTLS = isTLS
    }

    /// WebSocket URL for this endpoint.
    public var wsURL: URL? {
        let scheme = isTLS ? "wss" : "ws"
        return URL(string: "\(scheme)://\(host):\(port)/ws")
    }

    /// HTTP URL for health check.
    public var healthURL: URL? {
        let scheme = isTLS ? "https" : "http"
        return URL(string: "\(scheme)://\(host):\(port)/health")
    }
}

/// Status text for discovery UI.
public enum GatewayDiscoveryStatus: Sendable {
    case searching
    case found(Int)
    case notFound
    case error(String)

    public var text: String {
        switch self {
        case .searching: return "Searching for CoreBlow gateways..."
        case .found(let count): return "Found \(count) gateway\(count == 1 ? "" : "s")"
        case .notFound: return "No gateways found on this network"
        case .error(let msg): return "Discovery error: \(msg)"
        }
    }
}

/// Gateway discovery payload decoding helpers.
public enum GatewayPayloadDecoding {
    /// Decode a JSON payload from a gateway response.
    public static func decode<T: Decodable>(_ type: T.Type, from response: GatewayResponse) throws -> T {
        guard let payload = response.payload else {
            throw GatewayDecodingError(method: "decode", message: "missing payload")
        }
        let data = try JSONEncoder().encode(payload)
        return try JSONDecoder().decode(type, from: data)
    }

    /// Decode a JSON payload from raw data.
    public static func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        try JSONDecoder().decode(type, from: data)
    }
}
