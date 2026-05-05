import Foundation
enum ExecApprovalCommandDisplaySanitizer {
    static func sanitize(_ command: [String]) -> String {
        command.map { $0.contains(" ") ? "\"\($0)\"" : $0 }.joined(separator: " ")
    }
    static func truncate(_ text: String, maxLength: Int = 200) -> String {
        text.count <= maxLength ? text : String(text.prefix(maxLength)) + "…"
    }
}
