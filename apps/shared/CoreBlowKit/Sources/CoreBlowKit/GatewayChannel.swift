import Foundation
public actor GatewayChannel {
    public enum State: Sendable { case idle, connecting, connected, disconnected, error(String) }
    public private(set) var state: State = .idle; private var ws: URLSessionWebSocketTask?
    public init() {}
    public func connect(url: URL, params: ConnectParams) async throws {
        state = .connecting; let session = URLSession(configuration: .default); ws = session.webSocketTask(with: url); ws?.resume(); state = .connected
    }
    public func disconnect() { ws?.cancel(with: .goingAway, reason: nil); ws = nil; state = .disconnected }
    public func send(_ message: GatewayMessage) async throws { let data = try JSONEncoder().encode(message); try await ws?.send(.data(data)) }
}
