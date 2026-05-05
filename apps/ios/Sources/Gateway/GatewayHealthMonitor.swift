import Foundation
import Combine
import os.log

/// Monitors gateway connection health via periodic pings.
final class GatewayHealthMonitor: ObservableObject {

    @Published private(set) var latencyMs: Double?
    @Published private(set) var isHealthy = false
    @Published private(set) var missedPings = 0

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "GatewayHealth")
    private var timer: Timer?
    private let interval: TimeInterval
    private let maxMissedPings: Int
    private weak var controller: GatewayConnectionController?

    init(controller: GatewayConnectionController, interval: TimeInterval = 15, maxMissedPings: Int = 3) {
        self.controller = controller
        self.interval = interval
        self.maxMissedPings = maxMissedPings
    }

    func start() {
        timer?.invalidate()
        missedPings = 0
        isHealthy = true
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.ping()
        }
        logger.info("Health monitor started (interval=\(self.interval)s)")
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        isHealthy = false
        latencyMs = nil
    }

    private func ping() {
        let start = Date()

        Task {
            do {
                _ = try await controller?.sendInvoke(command: "debug.ping", params: [:])
                let elapsed = Date().timeIntervalSince(start) * 1000
                await MainActor.run {
                    self.latencyMs = elapsed
                    self.missedPings = 0
                    self.isHealthy = true
                }
            } catch {
                await MainActor.run {
                    self.missedPings += 1
                    if self.missedPings >= self.maxMissedPings {
                        self.isHealthy = false
                        self.logger.warning("Gateway unhealthy: \(self.missedPings) missed pings")
                    }
                }
            }
        }
    }
}
