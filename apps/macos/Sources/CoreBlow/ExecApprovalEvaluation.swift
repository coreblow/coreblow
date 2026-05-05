import Foundation
enum ExecApprovalEvaluation {
    enum Decision { case allow, deny(reason: String), prompt }
    static func evaluate(command: [String], cwd: String?, allowlist: ExecAllowlistMatcher) -> Decision {
        guard !command.isEmpty else { return .deny(reason: "empty command") }
        if allowlist.isAllowed(command) { return .allow }
        let binary = command[0]
        if binary.contains("rm") && command.contains("-rf") { return .deny(reason: "destructive rm -rf") }
        if binary.contains("sudo") { return .prompt }
        return .prompt
    }
}
