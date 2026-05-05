import Foundation
enum ExecEnvInvocationUnwrapper {
    static func unwrap(_ command: [String]) -> [String] {
        guard command.first == "/usr/bin/env" || command.first == "env", command.count > 1 else { return command }
        var unwrapped = Array(command.dropFirst())
        while let first = unwrapped.first, first.hasPrefix("-") { unwrapped.removeFirst() }
        return unwrapped
    }
}
