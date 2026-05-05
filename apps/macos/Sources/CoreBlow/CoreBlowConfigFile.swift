import Foundation
struct CoreBlowConfigFile: Codable {
    var gateway: GatewaySection?; var app: AppSection?; var voice: VoiceSection?
    struct GatewaySection: Codable { var host: String?; var port: UInt16?; var tls: Bool?; var autoStart: Bool? }
    struct AppSection: Codable { var showInDock: Bool?; var showInMenuBar: Bool? }
    struct VoiceSection: Codable { var wakeEnabled: Bool?; var triggerWords: [String]? }
    static func load(from url: URL) throws -> CoreBlowConfigFile {
        let data = try Data(contentsOf: url); return try JSONDecoder().decode(CoreBlowConfigFile.self, from: data)
    }
    func save(to url: URL) throws {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(self).write(to: url, options: .atomic)
    }
}
