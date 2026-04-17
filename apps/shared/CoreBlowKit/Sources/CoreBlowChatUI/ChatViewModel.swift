// CoreBlowChatUI/ChatViewModel.swift
// Observable view model for the chat interface.

import SwiftUI
import CoreBlowKit
import CoreBlowProtocol

/// Chat connection state.
public enum ChatConnectionState: Sendable, Equatable {
    case disconnected
    case connecting
    case connected
    case error(String)
}

/// Observable view model driving the chat UI.
@MainActor
@Observable
public final class ChatViewModel {
    // MARK: - Published State

    public private(set) var messages: [ChatMessage] = []
    public private(set) var connectionState: ChatConnectionState = .disconnected
    public private(set) var isStreaming = false
    public private(set) var pendingToolCalls: [PendingToolCall] = []
    public private(set) var currentRunId: String?
    public private(set) var streamingText = ""
    public private(set) var agentName: String?
    public private(set) var agentEmoji: String?

    public var composerText = ""
    public var theme: ChatTheme = .dark

    // Session
    public private(set) var sessionKey: String?
    public private(set) var sessions: [SessionPreviewEntry] = []

    // MARK: - Private

    private var channel: GatewayChannelActor?
    private var streamBuffer: [String: String] = [:]

    // MARK: - Init

    public init() {}

    // MARK: - Connection

    /// Connect to a CoreBlow gateway.
    public func connect(url: URL, token: String? = nil, password: String? = nil) async {
        connectionState = .connecting

        let channel = GatewayChannelActor(
            url: url, token: token, password: password,
            pushHandler: { [weak self] push in
                await self?.handlePush(push)
            },
            disconnectHandler: { [weak self] reason in
                await MainActor.run {
                    self?.connectionState = .error(reason)
                }
            }
        )
        self.channel = channel

        do {
            try await channel.connect()
            connectionState = .connected
        } catch {
            connectionState = .error(error.localizedDescription)
        }
    }

    /// Disconnect from the gateway.
    public func disconnect() async {
        await channel?.shutdown()
        channel = nil
        connectionState = .disconnected
    }

    // MARK: - Sending Messages

    /// Send a text message to the agent.
    public func send() async {
        let text = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        // Add user message immediately
        let userMsg = ChatMessage(
            role: "user",
            content: [ChatMessageContent(type: "text", text: text)],
            timestamp: Date().timeIntervalSince1970
        )
        messages.append(userMsg)
        composerText = ""
        isStreaming = true

        do {
            let params: FlexValue = .object([
                "message": .string(text),
                "sessionKey": sessionKey.map { .string($0) } ?? .null,
                "idempotencyKey": .string(UUID().uuidString),
            ])
            let res = try await channel?.request(method: "agent", params: params)
            if let runId = res?.payload?["runId"]?.stringValue {
                currentRunId = runId
            }
        } catch {
            isStreaming = false
            let errMsg = ChatMessage(
                role: "assistant",
                content: [ChatMessageContent(type: "text", text: "Error: \(error.localizedDescription)")],
                timestamp: Date().timeIntervalSince1970
            )
            messages.append(errMsg)
        }
    }

    /// Send a message with attachments.
    public func send(text: String, attachments: [ChatAttachmentPayload]) async {
        let userMsg = ChatMessage(
            role: "user",
            content: [ChatMessageContent(type: "text", text: text)],
            timestamp: Date().timeIntervalSince1970
        )
        messages.append(userMsg)
        isStreaming = true

        do {
            var params: [String: FlexValue] = [
                "message": .string(text),
                "idempotencyKey": .string(UUID().uuidString),
            ]
            if let key = sessionKey { params["sessionKey"] = .string(key) }
            if !attachments.isEmpty {
                let data = try JSONEncoder().encode(attachments)
                let flex = try JSONDecoder().decode([FlexValue].self, from: data)
                params["attachments"] = .array(flex)
            }
            let res = try await channel?.request(method: "agent", params: .object(params))
            if let runId = res?.payload?["runId"]?.stringValue {
                currentRunId = runId
            }
        } catch {
            isStreaming = false
        }
    }

    // MARK: - Session Management

    /// Load session previews.
    public func loadSessions() async {
        guard let res = try? await channel?.request(method: "sessions.preview") else { return }
        if let data = try? JSONEncoder().encode(res.payload),
           let payload = try? JSONDecoder().decode(SessionsPreviewPayload.self, from: data) {
            sessions = payload.previews
        }
    }

    /// Select a session by key.
    public func selectSession(_ key: String) async {
        sessionKey = key
        messages = []
        guard let res = try? await channel?.request(
            method: "sessions.resolve",
            params: .object(["sessionKey": .string(key)])
        ) else { return }

        if let data = try? JSONEncoder().encode(res.payload),
           let payload = try? JSONDecoder().decode(ChatHistoryPayload.self, from: data) {
            sessionKey = payload.sessionKey
            // Decode messages from FlexValue array
            if let rawMsgs = payload.messages {
                let msgData = try? JSONEncoder().encode(rawMsgs)
                if let msgData, let decoded = try? JSONDecoder().decode([ChatMessage].self, from: msgData) {
                    messages = decoded
                }
            }
        }
    }

    /// Create a new session.
    public func newSession() {
        sessionKey = nil
        messages = []
        streamingText = ""
        isStreaming = false
        pendingToolCalls = []
    }

    // MARK: - Abort

    /// Abort the current agent run.
    public func abort() async {
        isStreaming = false
        currentRunId = nil
        _ = try? await channel?.request(method: "agent.abort")
    }

    // MARK: - Push Handling

    private func handlePush(_ push: GatewayPush) async {
        await MainActor.run {
            switch push {
            case .snapshot(let hello):
                self.sessionKey = hello.snapshot.sessionDefaults?["sessionKey"]?.stringValue
            case .event(let evt):
                self.handleEvent(evt)
            case .seqGap:
                break // Could trigger full resync
            }
        }
    }

    private func handleEvent(_ evt: GatewayEvent) {
        switch evt.event {
        case "agent.stream":
            handleAgentStream(evt)
        case "agent.complete":
            handleAgentComplete(evt)
        case "agent.error":
            handleAgentError(evt)
        case "session.update":
            if let key = evt.payload?["sessionKey"]?.stringValue {
                sessionKey = key
            }
        default:
            break
        }
    }

    private func handleAgentStream(_ evt: GatewayEvent) {
        guard let payload = evt.payload,
              let stream = payload["stream"]?.stringValue else { return }

        switch stream {
        case "text":
            if let delta = payload["data"]?["text"]?.stringValue {
                streamingText += delta
            }
        case "thinking":
            // Accumulate thinking text
            break
        case "tool_call_start":
            if let id = payload["data"]?["id"]?.stringValue,
               let name = payload["data"]?["name"]?.stringValue {
                pendingToolCalls.append(PendingToolCall(
                    toolCallId: id, name: name,
                    startedAt: Date().timeIntervalSince1970))
            }
        case "tool_call_end":
            if let id = payload["data"]?["id"]?.stringValue {
                pendingToolCalls.removeAll { $0.toolCallId == id }
            }
        default:
            break
        }
    }

    private func handleAgentComplete(_ evt: GatewayEvent) {
        isStreaming = false
        pendingToolCalls = []

        if !streamingText.isEmpty {
            let msg = ChatMessage(
                role: "assistant",
                content: [ChatMessageContent(type: "text", text: streamingText)],
                timestamp: Date().timeIntervalSince1970
            )
            messages.append(msg)
            streamingText = ""
        }
        currentRunId = nil
    }

    private func handleAgentError(_ evt: GatewayEvent) {
        isStreaming = false
        let errText = evt.payload?["errorMessage"]?.stringValue ?? "Unknown error"
        let msg = ChatMessage(
            role: "assistant",
            content: [ChatMessageContent(type: "text", text: "⚠️ \(errText)")],
            timestamp: Date().timeIntervalSince1970
        )
        messages.append(msg)
        currentRunId = nil
    }
}
