import Foundation
import Network

/// Monitors network path changes and provides current connectivity info.
///
/// Pattern: @unchecked Sendable + NSLock for thread-safe state
/// (mirrors OC's NetworkStatusService pattern).
final class NetworkReachabilityService: @unchecked Sendable {

    struct NetworkSnapshot {
        let isReachable: Bool
        let isWiFi: Bool
        let isCellular: Bool
        let isExpensive: Bool
        let isConstrained: Bool
    }

    func currentSnapshot(timeoutMs: Int = 1500) async -> NetworkSnapshot {
        await withCheckedContinuation { continuation in
            let monitor = NWPathMonitor()
            let queue = DispatchQueue(label: "ai.coreblow.ios.net-check")
            let guard_ = CompletionGuard()

            monitor.pathUpdateHandler = { path in
                guard guard_.tryComplete() else { return }
                monitor.cancel()
                continuation.resume(returning: Self.snapshot(from: path))
            }

            monitor.start(queue: queue)

            queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
                guard guard_.tryComplete() else { return }
                monitor.cancel()
                continuation.resume(returning: Self.offlineSnapshot())
            }
        }
    }

    private static func snapshot(from path: NWPath) -> NetworkSnapshot {
        NetworkSnapshot(
            isReachable: path.status == .satisfied,
            isWiFi: path.usesInterfaceType(.wifi),
            isCellular: path.usesInterfaceType(.cellular),
            isExpensive: path.isExpensive,
            isConstrained: path.isConstrained
        )
    }

    private static func offlineSnapshot() -> NetworkSnapshot {
        NetworkSnapshot(
            isReachable: false,
            isWiFi: false,
            isCellular: false,
            isExpensive: false,
            isConstrained: false
        )
    }
}

/// Thread-safe one-shot completion guard.
private final class CompletionGuard: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false

    func tryComplete() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return false }
        done = true
        return true
    }
}
