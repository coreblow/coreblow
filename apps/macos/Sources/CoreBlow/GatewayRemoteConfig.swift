import Foundation
struct GatewayRemoteConfig: Codable {
    let serverName: String?; let version: String?; let capabilities: [String]?; let maxSessions: Int?
    static func parse(from json: String) -> GatewayRemoteConfig? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(GatewayRemoteConfig.self, from: data)
    }
}
