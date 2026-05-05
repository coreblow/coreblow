import Foundation
public struct ToolDisplayEntry: Codable, Sendable { public let name: String; public let icon: String?; public let category: String?; public let description: String? }
public enum ToolDisplay {
    public static func registry() -> [ToolDisplayEntry] { guard let url = Bundle.module.url(forResource: "tool-display", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [] }; return (try? JSONDecoder().decode([ToolDisplayEntry].self, from: data)) ?? [] }
}
