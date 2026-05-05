import Foundation

/// Typed errors for gateway connection issues.
enum GatewayConnectionIssue: Error, LocalizedError {
    case notConnected
    case authFailed(String)
    case invokeError(String)
    case invokeTimeout(String)
    case tlsVerificationFailed
    case endpointUnreachable(String)
    case protocolVersionMismatch(server: Int, client: Int)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Not connected to gateway"
        case .authFailed(let reason):
            return "Authentication failed: \(reason)"
        case .invokeError(let message):
            return "Invoke error: \(message)"
        case .invokeTimeout(let command):
            return "Command timed out: \(command)"
        case .tlsVerificationFailed:
            return "TLS certificate verification failed"
        case .endpointUnreachable(let host):
            return "Gateway unreachable: \(host)"
        case .protocolVersionMismatch(let server, let client):
            return "Protocol mismatch: server v\(server), client v\(client)"
        }
    }

    var isRetryable: Bool {
        switch self {
        case .notConnected, .endpointUnreachable, .invokeTimeout:
            return true
        case .authFailed, .invokeError, .tlsVerificationFailed, .protocolVersionMismatch:
            return false
        }
    }
}
