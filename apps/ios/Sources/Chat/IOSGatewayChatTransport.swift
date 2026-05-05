import Foundation
import os

/// Gateway-backed chat transport that sends/receives messages via the operator session.
struct IOSGatewayChatTransport: Sendable {

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "ChatTransport")
    private let connection: GatewayConnectionController

    init(connection: GatewayConnectionController) {
        self.connection = connection
    }

    /// Send a chat message to the gateway agent.
    func sendMessage(
        text: String,
        sessionKey: String,
        agentId: String?,
        thinking: String? = nil
    ) async throws -> ChatTransportResponse {
        var params: [String: Any] = [
            "message": text,
            "sessionKey": sessionKey,
        ]
        if let agentId, !agentId.isEmpty {
            params["agentId"] = agentId
        }
        if let thinking, !thinking.isEmpty {
            params["thinking"] = thinking
        }

        let response = try await connection.sendInvoke(
            command: "chat.send",
            params: params)

        return ChatTransportResponse(ok: true, responseText: response)
    }

    /// Stream chat responses from the gateway.
    func streamMessages(sessionKey: String) -> AsyncStream<ChatTransportEvent> {
        AsyncStream { continuation in
            Task {
                // Subscribe to server events for chat updates
                let params: [String: Any] = ["sessionKey": sessionKey]
                do {
                    let response = try await connection.sendInvoke(
                        command: "chat.subscribe",
                        params: params)
                    let event = ChatTransportEvent(
                        type: .message,
                        content: response)
                    continuation.yield(event)
                } catch {
                    logger.error("Chat stream error: \(error.localizedDescription)")
                }
                continuation.finish()
            }
        }
    }
}

// MARK: - Transport Types

struct ChatTransportResponse: Sendable {
    let ok: Bool
    let responseText: String?
}

struct ChatTransportEvent: Sendable {
    let type: EventType
    let content: String?

    enum EventType { case message, typing, error }
}
