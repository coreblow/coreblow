// CoreBlowKit/Features/CanvasA2UI.swift
// Canvas Agent-to-UI action system for rich interactive UIs.

import Foundation
import CoreBlowProtocol

// MARK: - Canvas A2UI Action Types

/// Action types the agent can send to the canvas UI.
public enum CanvasActionKind: String, Codable, Sendable {
    case navigate
    case update
    case replace
    case append
    case remove
    case clear
    case setData = "set-data"
    case mergeData = "merge-data"
    case showAlert = "show-alert"
    case showToast = "show-toast"
    case scroll
    case focus
    case blur
    case custom
}

/// A canvas A2UI action from the agent.
public struct CanvasAction: Codable, Sendable, Identifiable {
    public var id: String { actionId }
    public let actionId: String
    public let kind: CanvasActionKind
    public let target: String?
    public let data: FlexValue?
    public let options: FlexValue?

    public init(
        actionId: String = UUID().uuidString,
        kind: CanvasActionKind,
        target: String? = nil,
        data: FlexValue? = nil,
        options: FlexValue? = nil
    ) {
        self.actionId = actionId; self.kind = kind
        self.target = target; self.data = data; self.options = options
    }

    enum CodingKeys: String, CodingKey {
        case actionId, kind, target, data, options
    }
}

// MARK: - Canvas Command Parameters

/// Parameters for opening a canvas.
public struct CanvasOpenParams: Codable, Sendable {
    public let url: String
    public let title: String?
    public let width: Int?
    public let height: Int?
    public let capability: String?

    public init(url: String, title: String? = nil, width: Int? = nil,
                height: Int? = nil, capability: String? = nil) {
        self.url = url; self.title = title
        self.width = width; self.height = height; self.capability = capability
    }
}

/// Parameters for updating canvas data.
public struct CanvasUpdateParams: Codable, Sendable {
    public let actions: [CanvasAction]

    public init(actions: [CanvasAction]) {
        self.actions = actions
    }
}

// MARK: - Canvas JSONL Streaming

/// Parses JSONL-formatted canvas action streams.
public enum CanvasJSONLParser {
    /// Parse a JSONL string into individual canvas actions.
    public static func parse(_ jsonlString: String) -> [CanvasAction] {
        jsonlString
            .split(separator: "\n", omittingEmptySubsequences: true)
            .compactMap { line -> CanvasAction? in
                let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty,
                      let data = trimmed.data(using: .utf8)
                else { return nil }
                return try? JSONDecoder().decode(CanvasAction.self, from: data)
            }
    }

    /// Encode canvas actions to JSONL string.
    public static func encode(_ actions: [CanvasAction]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = []
        return actions.compactMap { action -> String? in
            guard let data = try? encoder.encode(action),
                  let line = String(data: data, encoding: .utf8)
            else { return nil }
            return line
        }.joined(separator: "\n")
    }
}
