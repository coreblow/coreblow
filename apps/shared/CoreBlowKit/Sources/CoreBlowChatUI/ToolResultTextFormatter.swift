// CoreBlowChatUI/ToolResultTextFormatter.swift
// Formats tool execution results for display in chat messages.

import Foundation
import CoreBlowProtocol

/// Formats tool call results for human-readable display.
public enum ToolResultTextFormatter {

    /// Format a tool result for display in a message bubble.
    public static func format(name: String, result: FlexValue?, isError: Bool = false) -> String {
        let icon = isError ? "⚠️" : "✅"
        let header = "\(icon) \(name)"

        guard let result else { return header }

        switch result {
        case .string(let str):
            let truncated = truncate(str, maxLength: 500)
            return "\(header)\n\(truncated)"
        case .object(let dict):
            return "\(header)\n\(formatObject(dict))"
        case .array(let arr):
            return "\(header)\n[\(arr.count) items]"
        case .bool(let b):
            return "\(header): \(b)"
        case .int(let n):
            return "\(header): \(n)"
        case .double(let n):
            return "\(header): \(n)"
        case .null:
            return "\(header): done"
        }
    }

    /// Format a compact one-line summary of a tool result.
    public static func oneLine(name: String, result: FlexValue?) -> String {
        guard let result else { return "⚡ \(name)" }
        switch result {
        case .string(let str):
            return "⚡ \(name): \(truncate(str, maxLength: 80))"
        case .object(let dict):
            let keys = dict.keys.prefix(3).joined(separator: ", ")
            return "⚡ \(name): {\(keys)}"
        case .array(let arr):
            return "⚡ \(name): [\(arr.count) items]"
        default:
            return "⚡ \(name): \(result.stringValue ?? "done")"
        }
    }

    // MARK: - Private

    private static func formatObject(_ dict: [String: FlexValue]) -> String {
        dict.prefix(10).map { key, value in
            let valStr: String
            switch value {
            case .string(let s): valStr = truncate(s, maxLength: 100)
            case .array(let a): valStr = "[\(a.count) items]"
            case .object(let d): valStr = "{\(d.count) keys}"
            default: valStr = value.stringValue ?? "null"
            }
            return "  \(key): \(valStr)"
        }.joined(separator: "\n")
    }

    private static func truncate(_ str: String, maxLength: Int) -> String {
        str.count > maxLength ? String(str.prefix(maxLength)) + "…" : str
    }
}
