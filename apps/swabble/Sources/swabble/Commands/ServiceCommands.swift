import Commander; import Foundation

private enum LaunchdHelper {
    static let label = "ai.coreblow.swabble"
    static var plistURL: URL { FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents/\(label).plist") }
    static func writePlist() throws {
        let plist: [String: Any] = ["Label": label, "ProgramArguments": [ProcessInfo.processInfo.arguments[0], "serve"], "KeepAlive": true, "RunAtLoad": true]
        let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try data.write(to: plistURL, options: .atomic)
    }
    static func removePlist() throws { try FileManager.default.removeItem(at: plistURL) }
}

@MainActor struct ServiceInstall: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "service-install", abstract: "Install launch agent") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws { try LaunchdHelper.writePlist(); print("Installed \(LaunchdHelper.plistURL.path)") }
}
@MainActor struct ServiceUninstall: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "service-uninstall", abstract: "Remove launch agent") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws { try LaunchdHelper.removePlist(); print("Removed launch agent") }
}
@MainActor struct ServiceStatus: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "service-status", abstract: "Show launch agent status") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws { print(FileManager.default.fileExists(atPath: LaunchdHelper.plistURL.path) ? "plist present at \(LaunchdHelper.plistURL.path)" : "launchd plist not installed") }
}
