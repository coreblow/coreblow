import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct CommandResolverTests {
    private let connectionModeKey = "connectionMode"
    private let remoteTargetKey = "remoteTarget"
    private let remoteIdentityKey = "remoteIdentity"
    private let remoteProjectRootKey = "remoteProjectRoot"

    private func makeDefaults() -> UserDefaults {
        UserDefaults(suiteName: "CommandResolverTests.\(UUID().uuidString)")!
    }

    @Test func `resolves local coreblow command`() throws {
        let tmp = try makeTempDirForTests()
        CommandResolver.setProjectRoot(tmp.path)

        let coreblowPath = tmp.appendingPathComponent("node_modules/.bin/coreblow")
        try makeExecutableForTests(at: coreblowPath)

        let defaults = makeDefaults()
        defaults.set(AppState.ConnectionMode.local.rawValue, forKey: connectionModeKey)

        let cmd = CommandResolver.coreblowCommand(
            subcommand: "status",
            defaults: defaults,
            configRoot: [:])

        #expect(cmd.first == coreblowPath.path)
        #expect(cmd.contains("status"))
    }

    @Test func `resolves remote SSH command`() {
        let defaults = makeDefaults()
        defaults.set(AppState.ConnectionMode.remote.rawValue, forKey: connectionModeKey)
        defaults.set("coreblow@example.com:2222", forKey: remoteTargetKey)
        defaults.set("/tmp/id_ed25519", forKey: remoteIdentityKey)
        defaults.set("/srv/coreblow", forKey: remoteProjectRootKey)

        let cmd = CommandResolver.coreblowCommand(
            subcommand: "status",
            extraArgs: ["--json"],
            defaults: defaults,
            configRoot: [:])

        #expect(cmd.first == "/usr/bin/ssh")
        if let marker = cmd.firstIndex(of: "--") {
            #expect(cmd[marker + 1] == "coreblow@example.com")
        } else {
            #expect(Bool(false))
        }
        #expect(cmd.contains("-i"))
        #expect(cmd.contains("/tmp/id_ed25519"))
        if let script = cmd.last {
            #expect(script.contains("PRJ='/srv/coreblow'"))
            #expect(script.contains("cd \"$PRJ\""))
            #expect(script.contains("coreblow"))
            #expect(script.contains("status"))
            #expect(script.contains("--json"))
            #expect(script.contains("CLI="))
        }
    }

    @Test func `rejects unsafe SSH targets`() {
        #expect(CommandResolver.parseSSHTarget("-oProxyCommand=calc") == nil)
        #expect(CommandResolver.parseSSHTarget("host:-oProxyCommand=calc") == nil)
        #expect(CommandResolver.parseSSHTarget("user@host:2222")?.port == 2222)
    }

    @Test func `config root local overrides remote defaults`() throws {
        let defaults = makeDefaults()
        defaults.set(AppState.ConnectionMode.remote.rawValue, forKey: connectionModeKey)
        defaults.set("coreblow@example.com:2222", forKey: remoteTargetKey)

        let tmp = try makeTempDirForTests()
        CommandResolver.setProjectRoot(tmp.path)

        let coreblowPath = tmp.appendingPathComponent("node_modules/.bin/coreblow")
        try makeExecutableForTests(at: coreblowPath)

        let cmd = CommandResolver.coreblowCommand(
            subcommand: "daemon",
            defaults: defaults,
            configRoot: ["gateway": ["mode": "local"]])

        #expect(cmd.first == coreblowPath.path)
        #expect(cmd.count >= 2)
        if cmd.count >= 2 {
            #expect(cmd[1] == "daemon")
        }
    }
}
