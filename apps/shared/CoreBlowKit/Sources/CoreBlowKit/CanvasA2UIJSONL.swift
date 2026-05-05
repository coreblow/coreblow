import Foundation
public enum CanvasA2UIJSONL {
    public static func encode(_ actions: [CanvasA2UIAction]) -> String { actions.compactMap { try? String(data: JSONEncoder().encode($0), encoding: .utf8) }.joined(separator: "\n") }
    public static func decode(_ text: String) -> [CanvasA2UIAction] { text.split(separator: "\n").compactMap { try? JSONDecoder().decode(CanvasA2UIAction.self, from: Data($0.utf8)) } }
}
