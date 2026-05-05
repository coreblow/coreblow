import Foundation
import OSLog
actor GatewayProcessManager {
    private var process: Process?; private let logger = CoreBlowLogging.gateway
    func start(binaryPath: URL, port: UInt16, env: [String: String]?) async throws {
        guard process == nil else { return }
        let p = Process(); p.executableURL = binaryPath
        p.arguments = ["--port", String(port)]
        var environ = ProcessInfo.processInfo.environment
        env?.forEach { environ[$0.key] = $0.value }
        p.environment = environ
        try p.run(); process = p; logger.info("Gateway started PID \(p.processIdentifier)")
    }
    func stop() { process?.terminate(); process = nil; logger.info("Gateway stopped") }
    var isRunning: Bool { process?.isRunning ?? false }
}
