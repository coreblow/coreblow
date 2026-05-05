import Foundation
public protocol ChatTransport: Sendable { func send(message: String, session: String?) async throws -> String }
public struct WebSocketChatTransport: ChatTransport {
    private let url: URL; public init(url: URL) { self.url = url }
    public func send(message: String, session: String?) async throws -> String {
        var req = URLRequest(url: url); req.httpMethod = "POST"; req.httpBody = try JSONEncoder().encode(["message": message, "session": session])
        let (data, _) = try await URLSession.shared.data(for: req); return String(data: data, encoding: .utf8) ?? ""
    }
}
