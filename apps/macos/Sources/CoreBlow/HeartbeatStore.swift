import Foundation; import OSLog
actor HeartbeatStore {
    private var task: Task<Void, Never>?; private let logger = CoreBlowLogging.gateway
    private(set) var lastHeartbeat: Date?; private(set) var missedCount = 0
    func start(interval: TimeInterval = Constants.heartbeatInterval, send: @escaping @Sendable () async -> Bool) {
        task = Task { while !Task.isCancelled { let ok = await send(); if ok { lastHeartbeat = Date(); missedCount = 0 } else { missedCount += 1 }; try? await Task.sleep(for: .seconds(interval)) } }
    }
    func stop() { task?.cancel(); task = nil }
}
