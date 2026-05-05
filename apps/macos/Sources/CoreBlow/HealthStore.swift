import Foundation; import Observation
@MainActor @Observable final class HealthStore {
    struct HealthStatus: Codable, Sendable { let uptime: TimeInterval; let version: String; let sessions: Int; let memory: UInt64? }
    private(set) var lastStatus: HealthStatus?; private(set) var isHealthy = false
    func update(from json: String) { guard let d = json.data(using: .utf8), let s = try? JSONDecoder().decode(HealthStatus.self, from: d) else { isHealthy = false; return }; lastStatus = s; isHealthy = true }
    func markUnhealthy() { isHealthy = false; lastStatus = nil }
}
