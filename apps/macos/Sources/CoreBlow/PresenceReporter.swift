import Foundation
actor PresenceReporter { func report(gatewayURL: URL, status: String) async { var req = URLRequest(url: gatewayURL.appendingPathComponent("/api/presence")); req.httpMethod = "POST"; req.httpBody = try? JSONEncoder().encode(["status": status]); _ = try? await URLSession.shared.data(for: req) } }
