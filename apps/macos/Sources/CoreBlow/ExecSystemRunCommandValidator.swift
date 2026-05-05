import Foundation
enum ExecSystemRunCommandValidator {
    static func validate(_ command: [String]) -> (valid: Bool, reason: String?) {
        guard !command.isEmpty else { return (false, "empty command") }
        guard !command[0].isEmpty else { return (false, "empty binary") }
        return (true, nil)
    }
}
