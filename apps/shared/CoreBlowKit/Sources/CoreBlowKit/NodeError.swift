import Foundation
public enum NodeError: Error, LocalizedError {
    case notConnected; case commandNotFound(String); case timeout; case invalidResponse
    public var errorDescription: String? { switch self { case .notConnected: "Node not connected"; case .commandNotFound(let c): "Command not found: \(c)"; case .timeout: "Request timed out"; case .invalidResponse: "Invalid response" } }
}
