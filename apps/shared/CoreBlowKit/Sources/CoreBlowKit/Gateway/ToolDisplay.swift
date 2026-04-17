// CoreBlowKit/Gateway/ToolDisplay.swift
// Tool display configuration loaded from bundled JSON resource.

import Foundation
import CoreBlowProtocol

/// Display metadata for a tool in the UI.
public struct ToolDisplayEntry: Codable, Sendable {
    public let label: String?
    public let icon: String?
    public let description: String?
    public let category: String?
    public let hidden: Bool?
}

/// Manages tool display configurations from bundled resources.
public enum ToolDisplay {
    private static let entries: [String: ToolDisplayEntry] = {
        guard let url = Bundle.module.url(forResource: "tool-display", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let parsed = try? JSONDecoder().decode([String: ToolDisplayEntry].self, from: data)
        else { return [:] }
        return parsed
    }()

    /// Look up display info for a tool by key.
    public static func entry(for key: String) -> ToolDisplayEntry? {
        entries[key]
    }

    /// Get all tool display entries.
    public static func allEntries() -> [String: ToolDisplayEntry] {
        entries
    }

    /// Get the display label for a tool, with fallback.
    public static func label(for key: String, fallback: String? = nil) -> String {
        entries[key]?.label ?? fallback ?? key
    }

    /// Get the icon name for a tool.
    public static func icon(for key: String) -> String? {
        entries[key]?.icon
    }

    /// Check if a tool should be hidden from the UI.
    public static func isHidden(_ key: String) -> Bool {
        entries[key]?.hidden ?? false
    }

    /// Get tools grouped by category.
    public static func groupedByCategory() -> [String: [String: ToolDisplayEntry]] {
        var result: [String: [String: ToolDisplayEntry]] = [:]
        for (key, entry) in entries {
            let cat = entry.category ?? "other"
            result[cat, default: [:]][key] = entry
        }
        return result
    }
}
