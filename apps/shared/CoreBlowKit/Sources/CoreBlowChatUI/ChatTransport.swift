import Foundation

/// Push events delivered by the chat transport to the ViewModel.
public enum CoreBlowChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(CoreBlowChatEventPayload)
    case agent(CoreBlowAgentEventPayload)
    case seqGap
}

/// Chat transport protocol — abstracts gateway RPC for the ChatUI layer.
///
/// CoreBlow chat views interact with the gateway exclusively through this
/// protocol, enabling mock transports in previews and tests.
public protocol CoreBlowChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> CoreBlowChatHistoryPayload
    func listModels() async throws -> [CoreBlowChatModelChoice]
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [CoreBlowChatAttachmentPayload]) async throws -> CoreBlowChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> CoreBlowChatSessionsListResponse
    func setSessionModel(sessionKey: String, model: String?) async throws
    func setSessionThinking(sessionKey: String, thinkingLevel: String) async throws

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<CoreBlowChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
    func resetSession(sessionKey: String) async throws
    func compactSession(sessionKey: String) async throws
}

// MARK: - Default Implementations

extension CoreBlowChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func resetSession(sessionKey _: String) async throws {
        throw NSError(
            domain: "CoreBlowChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.reset not supported by this transport"])
    }

    public func compactSession(sessionKey _: String) async throws {
        throw NSError(
            domain: "CoreBlowChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.compact not supported by this transport"])
    }

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "CoreBlowChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> CoreBlowChatSessionsListResponse {
        throw NSError(
            domain: "CoreBlowChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }

    public func listModels() async throws -> [CoreBlowChatModelChoice] {
        throw NSError(
            domain: "CoreBlowChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "models.list not supported by this transport"])
    }

    public func setSessionModel(sessionKey _: String, model _: String?) async throws {
        throw NSError(
            domain: "CoreBlowChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(model) not supported by this transport"])
    }

    public func setSessionThinking(sessionKey _: String, thinkingLevel _: String) async throws {
        throw NSError(
            domain: "CoreBlowChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(thinkingLevel) not supported by this transport"])
    }
}

// MARK: - Session Context

/// Protocol for managing chat session state.
public protocol CoreBlowChatSessionContext: AnyObject, Sendable {
    var activeSessionKey: String { get }
    func updateSessionKey(_ key: String)
}
