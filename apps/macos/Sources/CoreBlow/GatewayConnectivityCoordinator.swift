import Foundation
import CoreBlowKit
import Observation
import CoreBlowKit
import OSLog

/// Coordinates gateway connectivity lifecycle from the UI layer.
///
/// Drives the shared `GatewayConnection.shared` actor and exposes
/// observable connection state for SwiftUI views.
@MainActor @Observable
final class GatewayConnectivityCoordinator {
    static let shared = GatewayConnectivityCoordinator()

    private(set) var isConnected = false
    private(set) var isReconnecting = false
    private(set) var lastError: String?

    private var reconnectTask: Task<Void, Never>?
    private var monitorTask: Task<Void, Never>?
    private let logger = CoreBlowLogging.gateway

    func connect() async {
        lastError = nil
        do {
            try await GatewayConnection.shared.refresh()
            isConnected = true
            isReconnecting = false
            startMonitoring()
        } catch {
            logger.error("Connect failed: \(error.localizedDescription)")
            lastError = error.localizedDescription
            isConnected = false
            scheduleReconnect()
        }
    }

    func disconnect() async {
        reconnectTask?.cancel()
        reconnectTask = nil
        monitorTask?.cancel()
        monitorTask = nil
        await GatewayConnection.shared.shutdown()
        isConnected = false
        isReconnecting = false
    }

    // MARK: - Monitoring

    private func startMonitoring() {
        monitorTask?.cancel()
        monitorTask = Task { [weak self] in
            let stream = await GatewayConnection.shared.subscribe(bufferingNewest: 1)
            for await _ in stream {
                guard !Task.isCancelled else { return }
                // Connection still alive — keep state in sync
                await MainActor.run { self?.isConnected = true }
            }
            // Stream ended — connection lost
            await MainActor.run {
                self?.isConnected = false
                self?.scheduleReconnect()
            }
        }
    }

    // MARK: - Reconnection

    private func scheduleReconnect() {
        guard !isReconnecting else { return }
        isReconnecting = true
        reconnectTask = Task { [weak self] in
            for attempt in 1...Constants.maxReconnectAttempts {
                let delay = Constants.reconnectDelay * Double(attempt)
                try? await Task.sleep(for: .seconds(delay))
                guard !Task.isCancelled else { return }
                await self?.connect()
                if self?.isConnected == true { return }
            }
            await MainActor.run { self?.isReconnecting = false }
        }
    }
}
