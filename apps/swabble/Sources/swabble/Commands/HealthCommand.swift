import Commander; import Foundation
@MainActor struct HealthCommand: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "health", abstract: "Show health status") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws { print("swabble: healthy"); print("uptime: \(ProcessInfo.processInfo.systemUptime)s") }
}
