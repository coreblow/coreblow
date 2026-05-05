import Foundation; import Observation; import OSLog
@MainActor @Observable final class CanvasManager {
    private(set) var activeSessions: [String: CanvasSession] = []; private let logger = CoreBlowLogging.canvas
    struct CanvasSession { let id: String; let directory: URL; var currentPath: String?; var isVisible: Bool }
    func present(session: String, path: String?) -> CanvasSession {
        if var existing = activeSessions[session] { existing.currentPath = path; existing.isVisible = true; activeSessions[session] = existing; return existing }
        let dir = CoreBlowPaths.canvasDirectory.appendingPathComponent(session)
        try? CoreBlowPaths.ensureDirectoryExists(dir)
        let s = CanvasSession(id: session, directory: dir, currentPath: path, isVisible: true); activeSessions[session] = s; return s
    }
    func hide(session: String) { activeSessions[session]?.isVisible = false }
    func remove(session: String) { activeSessions.removeValue(forKey: session) }
}
