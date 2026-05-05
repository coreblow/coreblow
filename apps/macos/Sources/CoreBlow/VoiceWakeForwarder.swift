import Foundation
actor VoiceWakeForwarder {
    func forward(command: String, to gatewayURL: URL) async throws {
        var req = URLRequest(url: gatewayURL.appendingPathComponent("/api/voice/command")); req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type"); req.httpBody = try JSONEncoder().encode(["command": command]); _ = try await URLSession.shared.data(for: req)
    }
}
