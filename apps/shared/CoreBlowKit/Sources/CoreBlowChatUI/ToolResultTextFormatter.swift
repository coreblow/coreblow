import Foundation
public enum ToolResultTextFormatter {
    public static func format(toolName: String, result: String, maxLength: Int = 500) -> String {
        let truncated = result.count > maxLength ? String(result.prefix(maxLength)) + "…" : result
        return "[\(toolName)] \(truncated)"
    }
}
