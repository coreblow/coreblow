import Foundation
import Observation
import OSLog
@MainActor @Observable
final class GatewayConnectivityCoordinator {
    private(set) var isConnected = false
    private(set) var isReconnecting = false
    private var connection: GatewayConnection?
    private var reconnectTask: Task<Void, Never>?
    private let logger = CoreBlowLogging.gateway
    func connect(host: String, port: UInt16, tls: Bool, token: String?) async {
        let scheme = tls ? "wss" : "ws"
        guard let url = URL(string: "\(scheme)://\(host):\(port)") else { return }
        let conn = GatewayConnection()
        connection = conn
        do { try await conn.connect(to: url, token: token); isConnected = true; isReconnecting = false }
        catch { logger.error("Connect failed: \(error.localizedDescription)"); scheduleReconnect(host: host, port: port, tls: tls, token: token) }
    }
    func disconnect() async { await connection?.disconnect(); connection = nil; isConnected = false; reconnectTask?.cancel() }
    private func scheduleReconnect(host: String, port: UInt16, tls: Bool, token: String?) {
        isReconnecting = true
        reconnectTask = Task { [weak self] in
            for attempt in 1...Constants.maxReconnectAttempts {
                try? await Task.sleep(for: .seconds(Constants.reconnectDelay * Double(attempt)))
                guard !Task.isCancelled else { return }
                await self?.connect(host: host, port: port, tls: tls, token: token)
                if self?.isConnected == true { return }
            }
            self?.isReconnecting = false
        }
    }
}
