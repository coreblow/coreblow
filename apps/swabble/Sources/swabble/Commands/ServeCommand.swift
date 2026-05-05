import Commander; import Foundation; import Swabble
@MainActor struct ServeCommand: ParsableCommand {
    @Option(name: .long("config"), help: "Path to config JSON") var configPath: String?
    static var commandDescription: CommandDescription { CommandDescription(commandName: "serve", abstract: "Run daemon in foreground") }
    init() {}
    init(parsed: ParsedValues) { self.init(); if let c = parsed.options["config"]?.last { configPath = c } }
    mutating func run() async throws {
        let cfg = try ConfigLoader.load(at: configURL)
        let logger = Logger(level: LogLevel(configValue: cfg.logging.level) ?? .info)
        logger.info("swabble serve starting (wake=\(cfg.wake.word))")
        logger.info("press Ctrl+C to stop")
        try await Task.sleep(for: .seconds(.max))
    }
    private var configURL: URL? { configPath.map { URL(fileURLWithPath: $0) } }
}
