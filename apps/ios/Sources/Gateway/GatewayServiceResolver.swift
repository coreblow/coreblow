import Foundation
import Network
import os.log

/// Resolves Bonjour service names to IP:port endpoints.
final class GatewayServiceResolver {

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "GatewayResolver")

    /// Resolve a Bonjour service name to a concrete IP and port.
    func resolve(serviceName: String, serviceType: String = "_coreblow._tcp", domain: String = "local.") async -> GatewayConnectConfig? {
        logger.info("Resolving \(serviceName).\(serviceType).\(domain)")

        return await withCheckedContinuation { continuation in
            let connection = NWConnection(
                to: .service(name: serviceName, type: serviceType, domain: domain, interface: nil),
                using: .tcp
            )

            connection.stateUpdateHandler = { [weak self] state in
                switch state {
                case .ready:
                    if let endpoint = connection.currentPath?.remoteEndpoint,
                       case .hostPort(let host, let port) = endpoint {
                        let config = GatewayConnectConfig(
                            host: "\(host)",
                            port: Int(port.rawValue),
                            displayName: serviceName,
                            source: .bonjour
                        )
                        self?.logger.info("Resolved: \(host):\(port)")
                        connection.cancel()
                        continuation.resume(returning: config)
                    }
                case .failed:
                    self?.logger.error("Resolution failed for \(serviceName)")
                    connection.cancel()
                    continuation.resume(returning: nil)
                default:
                    break
                }
            }

            connection.start(queue: .global())

            // Timeout
            DispatchQueue.global().asyncAfter(deadline: .now() + 10) {
                if connection.state != .cancelled {
                    connection.cancel()
                    continuation.resume(returning: nil)
                }
            }
        }
    }
}
