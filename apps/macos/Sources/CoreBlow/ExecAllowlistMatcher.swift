import Foundation
struct ExecAllowlistMatcher {
    private let patterns: [String]
    init(patterns: [String] = []) { self.patterns = patterns }
    func isAllowed(_ command: [String]) -> Bool {
        guard let binary = command.first else { return false }
        let name = (binary as NSString).lastPathComponent
        return patterns.contains(where: { name == $0 || binary == $0 })
    }
    static let defaultPatterns = ["ls", "cat", "echo", "pwd", "whoami", "date", "uname", "which", "file", "head", "tail", "wc", "sort", "uniq", "grep", "find", "stat"]
}
