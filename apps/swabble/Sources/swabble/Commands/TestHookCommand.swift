import Commander; import Foundation; import Swabble
@MainActor struct TestHookCommand: ParsableCommand {
    @Argument(help: "Text to send to hook") var text: String
    @Option(name: .long("config"), help: "Path to config JSON") var configPath: String?
    static var commandDescription: CommandDescription { CommandDescription(commandName: "test-hook", abstract: "Invoke the configured hook with text") }
    init() {}; init(parsed: ParsedValues) { self.init(); if let p = parsed.positional.first { text = p }; if let c = parsed.options["config"]?.last { configPath = c } }
    mutating func run() async throws { let cfg = try ConfigLoader.load(at: configURL); try await HookExecutor(config: cfg).run(job: HookJob(text: text, timestamp: Date())); print("hook invoked") }
    private var configURL: URL? { configPath.map { URL(fileURLWithPath: $0) } }
}
