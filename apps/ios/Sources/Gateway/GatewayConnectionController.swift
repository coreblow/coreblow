import Foundation
import Combine
import os.log

/// Manages the WebSocket lifecycle to a CoreBlow gateway.
///
/// Handles connection, authentication, heartbeat, reconnection,
/// and message routing for invoke/result/event frames.
final class GatewayConnectionController: ObservableObject {

    // MARK: - Published State

    @Published private(set) var state: ConnectionState = .disconnected
    @Published private(set) var activeConfig: GatewayConnectConfig?

    enum ConnectionState: String {
        case disconnected, connecting, authenticating, connected, reconnecting
    }

    // MARK: - Private

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "GatewayConnection")
    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?
    private var heartbeatTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private let heartbeatInterval: TimeInterval = 30
    private let settingsStore: GatewaySettingsStore
    private let keychainStore: KeychainStore

    private var pendingInvokes: [String: CheckedContinuation<Data, Error>] = [:]

    init(settingsStore: GatewaySettingsStore, keychainStore: KeychainStore) {
        self.settingsStore = settingsStore
        self.keychainStore = keychainStore
    }

    // MARK: - Public API

    func connect(to config: GatewayConnectConfig) {
        guard state == .disconnected else { return }
        activeConfig = config
        state = .connecting
        reconnectAttempts = 0
        establishConnection(config)
    }

    func disconnect() {
        logger.info("Disconnecting from gateway")
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        state = .disconnected
        activeConfig = nil
        pendingInvokes.removeAll()
    }

    func sendInvoke(command: String, params: [String: Any]) async throws -> Data {
        guard state == .connected else {
            throw GatewayConnectionIssue.notConnected
        }

        let requestID = UUID().uuidString
        let payload: [String: Any] = [
            "type": "invoke",
            "id": requestID,
            "command": command,
            "params": params,
        ]

        let data = try JSONSerialization.data(withJSONObject: payload)
        try await webSocket?.send(.data(data))

        return try await withCheckedThrowingContinuation { continuation in
            pendingInvokes[requestID] = continuation
        }
    }

    // MARK: - Connection Lifecycle

    private func establishConnection(_ config: GatewayConnectConfig) {
        guard let url = config.wsURL else {
            state = .disconnected
            return
        }

        let urlSession = URLSession(configuration: .default)
        self.session = urlSession
        let task = urlSession.webSocketTask(with: url)
        self.webSocket = task
        task.resume()

        state = .authenticating
        logger.info("WebSocket opened to \(config.label)")

        sendAuth(config: config)
        startReceiving()
    }

    private func sendAuth(config: GatewayConnectConfig) {
        let token = keychainStore.getToken(for: config.stableID)
        let authPayload: [String: Any] = [
            "type": "auth",
            "authType": token != nil ? "device-token" : "bootstrap",
            "token": token ?? "",
            "platform": "ios",
            "version": Bundle.main.appVersion,
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: authPayload) else { return }

        webSocket?.send(.data(data)) { [weak self] error in
            if let error {
                self?.logger.error("Auth send failed: \(error.localizedDescription)")
            }
        }
    }

    private func startReceiving() {
        webSocket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.startReceiving()
            case .failure(let error):
                self.logger.error("WebSocket receive error: \(error.localizedDescription)")
                self.handleDisconnect()
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        guard case .data(let data) = message,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else { return }

        switch type {
        case "auth-ok":
            DispatchQueue.main.async { self.state = .connected }
            if let token = json["token"] as? String, let config = activeConfig {
                keychainStore.setToken(token, for: config.stableID)
            }
            startHeartbeat()
            logger.info("Authenticated successfully")

        case "result", "error":
            if let id = json["id"] as? String, let continuation = pendingInvokes.removeValue(forKey: id) {
                if type == "error" {
                    continuation.resume(throwing: GatewayConnectionIssue.invokeError(json["message"] as? String ?? "Unknown"))
                } else {
                    let resultData = (try? JSONSerialization.data(withJSONObject: json["data"] ?? [:])) ?? Data()
                    continuation.resume(returning: resultData)
                }
            }

        case "ping":
            let pong: [String: Any] = ["type": "pong", "ts": Date().timeIntervalSince1970]
            if let data = try? JSONSerialization.data(withJSONObject: pong) {
                webSocket?.send(.data(data)) { _ in }
            }

        default:
            logger.debug("Unhandled message type: \(type)")
        }
    }

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            let ping: [String: Any] = ["type": "ping", "ts": Date().timeIntervalSince1970]
            if let data = try? JSONSerialization.data(withJSONObject: ping) {
                self?.webSocket?.send(.data(data)) { _ in }
            }
        }
    }

    private func handleDisconnect() {
        heartbeatTimer?.invalidate()
        guard reconnectAttempts < maxReconnectAttempts, let config = activeConfig else {
            DispatchQueue.main.async { self.state = .disconnected }
            return
        }

        DispatchQueue.main.async { self.state = .reconnecting }
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0)
        logger.info("Reconnecting in \(delay)s (attempt \(self.reconnectAttempts))")

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.establishConnection(config)
        }
    }
}

private extension Bundle {
    var appVersion: String {
        infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    }
}
