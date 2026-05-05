import Foundation
import Network
import os.log

/// Probes a TCP endpoint to check if a gateway is reachable before WebSocket connection.
final class TCPProbe {

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "TCPProbe")

    /// Probe a host:port to check reachability.
    /// Returns `true` if a TCP connection can be established within the timeout.
    func probe(host: String, port: Int, timeout: TimeInterval = 5) async -> Bool {
        logger.info("Probing \(host):\(port)")

        return await withCheckedContinuation { continuation in
            let endpoint = NWEndpoint.hostPort(
                host: NWEndpoint.Host(host),
                port: NWEndpoint.Port(rawValue: UInt16(port))!
            )

            let connection = NWConnection(to: endpoint, using: .tcp)
            var resolved = false

            connection.stateUpdateHandler = { state in
                guard !resolved else { return }
                switch state {
                case .ready:
                    resolved = true
                    connection.cancel()
                    continuation.resume(returning: true)
                case .failed, .cancelled:
                    resolved = true
                    continuation.resume(returning: false)
                default:
                    break
                }
            }

            connection.start(queue: .global())

            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) {
                guard !resolved else { return }
                resolved = true
                connection.cancel()
                continuation.resume(returning: false)
            }
        }
    }
}
