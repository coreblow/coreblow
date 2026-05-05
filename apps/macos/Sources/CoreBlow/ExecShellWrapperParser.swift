import Foundation
enum ExecShellWrapperParser {
    static func isShellWrapped(_ command: [String]) -> Bool {
        guard let shell = command.first else { return false }
        return shell.hasSuffix("sh") && command.contains("-c")
    }
    static func extractInnerCommand(_ command: [String]) -> String? {
        guard isShellWrapped(command), let idx = command.firstIndex(of: "-c"), idx + 1 < command.count else { return nil }
        return command[idx + 1]
    }
}
