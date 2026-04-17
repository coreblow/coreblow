// CoreBlowChatUI/ChatModels.swift
// Chat data models for the CoreBlow SwiftUI chat interface.

import Foundation
import CoreBlowKit
import CoreBlowProtocol

#if canImport(AppKit)
import AppKit
public typealias CoreBlowPlatformImage = NSImage
#elseif canImport(UIKit)
import UIKit
public typealias CoreBlowPlatformImage = UIImage
#endif

// MARK: - Usage

/// Token usage cost breakdown.
public struct ChatUsageCost: Codable, Hashable, Sendable {
    public let input: Double?
    public let output: Double?
    public let cacheRead: Double?
    public let cacheWrite: Double?
    public let total: Double?
}

/// Token usage for a chat completion.
public struct ChatUsage: Codable, Hashable, Sendable {
    public let input: Int?
    public let output: Int?
    public let cacheRead: Int?
    public let cacheWrite: Int?
    public let cost: ChatUsageCost?
    public let total: Int?

    enum CodingKeys: String, CodingKey {
        case input, output, cacheRead, cacheWrite, cost, total, totalTokens
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        input = try c.decodeIfPresent(Int.self, forKey: .input)
        output = try c.decodeIfPresent(Int.self, forKey: .output)
        cacheRead = try c.decodeIfPresent(Int.self, forKey: .cacheRead)
        cacheWrite = try c.decodeIfPresent(Int.self, forKey: .cacheWrite)
        cost = try c.decodeIfPresent(ChatUsageCost.self, forKey: .cost)
        total = try c.decodeIfPresent(Int.self, forKey: .total)
            ?? c.decodeIfPresent(Int.self, forKey: .totalTokens)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(input, forKey: .input)
        try c.encodeIfPresent(output, forKey: .output)
        try c.encodeIfPresent(cacheRead, forKey: .cacheRead)
        try c.encodeIfPresent(cacheWrite, forKey: .cacheWrite)
        try c.encodeIfPresent(cost, forKey: .cost)
        try c.encodeIfPresent(total, forKey: .total)
    }
}

// MARK: - Message Content

/// Content block within a chat message.
public struct ChatMessageContent: Codable, Hashable, Sendable {
    public let type: String?
    public let text: String?
    public let thinking: String?
    public let thinkingSignature: String?
    public let mimeType: String?
    public let fileName: String?
    public let content: FlexValue?
    public let id: String?
    public let name: String?
    public let arguments: FlexValue?

    public init(
        type: String?, text: String?, thinking: String? = nil,
        thinkingSignature: String? = nil, mimeType: String? = nil,
        fileName: String? = nil, content: FlexValue? = nil,
        id: String? = nil, name: String? = nil, arguments: FlexValue? = nil
    ) {
        self.type = type; self.text = text; self.thinking = thinking
        self.thinkingSignature = thinkingSignature; self.mimeType = mimeType
        self.fileName = fileName; self.content = content
        self.id = id; self.name = name; self.arguments = arguments
    }

    /// Check if this is a text content block.
    public var isText: Bool { type == "text" || type == nil }

    /// Check if this is a tool call content block.
    public var isToolCall: Bool { type == "toolCall" || type == "tool_use" }

    /// Check if this is a thinking content block.
    public var isThinking: Bool { type == "thinking" || thinking != nil }

    /// The display text (text or thinking).
    public var displayText: String? { text ?? thinking }
}

// MARK: - Chat Message

/// A single message in a chat session.
public struct ChatMessage: Codable, Identifiable, Sendable {
    public var id: UUID = .init()
    public let role: String
    public let content: [ChatMessageContent]
    public let timestamp: Double?
    public let toolCallId: String?
    public let toolName: String?
    public let usage: ChatUsage?
    public let stopReason: String?

    enum CodingKeys: String, CodingKey {
        case role, content, timestamp, toolCallId, tool_call_id
        case toolName, tool_name, usage, stopReason
    }

    public init(
        id: UUID = .init(), role: String, content: [ChatMessageContent],
        timestamp: Double? = nil, toolCallId: String? = nil,
        toolName: String? = nil, usage: ChatUsage? = nil, stopReason: String? = nil
    ) {
        self.id = id; self.role = role; self.content = content
        self.timestamp = timestamp; self.toolCallId = toolCallId
        self.toolName = toolName; self.usage = usage; self.stopReason = stopReason
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        role = try c.decode(String.self, forKey: .role)
        timestamp = try c.decodeIfPresent(Double.self, forKey: .timestamp)
        toolCallId = try c.decodeIfPresent(String.self, forKey: .toolCallId)
            ?? c.decodeIfPresent(String.self, forKey: .tool_call_id)
        toolName = try c.decodeIfPresent(String.self, forKey: .toolName)
            ?? c.decodeIfPresent(String.self, forKey: .tool_name)
        usage = try c.decodeIfPresent(ChatUsage.self, forKey: .usage)
        stopReason = try c.decodeIfPresent(String.self, forKey: .stopReason)

        if let arr = try? c.decode([ChatMessageContent].self, forKey: .content) {
            content = arr
        } else if let text = try? c.decode(String.self, forKey: .content) {
            content = [ChatMessageContent(type: "text", text: text)]
        } else {
            content = []
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(role, forKey: .role)
        try c.encodeIfPresent(timestamp, forKey: .timestamp)
        try c.encodeIfPresent(toolCallId, forKey: .toolCallId)
        try c.encodeIfPresent(toolName, forKey: .toolName)
        try c.encodeIfPresent(usage, forKey: .usage)
        try c.encodeIfPresent(stopReason, forKey: .stopReason)
        try c.encode(content, forKey: .content)
    }

    /// Whether this is a user message.
    public var isUser: Bool { role == "user" }
    /// Whether this is an assistant message.
    public var isAssistant: Bool { role == "assistant" }
    /// Whether this is a tool result message.
    public var isToolResult: Bool { role == "tool" }

    /// Combined text from all text content blocks.
    public var fullText: String {
        content.compactMap(\.displayText).joined()
    }

    /// All tool calls in this message.
    public var toolCalls: [ChatMessageContent] {
        content.filter(\.isToolCall)
    }
}

// MARK: - Session

/// Chat history payload from the gateway.
public struct ChatHistoryPayload: Codable, Sendable {
    public let sessionKey: String
    public let sessionId: String?
    public let messages: [FlexValue]?
    public let thinkingLevel: String?
}

/// Session preview item.
public struct SessionPreviewItem: Codable, Hashable, Sendable {
    public let role: String
    public let text: String
}

/// Session preview entry.
public struct SessionPreviewEntry: Codable, Sendable {
    public let key: String
    public let status: String
    public let items: [SessionPreviewItem]
}

/// Sessions preview payload.
public struct SessionsPreviewPayload: Codable, Sendable {
    public let ts: Int
    public let previews: [SessionPreviewEntry]
}

// MARK: - Chat Events

/// Send response from the gateway.
public struct ChatSendResponse: Codable, Sendable {
    public let runId: String
    public let status: String
}

/// Chat event payload (streaming).
public struct ChatEventPayload: Codable, Sendable {
    public let runId: String?
    public let sessionKey: String?
    public let state: String?
    public let message: FlexValue?
    public let errorMessage: String?
}

/// Pending tool call in progress.
public struct PendingToolCall: Identifiable, Hashable, Sendable {
    public var id: String { toolCallId }
    public let toolCallId: String
    public let name: String
    public let args: FlexValue?
    public let startedAt: Double?
    public let isError: Bool?

    public init(toolCallId: String, name: String, args: FlexValue? = nil,
                startedAt: Double? = nil, isError: Bool? = nil) {
        self.toolCallId = toolCallId; self.name = name; self.args = args
        self.startedAt = startedAt; self.isError = isError
    }
}

// MARK: - Attachment

/// File attachment payload for sending.
public struct ChatAttachmentPayload: Codable, Sendable, Hashable {
    public let type: String
    public let mimeType: String
    public let fileName: String
    public let content: String // base64

    public init(type: String = "file", mimeType: String, fileName: String, content: String) {
        self.type = type; self.mimeType = mimeType
        self.fileName = fileName; self.content = content
    }
}

// MARK: - Gateway Health

/// Gateway health check response.
public struct GatewayHealthOK: Codable, Sendable {
    public let ok: Bool?
}
