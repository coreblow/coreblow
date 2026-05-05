import Darwin
import Foundation

struct WizardCliOptions {
    let skipDiscovery: Bool; let host: String?; let port: UInt16?
}

enum WizardCommand {
    static func run(_ args: [String]) async throws {
        let opts = parseArgs(args)
        print("CoreBlow Setup Wizard")
        print("=====================")
        if opts.skipDiscovery {
            guard let host = opts.host else { throw CLIError("--host required with --skip-discovery") }
            let port = opts.port ?? 3000
            print("Connecting to \(host):\(port)…")
            try await ConnectCommand.run(["--host", host, "--port", String(port)])
        } else {
            print("\n1. Searching for gateways on your network…")
            try await DiscoverCommand.run(["--timeout", "3"])
            print("\n2. Enter gateway address manually:")
            print("   Host: ", terminator: ""); let host = readLine() ?? "localhost"
            print("   Port [3000]: ", terminator: ""); let portStr = readLine() ?? "3000"
            let port = UInt16(portStr) ?? 3000
            print("\n3. Connecting to \(host):\(port)…")
            try await ConnectCommand.run(["--host", host, "--port", String(port)])
        }
        print("\n✅ Setup complete!")
    }

    private static func parseArgs(_ args: [String]) -> WizardCliOptions {
        var skip = false; var host: String?; var port: UInt16?
        var i = 0
        while i < args.count {
            switch args[i] {
            case "--skip-discovery": skip = true
            case "--host": i += 1; if i < args.count { host = args[i] }
            case "--port": i += 1; if i < args.count { port = UInt16(args[i]) }
            default: break
            }
            i += 1
        }
        return WizardCliOptions(skipDiscovery: skip, host: host, port: port)
    }
}
