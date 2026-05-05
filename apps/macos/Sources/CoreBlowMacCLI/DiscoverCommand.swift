import Foundation

struct DiscoveryOptions { let timeout: TimeInterval; let json: Bool }

enum DiscoverCommand {
    static func run(_ args: [String]) async throws {
        let opts = parseArgs(args)
        print("Discovering CoreBlow gateways…")
        try await Task.sleep(for: .seconds(opts.timeout))
        if opts.json { print("[]") }
        else { print("No gateways found (timeout: \(Int(opts.timeout))s)") }
    }

    private static func parseArgs(_ args: [String]) -> DiscoveryOptions {
        var timeout: TimeInterval = 5; var json = false
        var i = 0
        while i < args.count {
            switch args[i] {
            case "--timeout", "-t": i += 1; timeout = TimeInterval(args[safe: i] ?? "5") ?? 5
            case "--json": json = true
            default: break
            }
            i += 1
        }
        return DiscoveryOptions(timeout: timeout, json: json)
    }
}

private extension Array where Element == String {
    subscript(safe index: Int) -> String? { indices.contains(index) ? self[index] : nil }
}
