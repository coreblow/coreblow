import Foundation
actor ExecApprovalsSocket {
    private var ws: URLSessionWebSocketTask?
    func connect(url: URL, onApproval: @escaping @Sendable (String, [String], String?) -> Void) async {
        let session = URLSession(configuration: .default)
        ws = session.webSocketTask(with: url.appendingPathComponent("/api/approvals/ws"))
        ws?.resume()
        while let ws, !Task.isCancelled {
            do { let msg = try await ws.receive()
                if case .string(let text) = msg, let data = text.data(using: .utf8),
                   let obj = try? JSONDecoder().decode(ApprovalEvent.self, from: data) {
                    onApproval(obj.id, obj.command, obj.cwd) } }
            catch { break }
        }
    }
    func disconnect() { ws?.cancel(with: .goingAway, reason: nil); ws = nil }
    private struct ApprovalEvent: Codable { let id: String; let command: [String]; let cwd: String? }
}
