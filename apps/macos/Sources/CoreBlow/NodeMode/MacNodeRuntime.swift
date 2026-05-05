import Foundation; import OSLog
@MainActor final class MacNodeRuntime {
    private let logger = CoreBlowLogging.node; private(set) var isRunning = false
    func start() { isRunning = true; logger.info("Node runtime started") }
    func stop() { isRunning = false; logger.info("Node runtime stopped") }
    func handleInvoke(command: String, paramsJSON: String?) async throws -> String {
        logger.debug("Invoke: \(command)"); return "{\"ok\":true}"
    }
}
