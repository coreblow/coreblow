// CoreBlowKit/Gateway/ToolDisplay.swift
// Tool display configuration and rich summary resolution.

import Foundation
import CoreBlowProtocol

// MARK: - Tool Display Summary

/// Rich display metadata for a resolved tool invocation.
public struct ToolDisplaySummary: Sendable, Equatable {
    public let name: String
    public let emoji: String
    public let title: String
    public let label: String
    public let verb: String?
    public let detail: String?

    public var detailLine: String? {
        var parts: [String] = []
        if let verb, !verb.isEmpty { parts.append(verb) }
        if let detail, !detail.isEmpty { parts.append(detail) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public var summaryLine: String {
        if let detailLine {
            return "\(emoji) \(label): \(detailLine)"
        }
        return "\(emoji) \(label)"
    }
}

// MARK: - Display Entry (JSON-backed)

/// Display metadata for a tool loaded from bundled JSON.
public struct ToolDisplayEntry: Codable, Sendable {
    public let label: String?
    public let icon: String?
    public let description: String?
    public let category: String?
    public let hidden: Bool?
    public let emoji: String?
    public let title: String?
    public let detailKeys: [String]?
}

// MARK: - Tool Display Registry

/// Resolves tool display summaries from tool name and arguments.
public enum ToolDisplayRegistry {
    private struct ToolDisplayActionSpec: Decodable {
        let label: String?
        let detailKeys: [String]?
    }

    private struct ToolDisplaySpec: Decodable {
        let emoji: String?
        let title: String?
        let label: String?
        let detailKeys: [String]?
        let actions: [String: ToolDisplayActionSpec]?
    }

    private struct ToolDisplayConfig: Decodable {
        let version: Int?
        let fallback: ToolDisplaySpec?
        let tools: [String: ToolDisplaySpec]?
    }

    private static let config: ToolDisplayConfig = loadConfig()

    /// Resolve a rich display summary for a tool invocation.
    public static func resolve(name: String?, args: AnyCodable?, meta: String? = nil) -> ToolDisplaySummary {
        let trimmedName = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "tool"
        let key = trimmedName.lowercased()
        let spec = config.tools?[key]
        let fallback = config.fallback

        let emoji = spec?.emoji ?? fallback?.emoji ?? "🧩"
        let title = spec?.title ?? titleFromName(trimmedName)
        let label = spec?.label ?? trimmedName

        let actionRaw = valueForKeyPath(args, path: "action") as? String
        let action = actionRaw?.trimmingCharacters(in: .whitespacesAndNewlines)
        let actionSpec = action.flatMap { spec?.actions?[$0] }

        let verb = normalizeVerb(action)
        let detailKeys = actionSpec?.detailKeys ?? spec?.detailKeys
        let detail: String?
        if let detailKeys, !detailKeys.isEmpty {
            detail = firstValue(args, keys: detailKeys)
        } else {
            detail = readDetail(args) ?? pathDetail(args)
        }

        return ToolDisplaySummary(
            name: trimmedName,
            emoji: emoji,
            title: title,
            label: actionSpec?.label ?? label,
            verb: verb,
            detail: detail.map(shortenHomeInString)
        )
    }

    // MARK: - Config Loading

    private static func loadConfig() -> ToolDisplayConfig {
        #if SWIFT_PACKAGE
        guard let url = Bundle.module.url(forResource: "tool-display", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode(ToolDisplayConfig.self, from: data)
        else { return defaultConfig() }
        return config
        #else
        return defaultConfig()
        #endif
    }

    private static func defaultConfig() -> ToolDisplayConfig {
        ToolDisplayConfig(
            version: 1,
            fallback: ToolDisplaySpec(
                emoji: "🧩", title: nil, label: nil, detailKeys: nil, actions: nil),
            tools: [
                "read": ToolDisplaySpec(
                    emoji: "📖", title: "Read", label: "Read", detailKeys: ["path", "file"], actions: nil),
                "write": ToolDisplaySpec(
                    emoji: "✍️", title: "Write", label: "Write", detailKeys: ["path", "file"], actions: nil),
                "edit": ToolDisplaySpec(
                    emoji: "✏️", title: "Edit", label: "Edit", detailKeys: ["path", "file"], actions: nil),
                "bash": ToolDisplaySpec(
                    emoji: "💻", title: "Terminal", label: "Run", detailKeys: ["command"], actions: nil),
                "browser": ToolDisplaySpec(
                    emoji: "🌐", title: "Browse", label: "Browse", detailKeys: ["url"], actions: nil),
                "search": ToolDisplaySpec(
                    emoji: "🔍", title: "Search", label: "Search", detailKeys: ["query"], actions: nil),
            ])
    }

    // MARK: - Name Utilities

    private static func titleFromName(_ name: String) -> String {
        let words = name
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
        return words.joined(separator: " ")
    }

    private static func normalizeVerb(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return titleFromName(value)
    }

    // MARK: - Argument Extraction

    private static func readDetail(_ args: AnyCodable?) -> String? {
        if let content = valueForKeyPath(args, path: "content") as? String {
            let preview = content.prefix(80)
            return preview.count < content.count ? "\(preview)…" : String(preview)
        }
        return nil
    }

    private static func pathDetail(_ args: AnyCodable?) -> String? {
        if let path = valueForKeyPath(args, path: "path") as? String {
            return shortenHomeInString(path)
        }
        return nil
    }

    private static func firstValue(_ args: AnyCodable?, keys: [String]) -> String? {
        for key in keys {
            if let raw = valueForKeyPath(args, path: key) {
                if let rendered = renderValue(raw) {
                    return rendered
                }
            }
        }
        return nil
    }

    private static func renderValue(_ value: Any) -> String? {
        switch value {
        case let s as String where !s.isEmpty:
            let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.count > 100 {
                return String(trimmed.prefix(100)) + "…"
            }
            return trimmed
        case let n as NSNumber:
            return n.stringValue
        case let arr as [Any]:
            return arr.compactMap(renderValue).joined(separator: ", ")
        default:
            return nil
        }
    }

    private static func valueForKeyPath(_ args: AnyCodable?, path: String) -> Any? {
        guard let args else { return nil }
        let dict: [String: Any]?
        if let d = args.value as? [String: Any] { dict = d }
        else { dict = nil }
        guard let dict else { return nil }

        let components = path.split(separator: ".")
        var current: Any = dict
        for key in components {
            guard let d = current as? [String: Any], let next = d[String(key)] else {
                return nil
            }
            current = next
        }
        return current
    }

    private static func shortenHomeInString(_ value: String) -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return value.replacingOccurrences(of: home, with: "~")
    }
}

// MARK: - Legacy API Compatibility

/// Backward-compatible facade over ToolDisplayRegistry.
public enum ToolDisplay {
    private static let entries: [String: ToolDisplayEntry] = {
        guard let url = CoreBlowKitResources.bundle.url(
            forResource: "tool-display", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let parsed = try? JSONDecoder().decode([String: ToolDisplayEntry].self, from: data)
        else { return [:] }
        return parsed
    }()

    public static func entry(for key: String) -> ToolDisplayEntry? { entries[key] }
    public static func allEntries() -> [String: ToolDisplayEntry] { entries }
    public static func label(for key: String, fallback: String? = nil) -> String {
        entries[key]?.label ?? fallback ?? key
    }
    public static func icon(for key: String) -> String? { entries[key]?.icon }
    public static func isHidden(_ key: String) -> Bool { entries[key]?.hidden ?? false }

    public static func groupedByCategory() -> [String: [String: ToolDisplayEntry]] {
        var result: [String: [String: ToolDisplayEntry]] = [:]
        for (key, entry) in entries {
            let cat = entry.category ?? "other"
            result[cat, default: [:]][key] = entry
        }
        return result
    }
}
