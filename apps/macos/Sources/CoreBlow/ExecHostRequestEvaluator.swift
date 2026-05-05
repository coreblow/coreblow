import Foundation
enum ExecHostRequestEvaluator {
    static func requiresElevation(_ command: [String]) -> Bool {
        guard let binary = command.first else { return false }
        return binary == "sudo" || binary == "/usr/bin/sudo"
    }
}
