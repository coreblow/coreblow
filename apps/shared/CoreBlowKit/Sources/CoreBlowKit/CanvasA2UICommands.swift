import Foundation
public enum CanvasA2UICommands {
    public static func pushJSONL(_ lines: [String], to session: String) -> [CanvasA2UIAction] { lines.compactMap { line in guard let data = line.data(using: .utf8), let obj = try? JSONDecoder().decode(CanvasA2UIAction.self, from: data) else { return nil }; return obj } }
    public static func reset() -> CanvasA2UIAction { CanvasA2UIAction(type: "reset") }
}
