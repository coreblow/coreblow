import Foundation
import OSLog
actor GatewayConnection {
    enum State: Sendable { case disconnected, connecting, connected, reconnecting }
    private(set) var state: State = .disconnected
    private var webSocket: URLSessionWebSocketTask?
    private let logger = CoreBlowLogging.gateway
    private var messageHandler: (@Sendable (String) -> Void)?
    func connect(to url: URL, token: String?) async throws {
        state = .connecting
        var request = URLRequest(url: url)
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: request)
        webSocket?.resume()
        state = .connected; logger.info("Connected to \(url)")
        await receiveLoop()
    }
    func disconnect() { webSocket?.cancel(with: .goingAway, reason: nil); webSocket = nil; state = .disconnected }
    func send(_ text: String) async throws {
        guard let ws = webSocket else { throw GatewayConnectionError.notConnected }
        try await ws.send(.string(text))
    }
    func onMessage(_ handler: @escaping @Sendable (String) -> Void) { messageHandler = handler }
    private func receiveLoop() async {
        guard let ws = webSocket else { return }
        do { while true {
            let msg = try await ws.receive()
            if case .string(let text) = msg { messageHandler?(text) }
        }} catch { state = .disconnected; logger.error("WS error: \(error.localizedDescription)") }
    }
}
enum GatewayConnectionError: Error { case notConnected, authFailed, timeout }
