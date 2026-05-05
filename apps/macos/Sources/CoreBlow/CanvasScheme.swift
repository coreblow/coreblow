import Foundation
enum CanvasScheme {
    static let scheme = "coreblow-canvas"
    static func url(session: String, path: String) -> URL? { URL(string: "\(scheme)://\(session)/\(path)") }
    static func isCanvasURL(_ url: URL) -> Bool { url.scheme == scheme }
    static func extractSession(_ url: URL) -> String? { url.host }
    static func extractPath(_ url: URL) -> String { url.path.isEmpty ? "/" : url.path }
}
