import Foundation

public struct HookJob: Sendable {
    public let text: String
    public let timestamp: Date
    public init(text: String, timestamp: Date) { self.text = text; self.timestamp = timestamp }
}

public actor HookExecutor {
    private let config: SwabbleConfig
    private var lastRun: Date?

    public init(config: SwabbleConfig) { self.config = config }

    public func run(job: HookJob) async throws {
        guard !config.hook.command.isEmpty else { return }
        if let last = lastRun, Date().timeIntervalSince(last) < config.hook.cooldownSeconds { return }
        guard job.text.count >= config.hook.minCharacters else { return }

        let prefixed = config.hook.prefix
            .replacingOccurrences(of: "${hostname}", with: Host.current().localizedName ?? "unknown")
            + job.text

        let process = Process()
        process.executableURL = URL(fileURLWithPath: config.hook.command)
        process.arguments = config.hook.args + [prefixed]
        var env = ProcessInfo.processInfo.environment
        config.hook.env.forEach { env[$0.key] = $0.value }
        process.environment = env

        try process.run()
        process.waitUntilExit()
        lastRun = Date()
    }
}
