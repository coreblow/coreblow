// CoreBlowChatUI/ChatTransport.swift
// Transport protocol for abstracting the gateway connection.

import Foundation
import CoreBlowKit
import CoreBlowProtocol

// MARK: - Transport Events

/// Events emitted by the chat transport layer.
public enum ChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(ChatEventPayload)
    case agent(AgentStreamEvent)
    case seqGap
}

// MARK: - Model Choice

/// Model choice for session configuration.
public struct ChatModelChoice: Codable, Sendable, Hashable {
    public let id: String
    public let name: String
    public let provider: String?
    public let supportsThinking: Bool?

    public init(id: String, name: String, provider: String? = nil, supportsThinking: Bool? = nil) {
        self.id = id; self.name = name; self.provider = provider
        self.supportsThinking = supportsThinking
    }
}

/// Session list response.
public struct ChatSessionsListResponse: Codable, Sendable {
    public let sessions: [SessionPreviewEntry]
    public let total: Int?
}

// MARK: - Transport Protocol

/// Protocol abstracting the gateway transport for the chat layer.
///
/// This enables:
/// - Unit testing with mock transports
/// - Alternative backends (local, relay, etc.)
/// - Clean separation between UI and network
public protocol ChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> ChatHistoryPayload
    func listModels() async throws -> [ChatModelChoice]
    func sendMessage(
        sessionKey: String, message: String, thinking: String,
        idempotencyKey: String, attachments: [ChatAttachmentPayload]
    ) async throws -> ChatSendResponse
    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> ChatSessionsListResponse
    func setSessionModel(sessionKey: String, model: String?) async throws
    func setSessionThinking(sessionKey: String, thinkingLevel: String) async throws
    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<ChatTransportEvent>
    func setActiveSessionKey(_ sessionKey: String) async throws
    func resetSession(sessionKey: String) async throws
    func compactSession(sessionKey: String) async throws
}

// MARK: - Default Implementations

extension ChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func resetSession(sessionKey _: String) async throws {
        throw CoreBlowTransportError.unsupported("sessions.reset")
    }

    public func compactSession(sessionKey _: String) async throws {
        throw CoreBlowTransportError.unsupported("sessions.compact")
    }

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw CoreBlowTransportError.unsupported("chat.abort")
    }

    public func listSessions(limit _: Int?) async throws -> ChatSessionsListResponse {
        throw CoreBlowTransportError.unsupported("sessions.list")
    }

    public func listModels() async throws -> [ChatModelChoice] {
        throw CoreBlowTransportError.unsupported("models.list")
    }

    public func setSessionModel(sessionKey _: String, model _: String?) async throws {
        throw CoreBlowTransportError.unsupported("sessions.patch(model)")
    }

    public func setSessionThinking(sessionKey _: String, thinkingLevel _: String) async throws {
        throw CoreBlowTransportError.unsupported("sessions.patch(thinking)")
    }
}

// MARK: - Transport Error

public enum CoreBlowTransportError: LocalizedError, Sendable {
    case unsupported(String)
    case notConnected
    case decodingFailed(String)

    public var errorDescription: String? {
        switch self {
        case .unsupported(let method): return "\(method) not supported by this transport"
        case .notConnected: return "transport not connected"
        case .decodingFailed(let msg): return "decoding failed: \(msg)"
        }
    }
}
