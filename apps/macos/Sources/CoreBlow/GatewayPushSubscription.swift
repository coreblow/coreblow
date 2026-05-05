import Foundation
actor GatewayPushSubscription {
    private var subscriptionId: String?
    func subscribe(gatewayURL: URL, deviceToken: String) async throws {
        var request = URLRequest(url: gatewayURL.appendingPathComponent("/api/push/subscribe"))
        request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = ["token": deviceToken, "platform": "macos"]
        request.httpBody = try JSONEncoder().encode(body)
        let (data, _) = try await URLSession.shared.data(for: request)
        if let resp = try? JSONDecoder().decode([String: String].self, from: data) { subscriptionId = resp["id"] }
    }
    func unsubscribe(gatewayURL: URL) async throws {
        guard let id = subscriptionId else { return }
        var request = URLRequest(url: gatewayURL.appendingPathComponent("/api/push/unsubscribe"))
        request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["id": id])
        _ = try await URLSession.shared.data(for: request); subscriptionId = nil
    }
}
